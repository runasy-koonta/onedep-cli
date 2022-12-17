# OneDep
```text
커맨드 한 번으로 서비스를 배포할 수 있습니다.
```

![render1671265202476](https://user-images.githubusercontent.com/49000379/208233672-e54d5e6d-0899-4a77-b76c-b3f9e1dd2146.gif)


## OneDep-registry을 찾아오셨나요?
이 Repository는 OneDep 커맨드를 실행하는 CLI입니다.\
Registry 서버를 관리하는 OneDep-registry를 찾으신다면 [여기를](https://github.com/runasy-koonta/onedep-registry) 방문해주세요.

## Installation
### Requirements
- [Docker](https://docs.docker.com/install/)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html) (반드시 로그인되어 있어야 하고, EC2를 생성할 권한이 있어야 합니다.)

### Install
```bash
# Git repo를 clone합니다.
$ git clone https://github.com/runasy-koonta/onedep-cli.git

# OneDep을 설치합니다.
$ cd onedep-cli
$ npm install

# OneDep을 쉽게 실행할 수 있도록 합니다.
$ npm link
```

## Usage
아래 커맨드를 프로젝트 디렉토리에서 실행합니다.
```bash
$ onedep
```

### 주의 사항
실행 후 연결된 AWS 계정의 ap-northeast-2 (서울) 리전에 EC2 Instance가 생성됩니다.\
비용이 발생할 수 있으니 주의하세요.

## Roadmap
- [x] 템플릿을 제공해 Dockerfile을 쉽게 작성할 수 있게 합니다.
- [x] AWS EC2를 자동으로 생성하고 Docker를 셋업합니다.
- [x] 자동으로 Docker Image를 Build하고 Push합니다.
- [x] 자동으로 Docker Container를 생성하고 실행합니다.
- [ ] stdout를 모니터링해 Cloudwatch에 로그를 저장합니다.
- [ ] stdout를 모니터링해 Telegram 알림 등을 전송합니다.
- [ ] 한 서버에 여러 개의 서비스를 배포할 수 있게 합니다.
- [ ] Dockerfile을 Eject 할 수 있도록 합니다.
- [ ] AWS에 생성한 Instance, Security Group, Key Pair를 한번에 제거할 수 있도록 합니다.

## Contacts
- [Minjun Kang](https://github.com/runasy-koonta) ([minjun@kaaang.dev](mailto:minjun@kaaang.dev))
