# Gates OCI single-instance Terraform starter

`gates` 앱을 **OCI Always Free 인스턴스 1대**에 올려서 외부에서 접근 가능한 상태로 띄우기 위한 Terraform 구성입니다.

이 구성은 `riches`의 `infra/oci-instance` 패턴을 가져오되, `gates`에 맞게 아래를 추가했습니다.

- OCI 네트워크 + 퍼블릭 인스턴스 생성
- 인스턴스 부팅 시 `gates` 저장소 clone
- 인스턴스 안에서 Docker 이미지 빌드
- `GOOGLE_OAUTH_CLIENT_ID`를 env 파일로 주입
- 컨테이너를 `service_port`로 외부 노출

## 포함 리소스
- VCN 1개
- Public subnet 1개
- Internet Gateway 1개
- Route Table 1개
- Security List 1개
- Compute Instance 1대

기본값은 **Always Free 친화적**으로 잡아두었습니다.

- Shape 기본값: `VM.Standard.A1.Flex`
- A1 용량 부족 시 fallback 예시: `VM.Standard.E2.1.Micro`
- A1 사용 시 권장 스펙: `1 OCPU / 6 GB RAM`
- Boot volume: `50 GB`
- OS 기본값: `Oracle Linux 9`

## 사전 준비

### 1. OCI API Key 준비
Terraform provider 인증을 위해 아래 값이 필요합니다.

- `tenancy_ocid`
- `user_ocid`
- `fingerprint`
- `private_key_path`
- `region`
- `compartment_ocid`
- `availability_domain`

### 2. SSH public key 준비
인스턴스 접속용 공개키 파일 경로가 필요합니다.

예: `~/.ssh/id_ed25519.pub`

### 3. Google OAuth Client ID 준비
`gates` 앱은 브라우저에서 Google OAuth를 시작하므로 아래 값이 필요합니다.

- `google_oauth_client_id`

### 4. tfvars 파일 생성
```bash
cd infra/oci-instance
cp terraform.tfvars.example terraform.tfvars
```

### 5. 경로 규칙 확인
Dockerized Terraform 기준으로 예제 경로는 아래처럼 잡혀 있습니다.

- OCI API key: `/root/.oci/...`
- SSH public key: `/root/.ssh/...`

이유는 `make tf-validate`와 예시 `terraform apply` 명령이 호스트의 `$HOME/.oci`, `$HOME/.ssh`를 컨테이너 내부 `/root/...`로 마운트하기 때문입니다.

만약 **로컬 Terraform 바이너리**로 직접 실행할 경우에는 이 경로를 본인 로컬 경로로 바꿔주세요.

## 사용 방법

### 1. 값 채우기
`terraform.tfvars`에 본인 환경값을 입력하세요.

특히 다음 값은 반드시 수정하세요.
- `tenancy_ocid`
- `user_ocid`
- `fingerprint`
- `private_key_path`
- `region`
- `compartment_ocid`
- `availability_domain`
- `ssh_public_key_path`
- `google_oauth_client_id`

### 2. 포맷
```bash
make tf-fmt
```

### 3. validate
```bash
make tf-validate
```

### 4. apply
```bash
docker run --rm \
  -v "$(pwd):/workspace" \
  -v "$HOME/.oci:/root/.oci:ro" \
  -v "$HOME/.ssh:/root/.ssh:ro" \
  -w /workspace/infra/oci-instance \
  hashicorp/terraform:1.11.4 apply
```

## 부팅 후 앱 배포 방식
인스턴스가 뜨면 cloud-init이 아래 순서로 동작합니다.

1. `git`, `docker` 설치
2. `gates` 저장소 clone
3. 지정한 `app_git_ref` checkout
4. Docker 이미지 build
5. `GOOGLE_OAUTH_CLIENT_ID`를 넣은 env 파일로 컨테이너 실행

기본 외부 포트는 `80`, 컨테이너 내부 포트는 `8080`입니다.

## 출력값
성공하면 다음 output을 확인할 수 있습니다.

- `instance_public_ip`
- `instance_private_ip`
- `service_origin`
- `healthcheck_url`
- `oauth_origin_hint`
- `ssh_command`
- `deploy_command_hint`

예를 들어:

```bash
curl http://<instance_public_ip>/healthz
```

## SSH 접속 후 재배포
기본 OS가 Oracle Linux이므로 기본 유저는 `opc`입니다.

```bash
ssh -i ~/.ssh/<private-key> opc@<instance_public_ip>
sudo /usr/local/bin/deploy-gates.sh
```

이 명령은 인스턴스 안에서 다시 저장소를 checkout/build/run 합니다.

## Google OAuth 관련 주의사항
이 starter는 우선 **OCI에서 앱을 띄우고 health check / 브라우저 접근이 되는지** 확인하는 데 초점을 둡니다.

다만 실제 Google 로그인 운영에서는 아래를 꼭 고려해야 합니다.

- OAuth `Authorized JavaScript origins`에 `oauth_origin_hint` 값을 추가해야 합니다.
- 장기 운영용으로는 **도메인 + 정상 TLS(신뢰된 인증서)** 구성이 더 안전합니다.
- 현재 starter는 단일 퍼블릭 인스턴스 중심이므로, 이후 단계에서 reverse proxy / load balancer / HTTPS 자동화가 필요할 수 있습니다.

## 참고 / 주의사항
- Always Free 리소스는 보통 **home region** 기준으로 사용해야 무료 범위에 잘 맞습니다.
- `VM.Standard.A1.Flex`는 **ARM**입니다.
- A1 용량 부족 시 `out of host capacity`가 날 수 있습니다. 이 경우 AD를 바꾸거나 잠시 후 재시도하세요.
- `terraform.tfvars`는 민감 정보가 있으므로 git에 커밋하지 마세요.
