#!/usr/bin/env node
import inquirer from "inquirer";
import loading from 'loading-cli';

import fs from 'fs';

import {generateDockerFileFromArray} from 'dockerfile-generator/lib/dockerGenerator.js';
import {Docker} from 'node-docker-api';
import tar from 'tar-fs';

import AWS from 'aws-sdk';
import {NodeSSH} from 'node-ssh';

import path from 'path';
import {fileURLToPath} from 'url';

import fetch from 'node-fetch';

const _TEMPLATES = ['NodeJSWebApp', 'StaticWeb'];
const _REGISTRY_URL = 'registry.onedep.kr:5000';
const _REGISTRY_API_URL = 'registry.onedep.kr';

const ReplaceDockerfileArgs = (dockerfile, args) => {
  if (typeof dockerfile === 'string') {
    return dockerfile.replace(/\${(\w+)}/g, (match, argName) => args[argName]);
  } else if (Array.isArray(dockerfile)) {
    return dockerfile.map((line) => ReplaceDockerfileArgs(line, args));
  }
  return Object.fromEntries(Object.entries(dockerfile).map(([key, value]) => [key, ReplaceDockerfileArgs(value, args)]));
}

const StartDeploy = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const configPath = path.join('.onedep.json');
  const configExists = fs.existsSync(configPath);
  let config = configExists ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : null;

  const templates = Object.fromEntries(_TEMPLATES.map((template) => [template, JSON.parse(fs.readFileSync(path.join(__dirname, 'templates', `${template}.json`)).toString())]));

  let response;
  if (config === null) {
    response = await inquirer.prompt([{
      type: 'input', name: 'name', message: '배포할 프로젝트 명을 입력하세요.',
    }, {
      type: 'list',
      name: 'platform',
      message: '배포할 코드의 플랫폼을 선택하세요.',
      choices: Object.values(templates).map((template) => template.name),
    },]);
  } else {
    response = config;
  }

  const selectedPlatform = Object.entries(templates).find((template) => template[1].name === response.platform)[1];

  let responses = {
    ...response,
  };

  if (config === null && selectedPlatform.custom_args) {
    const customArgs = await inquirer.prompt(Object.entries(selectedPlatform.custom_args).map(([argName, message]) => ({
      type: 'input', name: argName, message,
    })));

    responses = {
      ...responses, ...customArgs,
    }
  }

  if (config === null) {
    let load = loading("새로운 EC2 Instance를 생성하는 중...");
    load.start();

    AWS.config.update({region: 'ap-northeast-2'});
    // Create EC2
    const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});

    // Create Key Pair
    const keyPair = await ec2.createKeyPair({
      KeyName: `OneDep_${responses.name}`,
    }).promise();

    // Create Security Group
    const vpcs = await ec2.describeVpcs().promise();
    const vpc = vpcs.Vpcs[0];

    const securityGroup = await ec2.createSecurityGroup({
      Description: `OneDep_${responses.name}`, GroupName: `OneDep_${responses.name}`, VpcId: vpc.VpcId,
    }).promise();

    await ec2.authorizeSecurityGroupIngress({
      GroupId: securityGroup.GroupId, IpPermissions: [{
        IpProtocol: "tcp", FromPort: 1, ToPort: 65535, IpRanges: [{"CidrIp": "0.0.0.0/0"}]
      },]
    }).promise();

    // Create EC2 Instance
    const instanceParams = {
      ImageId: 'ami-0d091be1746738035',
      InstanceType: 't2.micro',
      KeyName: keyPair.KeyName,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: [securityGroup.GroupId],
    };

    const instancePromise = await new AWS.EC2({apiVersion: '2016-11-15'}).runInstances(instanceParams).promise();
    const instanceId = instancePromise.Instances[0].InstanceId;

    // Wait for the instance to be running
    await ec2.waitFor('instanceRunning', {InstanceIds: [instanceId]}).promise();

    // Get IPv4
    const instance = await ec2.describeInstances({InstanceIds: [instanceId]}).promise();
    const ipv4 = instance.Reservations[0].Instances[0].PublicIpAddress;

    config = {...responses};
    config.instanceId = instanceId;
    config.instanceIpv4 = ipv4;
    config.instancePrivKey = keyPair.KeyMaterial;
    config.registryPassword = `${Math.random().toString(36).slice(-8)}${Math.random().toString(36).slice(-8)}${Math.random().toString(36).slice(-8)}`;

    const credRequest = await fetch(`http://${_REGISTRY_API_URL}/new`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
      }, body: JSON.stringify({password: config.registryPassword}),
    });
    const credResponse = await credRequest.json();
    if (!credResponse.success) {
      throw new Error('Failed to create registry credentials');
    }
    config.registryUsername = credResponse.username;

    const ssh = new NodeSSH();

    const conn = async () => {
      try {
        await ssh.connect({
          host: ipv4, username: 'ec2-user', privateKey: keyPair.KeyMaterial,
        });
      } catch (e) {
        await (async () => setTimeout(() => {
        }, 3000))();
        await conn();
      }
    };
    await conn();


    await ssh.execCommand(`sudo service docker start; sudo docker login ${_REGISTRY_URL} -u ${config.registryUsername} -p ${config.registryPassword}`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    load.succeed(`EC2 생성 완료 (${instanceId})`);
  }

  const dockerfile = ReplaceDockerfileArgs(selectedPlatform.Dockerfile, responses);
  const generatedDockerfile = generateDockerFileFromArray(dockerfile);

  const docker = new Docker();

  const pack = tar.pack(process.cwd());
  pack.entry({name: 'Dockerfile'}, generatedDockerfile);

  let load = loading("Docker Image를 빌드하는 중...");
  load.start();
  const stream = await docker.image.build(pack, {
    t: `${response.name}:latest`,
  });

  await (() => new Promise((resolve, reject) => {
    stream.on('data', data => load.text = `Docker Image를 빌드하는 중... (${(JSON.parse(data.toString().split('\r\n')[0]).stream ?? '').replace('\n', '').replace('\r', '').substring(6)})`);
    stream.on('error', (err) => {
      load.fail(`Docker Image 빌드 실패: ${err.message}`);
      reject();
    })
    stream.on('end', () => {
      return resolve();
    });
  }))();

  load.succeed('Docker Image 빌드 성공');

  load = loading("Docker Image를 푸시하는 중...");
  load.start();

  const image = docker.image.get(`${response.name}:latest`);

  await image.tag({
    repo: `${_REGISTRY_URL}/${response.name}`, tag: `latest`,
  });
  const pushStream = await docker.image.get(`${_REGISTRY_URL}/${response.name}:latest`).push({
    username: config.registryUsername, password: config.registryPassword, serveraddress: _REGISTRY_URL
  });

  await (() => new Promise((resolve, reject) => {
    pushStream.on('data', data => load.text = `Docker Image를 푸시하는 중... (${JSON.parse(data.toString().split('\r\n')[0]).status})`);
    pushStream.on('error', (err) => {
      load.fail(`Docker Image 푸시 실패: ${err.message}`);
      reject();
    })
    pushStream.on('end', () => {
      return resolve();
    });
  }))();

  load.succeed('Docker Image 푸시 성공');

  load = loading("서버를 시작하는 중...");
  load.start();

  const ssh = new NodeSSH();
  await ssh.connect({
    host: config.instanceIpv4, username: 'ec2-user', privateKey: config.instancePrivKey,
  });

  const r = await ssh.execCommand(`sudo docker stop ${response.name}; sudo docker rm ${response.name}; sudo docker rmi ${_REGISTRY_URL}/${response.name}:latest; sudo docker run -d -P --name ${response.name} ${_REGISTRY_URL}/${response.name}:latest`);
  const lines = r.stdout.split('\n');
  const container = lines[lines.length - 1].replace('\r', '');

  const ports = (await ssh.execCommand(`sudo docker port ${container}`)).stdout.split('\n');
  const port = ports[0];
  const portNumber = port.split(':')[1];

  load.succeed('서버를 시작했습니다.');

  const address = `http://${config.instanceIpv4}:${portNumber}/`;
  const message = `Your website: ${address}`;

  console.log('');
  console.log('='.repeat(message.length + 4));
  console.log(`= ${message} =`);
  console.log('='.repeat(message.length + 4));
}

StartDeploy().then(() => process.exit());
