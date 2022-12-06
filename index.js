#!/usr/bin/env node
import inquirer from "inquirer";
import loading from 'loading-cli';

import fs from 'fs';

import { generateDockerFileFromArray } from 'dockerfile-generator/lib/dockerGenerator.js';
import { Docker } from 'node-docker-api';
import tar from 'tar-fs';

import path from 'path';
import { fileURLToPath } from 'url';

const _TEMPLATES = ['NodeJSWebApp', 'StaticWeb', 'PHP7'];

const promisifyStream = stream => new Promise((resolve, reject) => {
  stream.on('end', resolve)
  stream.on('error', reject)
});

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

  const templates = Object.fromEntries(_TEMPLATES.map((template) => [template, JSON.parse(fs.readFileSync(path.join(__dirname, 'templates', `${template}.json`)).toString())]));

  const response = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: '배포할 프로젝트 명을 입력하세요.',
    },
    {
      type: 'list',
      name: 'platform',
      message: '배포할 코드의 플랫폼을 선택하세요.',
      choices: Object.values(templates).map((template) => template.name),
    },
  ]);

  const selectedPlatform = Object.entries(templates).find((template) => template[1].name === response.platform)[1];

  let responses = {
    ...response,
  };

  if (selectedPlatform.custom_args) {
    const customArgs = await inquirer.prompt(Object.entries(selectedPlatform.custom_args).map(([argName, message]) => ({
      type: 'input',
      name: argName,
      message,
    })));

    responses = {
      ...responses,
      ...customArgs,
    }
  }

  const dockerfile = ReplaceDockerfileArgs(selectedPlatform.Dockerfile, responses);
  const generatedDockerfile = generateDockerFileFromArray(dockerfile);

  const docker = new Docker();

  const pack = tar.pack(process.cwd());
  pack.entry({ name: 'Dockerfile' }, generatedDockerfile);

  const load = loading("Docker Image를 빌드하는 중...");
  load.start();
  await docker.image.build(pack).then(stream => promisifyStream(stream));
  load.stop();
}

StartDeploy().then();
