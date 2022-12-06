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
}

StartDeploy().then();
