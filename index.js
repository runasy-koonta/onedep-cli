#!/usr/bin/env node
import inquirer from "inquirer";
import fs from 'fs';

const _TEMPLATES = ['NodeJSWebApp', 'StaticWeb', 'PHP7'];

const StartDeploy = async () => {
  const templates = Object.fromEntries(_TEMPLATES.map((template) => [template, JSON.parse(fs.readFileSync(`./templates/${template}.json`).toString())]));

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

  console.log(response);
}

StartDeploy().then();
