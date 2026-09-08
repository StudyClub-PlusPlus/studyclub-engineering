# 관측 스택 — 호스트 작업

설계는 [`specs/observability-stack/spec.md`](../specs/observability-stack/spec.md),
구현 계획은 [`specs/observability-stack/plan.md`](../specs/observability-stack/plan.md).

이 문서는 **레포 밖에서 해야 하는 작업**과 **구현 중 실제로 걸렸던 함정**을 다룬다.
스펙의 절반은 운영 호스트의 compose·리버스 프록시·DNS·인증서·GCP 콘솔에 의존하는데, 이건 레포에
커밋할 수 없는 파일들이다. 여기 적어두지 않으면 다음 사람이 재현할 수 없다.

**PUBLIC 레포다. 실제 IP·도메인 내부 구조·이메일·비밀번호를 적지 않는다.** `<도메인>` 같은
자리표시자를 쓰고, "무엇을 해야 하는지"만 적는다.

이 문서를 처음 읽는다면 아래 **["단계별로 올린다"](#단계별로-올린다)** 부터, 배포는 끝났는데
뭔가 이상하다면 맨 아래 ["증상 → 원인" 표](#증상--원인-빠른-진단) 부터 보면 된다.

## 이 PR 이 올리는 것 — 로그 경로

**한 번에 다 올리지 않는다.** 이 스택은 다른 프로젝트도 함께 사는 개인 머신에서 돌고, 지금까지의
검증은 전부 macOS Docker Desktop 에서 이뤄졌다. **운영 호스트에 실제로 배포된 적이 없다.**
그래서 가장 원하는 기능(로그 검색)만, 그리고 가장 적은 구성으로 먼저 올려서 **배포 자체가
되는지부터** 확인한다.

| | 컨테이너 | 얻는 것 |
|---|---|---|
| **이 PR** | grafana · loki · alloy | **로그 검색** — Grafana Explore 에서 requestId 로 한 요청 추적 |
| 후속 | + prometheus · node-exporter | 대시보드 · 알림 6개 · 디스크 감시 |
| 후속 | (추가 없음) | 서비스 지표(가입·스터디 수) |

대시보드도 일부러 안 넣었다. 로그 검색의 핵심은 **Explore** 이고, 대시보드는 편의 기능이다.

## 운영 호스트에 어떻게 올리나

**⚠️ 이 레포는 운영 호스트에 clone 되어 있지 않다.** 배포는 GitHub Actions 가 Docker 이미지를
push 하고 SSH 로 호스트의 배포 스크립트를 부르는 구조라, **레포 파일이 호스트로 가지 않는다.**
그래서 `docker compose -f docker-compose.observability.yml ...` 처럼 이 레포의 파일을 참조하는
명령은 호스트에서 쓸 수 없다.

대신 **`docker-compose.observability.yml` 의 내용을 호스트의 기존 compose 에 붙여넣는다.**
설정 파일(loki·alloy·Grafana 데이터소스)을 bind mount 하지 않고 compose 안에 인라인(`configs:`)
해 둔 것이 이 때문이다 — **호스트에 따로 놓아야 할 파일이 0개다.**

붙여넣을 것은 셋이다. 각각 호스트 compose 의 같은 이름 최상위 키에 합친다:

1. **`configs:`** — 3개(loki_config · alloy_config · grafana_datasource_loki) 통째로
2. **`services:`** — `loki` · `alloy` · `grafana` 세 서비스 통째로. 그리고 **기존 `api` 서비스에**
   이 파일의 `api:` 블록 내용(env 3개 · 볼륨 1개 · logging 로테이션)을 **합쳐 넣는다**
3. **`volumes:`** — 4개(`studyclub-applog` · `alloy-data` · `loki-data` · `grafana-data`)

`api` 는 별도 서비스가 아니라 **기존 서비스에 더하는 것**이다. 이걸 새 서비스로 붙이면 image 가
없어 compose 가 거부한다.

**로그 로테이션(`logging.options`)을 빠뜨리지 않는다.** docker 의 json-file 기본 로테이션은
**무제한**이라, 이 설정 없이는 컨테이너 stdout 만으로도 디스크가 찬다.

## 첫 배포는 SSH 터널로 확인한다

Grafana 는 `127.0.0.1:3000` 에만 바인딩된다. **DNS·인증서·리버스 프록시·GCP 콘솔 작업 없이도**
배포가 됐는지 확인할 수 있다:

```bash
ssh -L 3000:127.0.0.1:3000 <호스트>
# 로컬 브라우저에서 http://localhost:3000 → admin / GRAFANA_ADMIN_PASSWORD
```

구글 로그인은 기본이 **꺼짐**(`GRAFANA_GOOGLE_ENABLED` 미설정)이라 이 단계에서 GCP 설정이
필요 없다. **서브도메인을 인터넷에 여는 것은 그다음이고, 그때 반드시 켠다** (아래
"구글 로그인 allowlist").

### 단계 구성에서 알아둘 것 (구현 중 실측)

**provisioning 을 디렉토리가 아니라 개별 파일로 마운트한다.** compose 의 `volumes:` 목록이 곧
"지금 Grafana 에 올라와 있는 것"이다. 디렉토리를 `:ro` 로 통마운트하면 그 안에 파일을 겹쳐
마운트할 수 없어서(마운트포인트를 만들지 못한다) 단계를 쌓을 수 없다.

**기본 데이터소스(`isDefault`)는 `loki.yml` 하나만 갖는다.** 둘 이상이면 Grafana 는
`Only one datasource per organization can be marked as default` 로 **기동 자체를 거부한다**
(crash-loop). 단계가 올라가도 기본값은 Loki 로 남는다 — 대시보드는 데이터소스를 uid 로 참조하므로
기본값이 무엇이든 동작에 영향이 없다.

**되돌리기는 앞으로만 간다.** 후속 PR(메트릭)을 올린 뒤 이 구성으로 되돌려도 **이미 provisioning 된
데이터소스와 알림은 사라지지 않는다** — Grafana DB(`grafana-data` 볼륨)에 남는다. 대시보드만
provider 설정 때문에 지워진다. 정말로 되돌리려면 `grafana-data` 볼륨을 지우고 다시 올려야 한다
(설정은 전부 파일에서 오므로 안전하다 — 다만 Grafana 사용자 계정·개인 설정은 같이 사라진다).

## 순서가 중요하다

1. **먼저** 리버스 프록시·외부 모니터가 보고 있는 헬스체크 경로를 `/actuator/health` →
   `/api/health` 로 바꾼다
2. **그다음** actuator 를 관리 포트(9090)로 분리한 api 를 배포한다

순서가 뒤집히면 그 사이 헬스체크가 계속 404 를 맞는다 — `/actuator/health` 는 더 이상 앱 포트에
없고, 관리 포트는 아직 컨테이너 네트워크 밖으로 안 나가기 때문이다.

## 1. 헬스체크 경로 변경

```bash
grep -rn "actuator" /etc/nginx/ 2>/dev/null
```

찾은 곳을 `/api/health` 로 바꾼다. 이 경로는 이미 앱 포트(관리 포트 분리 이전)에도 있었고,
분리 이후에도 계속 앱 포트에 남는다 — 리버스 프록시·로드밸런서용으로 의도적으로 그렇게 만들었다.

## 2. DNS · 인증서 · 프록시 (외부 공개 시)

- `grafana.<도메인>` A 레코드 추가
- **인증서 SAN 목록에 위 도메인을 추가한다** — 현재 인증서는 와일드카드가 아니라 도메인을
  나열한 멀티 SAN 이다. 갱신 자동화 설정에도 수동으로 넣어야 다음 갱신 때 빠지지 않는다
- 프록시에 vhost 추가 → `127.0.0.1:3000` (Grafana 가 호스트에 여는 유일한 포트)

## 3. GCP 콘솔 (외부 공개 시)

OAuth 클라이언트의 승인된 리디렉션 URI 에 `https://grafana.<도메인>/login/google` 을 추가한다.
**배포 전 반드시 등록** — 빠지면 구글 로그인 시도가 `redirect_uri_mismatch` 로 실패한다.

## 4. 호스트 `.env`

다음 값을 채운다 — 로컬 `.env.example` 의 더미를 강한 값으로 덮어쓰는 것이다:

| 변수 | 비고 |
|---|---|
| `GRAFANA_ROOT_URL` | `https://grafana.<도메인>` — OAuth 리다이렉트가 이 값을 기준으로 계산된다 |
| `GRAFANA_ADMIN_PASSWORD` | `openssl rand -base64 32`. **비워두면 compose 렌더가 거부되어 스택 자체가 안 뜬다**(아래 참고) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 로컬은 둘 다 빈 값. 채우지 않으면 구글 로그인 버튼이 항상 실패한다 |
| `GRAFANA_ALLOWED_EMAILS` | 구글 로그인 allowlist. 로컬은 빈 값 |
| `DISCORD_WEBHOOK_URL` | 알림 싱크. 비우면 안 된다(아래 "알림이 실제로 가는지" 참고) |
| `GRAFANA_DB_USER` / `GRAFANA_DB_PASSWORD` | 아래 읽기 전용 계정 |

**`GRAFANA_ADMIN_PASSWORD` 가 비어 있으면 compose 가 스택을 아예 기동하지 않는다.** 로컬
개발 중간에 이 값을 빈 채로 뒀다가 실제로 렌더 실패를 겪었고, 그래서 compose 파일에
`:?...` 필수값 가드를 넣었다 — 의도된 동작이다. "설정을 깜빡했다" 를 조용히 넘어가는 대신
스택이 안 뜨는 쪽으로 fail-fast 하게 만든 것이니, 에러 메시지를 보고 값만 채우면 된다.

읽기 전용 DB 계정을 만든다 — Grafana 는 자기 로그와 DB 조회 권한을 동시에 들고 있어서, 쓰기
권한까지 주면 뚫렸을 때 피해 범위가 커진다:

```sql
CREATE USER 'grafana_ro'@'%' IDENTIFIED BY '<강한 값>';
GRANT SELECT ON <db>.* TO 'grafana_ro'@'%';
```

## 5. 절대 지우면 안 되는 볼륨

| 볼륨 | 지우면 |
|---|---|
| `studyclub-applog` | api 가 쓰고 Alloy 가 읽는 큐다. **아카이브가 아니다** — Alloy 가 아직 Loki 로 밀어넣지 못한 구간의 로그가 그대로 사라진다 |
| `alloy-data` | Alloy 의 파일 읽기 위치(positions)가 사라진다 → 재기동 시 파일을 처음부터 다시 읽어 로그가 Loki 에 **중복 적재**된다 |
| `loki-data` | Loki 가 보관 중인 최대 30일치 로그 아카이브가 사라진다 |

`docker compose down` 은 안전하다(볼륨을 유지한다). **`down -v` 를 쓰지 않는다.**

실제 볼륨 이름은 compose 프로젝트 이름이 접두어로 붙는다 — 프로젝트 이름이 `studyclub` 이면
`studyclub_studyclub-applog` / `studyclub_alloy-data` / `studyclub_loki-data` 식이다
(`docker volume ls` 로 확인).

**node_exporter 는 호스트 `/` 와 `/proc` 를 읽기 전용으로 마운트한다** (디스크 잔량 수집용,
`spec.md` 참조). 이 호스트에 다른 프로젝트가 함께 떠 있다면, 그 프로젝트가 기본 퍼미션
(0644)으로 남긴 `.env` 같은 파일이 world-readable 이라 node-exporter 컨테이너에서도 읽힌다 —
다른 프로젝트의 시크릿 파일은 `chmod 600` 으로 조여둔다.

## 6. 올린 뒤 확인

```bash
docker compose ps
curl -s -o /dev/null -w "%{http_code}\n" https://api.<도메인>/api/health          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://api.<도메인>/actuator/health     # 200 이 아니어야 한다
docker system df -v | grep -E 'studyclub-applog|loki-data|alloy-data'
```

마지막 줄로 볼륨 크기가 예상 범위(앱 로그 파일은 로테이션 상한 내, Loki 는 30일치)인지
주기적으로 본다.

체크리스트만으로는 안 끝난다 — 아래 세 가지는 "떠 있다" 와 "제대로 동작한다" 가 다른
경우들이라 반드시 별도로 확인해야 한다:

- [ ] Grafana 를 열어 **"로그 탐색" 대시보드**에 실제로 로그가 그려지는지 본다 (설정 파일만 보고
      판단하지 않는다 — 아래 "설정을 바꿔도 반영되지 않는다" 참고)
- [ ] **requestId 로 한 요청을 꿰어본다** — 아무 요청이나 보내 응답 헤더의 `X-Request-Id` 를
      얻고, Grafana Explore 에서 `{service="studyclub-api"} | json | requestId = "<값>"`
      로 그 요청의 로그만 나오는지 확인한다. **이게 이 PR 의 존재 이유다.**
- [ ] 구글 계정 2개(허용 목록 안/밖)로 실제 로그인해본다 (아래 "구글 로그인 allowlist" 참고)

---

## 운영 중 알아야 하는 것

아래는 "설정은 맞는데 조용히 동작하지 않는" 종류의 함정들이다. 구현 중 실제로 겪은 것들이고,
겪지 않으면 문서 없이는 원인을 찾기 어렵다.

### 설정을 바꿔도 반영되지 않는다

**설정을 고치고 `docker compose up -d` 만 돌리면 반영되지
않는다.** 실제로 겪은 경우: Loki 데이터소스를 `datasources.yml` 에 추가하고 커밋까지 했는데,
Grafana 에는 여전히 Prometheus 데이터소스만 있었다.

원인은 두 가지가 겹친다:

1. bind-mount 로 물린 설정 파일의 **내용**이 바뀌어도 Compose 의 config hash 는 바뀌지 않는다
   — `docker compose up -d` 는 "이 서비스 정의가 이전과 같다" 고 판단해 컨테이너를 그대로 둔다.
2. Grafana 는 provisioning 디렉터리를 **기동 시에만** 읽는다. 이미 떠 있는 컨테이너는 파일이
   바뀌어도 알아채지 못한다.
3. **compose 안에 인라인한 `configs:` 도 마찬가지다.** 내용을 바꿔도 컨테이너가 재생성되지
   않는다(실측 — 내용만 바꾸고 `up -d` 했더니 컨테이너 ID 가 그대로였다). bind mount 를
   없앴다고 이 함정이 사라지지 않는다.

**대응**: compose 의 `configs:` 내용이나 Grafana 설정을
바꾼 뒤에는 반드시 해당 컨테이너를 강제로 재생성한다.

```bash
# 로컬(3파일 병합):
docker compose -f docker-compose.yml -f docker-compose.observability.yml \
  up -d --force-recreate grafana loki alloy

# 운영(관측 스택 단독):
docker compose -f docker-compose.observability.yml up -d --force-recreate grafana
```

**그리고 확인은 파일이 아니라 Grafana/Prometheus 자체를 통해 한다.** "커밋한 파일 내용이
맞다" 는 "떠 있는 컨테이너가 그 파일을 읽었다" 를 증명하지 않는다. 예: 데이터소스가 실제로
등록됐는지는 `curl -u admin:$PW http://localhost:3000/api/datasources` 로, Loki 데이터가
실제로 조회되는지는 Grafana 의 데이터소스 프록시(`/api/datasources/proxy/uid/loki/...`)로
확인한다 — Loki 포트를 직접 두드리는 것으로는 "Grafana 가 실제로 그 데이터소스를 쓰는지"를
증명하지 못한다.

### Grafana 에서 대시보드/알림을 고쳤을 때

Grafana 13.2 의 "Export as code" 기능은 **기본값이 `dashboard.grafana.app/v2` (k8s 리소스)
스키마**다. 이 스키마는 이 스택이 쓰는 file provisioner 가 기대하는 고전(classic) 스키마와
다르다 — v2 스키마로 export 한 JSON을 그대로 커밋하면 provisioning 이 그 파일을 읽지 못한다
(실측: 대시보드 export 시 실제로 이 문제에 부딪혔다).

**대시보드**를 export 할 때는 "Model: Classic" 라디오 버튼을 **명시적으로** 선택해야 한다.
기본 선택이 아니므로 매번 확인이 필요하다.

**알림 규칙**은 export 다이얼로그 자체에 Classic/v2 선택지가 없다 — JSON/YAML/Terraform
탭만 있고, YAML 탭이 이미 이 스택이 쓰는 file-provisioning 포맷과 같다. 즉 알림 규칙은
export 할 때 별도로 신경 쓸 옵션이 없다(대시보드와 다른 부분이므로 헷갈리지 않도록 남긴다).

그리고 UI 에서 대시보드나 알림을 고친 뒤 **export 해서 레포에 커밋하지 않으면**, 그 변경은
`grafana-data` 볼륨에만 남는다 — 볼륨이 사라지거나(재해 복구, 호스트 교체) 컨테이너가
파일에서 재프로비저닝되는 순간 조용히 사라진다. "Grafana에서 잘 보이길래 끝났다고 생각했는데
다음 배포 후 사라졌다" 의 원인은 대부분 이거다.

### 구글 로그인 allowlist

- `GF_AUTH_GOOGLE_SKIP_ORG_ROLE_SYNC: "false"` 가 **반드시 명시되어 있어야** allowlist(역할
  매핑)가 실제로 평가된다. **왜**: Grafana 13.2.1 이미지의 `[auth.google]` 커넥터는
  `skip_org_role_sync` 기본값이 유일하게 `true` 다(같은 이미지의 다른 모든 OAuth 커넥터는
  기본값이 `false`). 이 값이 꺼져 있지 않으면 `role_attribute_path`/`role_attribute_strict`
  설정이 통째로 무시되고, **구글 계정만 있으면 누구나 자동으로 Viewer 로 로그인된다** — 이건
  mock OIDC 로 실제로 재현된 결과다(비allowlist 이메일 로그인이 성공해 Viewer 계정이
  생성됨). 그리고 Grafana는 기동 로그에 이에 대한 경고를 전혀 남기지 않는다 — 조용히 잘못된
  방향으로 동작한다. 이 값을 되돌리거나 지우면 이 문제가 그대로 재발한다.
- 로그인 폼(사용자명/비밀번호)은 의도적으로 살려뒀다(break-glass). OAuth 설정이 어긋나
  아무도 로그인 못 하는 상황에서도 관리자가 들어갈 길을 남기기 위해서다. `GRAFANA_ADMIN_PASSWORD`
  가 바로 그 두 번째 진입로이므로, 위 5절에서 이 값을 반드시 강한 값으로 채워야 한다.
- 구글로 로그인한 사용자의 role 은 매 로그인마다 재평가되는 externally-synced 값이라 Grafana
  UI 에서 수동으로 바꿀 수 없다. 특정 사용자의 권한을 바꾸려면 `GRAFANA_ALLOWED_EMAILS`
  (allowlist) 를 고쳐야 한다 — 이건 실수가 아니라 의도된 동작이다.
- **운영 배포 후 실제 구글 계정 2개(allowlist 안에 있는 계정 1개, 없는 계정 1개)로 로그인을
  한 번 더 확인한다.** 로컬 검증은 실제 구글 OAuth 가 아니라 mock OIDC 서버로 했으므로,
  운영의 실제 구글 로그인 플로우 자체는 아직 실측되지 않았다.

## 후속 PR 에서 들어오는 것 (메트릭·알림)

아래 두 절은 **이 PR 에 없는 기능**에 대한 것이다. 구현·검증은 이미 끝났고 후속 PR 로 들어오는데,
거기서 실측된 함정들이라 지금 옮겨 적어둔다 — 후속이 미뤄지더라도 이 지식이 사라지지 않게.

### 알림이 진짜로 가는지 확인한다

`DISCORD_WEBHOOK_URL` 을 절대 비워두지 않는다. 하지만 기본값(`http://localhost:0/...`,
전송이 실패하도록 만든 더미)이 채워져 있다는 사실 자체가 새로운 함정을 만든다.

- **왜 더미가 필요한가**: contact point 의 url 이 빈 문자열이면 Grafana 는 provisioning
  단계에서 **프로세스 전체가 죽는다** — alerting 뿐 아니라 대시보드까지 같이 내려간다
  (실측). `restart: unless-stopped` 아래에서 이건 한 번 죽고 끝나는 게 아니라 기동 실패 →
  재시작 → 다시 기동 실패가 반복되는 **크래시 루프**가 된다. 그래서 웹훅이 아직 없는
  환경에서도 기동은 되도록 형식만 갖춘 더미를 기본값으로 뒀다.
- **그 대가**: "웹훅을 아직 안 만들었다" 와 "웹훅은 있는데 알림이 안 울렸다(정상)" 이 겉보기로
  구분되지 않는다. 둘 다 "Discord 에 아무것도 안 옴" 으로 보인다.

그래서 배포 직후 다음이 **필수 절차**다:

1. **contact point 테스트 발송으로 실제 Discord 채널에 도착하는지 확인한다.** 가장 안정적인
   경로는 Grafana UI — Alerting → Contact points → 해당 contact point 의 **Test** 버튼이다.
   버전에 상관없이 동작한다.

   스크립트로 자동화하려면 아래 API 를 쓴다(**Grafana 13.2.1 에서 실제로 호출해 검증함** —
   `/api/v1/provisioning/contact-points/{uid}/test` 같은 예전 경로는 이 버전에서 **404** 다.
   테스트용 API 경로가 버전마다 바뀌어왔으므로, 아래가 안 먹으면 위 UI 경로를 쓴다):

   ```bash
   curl -s -u admin:"$GRAFANA_ADMIN_PASSWORD" -X POST \
     "https://grafana.<도메인>/apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/receivers/-/test" \
     -H "Content-Type: application/json" \
     -d "{\"integration\":{\"type\":\"discord\",\"version\":\"v1\",\"settings\":{\"url\":\"$DISCORD_WEBHOOK_URL\",\"use_discord_username\":true}},\"alert\":{\"labels\":{\"alertname\":\"obs-verify\"},\"annotations\":{\"summary\":\"deploy smoke test\"}}}"
   ```

   응답이 `{"status":"success",...}` 면 실제로 Discord 에 도착한 것이다. `{"status":"failure",
   "error":"..."}` 면 그 `error` 내용을 본다 — **이 응답 자체가 "엔드포인트는 동작했고 실제로
   전송을 시도했다" 는 증거**라는 게 핵심이다(HTTP 200으로 온다. 실패 신호는 상태 코드가
   아니라 body 의 `status` 필드다). 더미 URL(`http://localhost:0/...`)에 대고 쏘면
   `dial tcp [::1]:0: connect: connection refused` 류 에러가 오는데, 이건 정상이다 — 더미가
   아직 안 바뀌었다는 뜻이지 API 가 고장났다는 뜻이 아니다. 반대로 이 명령이 **404** 를
   내면(엔드포인트 자체가 없다는 뜻) 그건 이 문서가 검증한 버전과 다른 Grafana 를 쓰고
   있다는 신호이니 UI Test 버튼으로 대체한다.
2. 저비용 스모크로 `docker compose logs grafana | grep -i discord` 를 본다 — connection
   refused 계열 에러가 보이면 웹훅이 아직 더미인 채라는 신호다.

### 디스크 알림의 mountpoint — 운영에서 재확인 필수

`disk-low` 알림과 디스크 대시보드는 `mountpoint="/"` 로 커밋되어 있다. **이 값은 로컬에서
한 번도 실데이터로 검증되지 못했다** — macOS Docker Desktop 은 컨테이너에 `/` 자체를 다른
형태로 노출해서, node_exporter 가 실제로 보고한 마운트포인트는 `/`가 아니라 `/var/lib` 였다
(리눅스 운영 호스트에서는 이 문제가 없을 것으로 예상되지만, 예상일 뿐 실측은 아니다).

`mountpoint="/"` 로 커밋한 근거: node_exporter 를 `--path.rootfs=/host` 로 호스트 루트를
마운트해 실행하므로, 리눅스 운영 호스트에서는 호스트의 실제 `/` 파티션이 `/`라는 라벨로
보고될 것으로 예상된다. 로컬(Docker Desktop VM)에서만 `/`가 다르게 잡히는 것이지, 쿼리
형태 자체는 `mountpoint="/var/lib"`로 바꿔 로컬에서 정상 동작을 확인했다.

**운영 배포 직후 확인 절차:**

```bash
# 호스트에서 실제 루트 파일시스템 타입 확인
df -T /

# Prometheus 가 실제로 갖고 있는 mountpoint 라벨 값 목록
# (Prometheus 는 호스트에 포트를 열지 않으므로 Grafana 의 데이터소스 프록시를 통해 조회한다)
curl -s -u admin:$GRAFANA_ADMIN_PASSWORD \
  "https://grafana.<도메인>/api/datasources/proxy/uid/prometheus/api/v1/label/mountpoint/values"
```

목록에 `/`가 있으면 그대로 둔다. 없으면 대시보드 JSON과 알림 규칙의 `mountpoint="/"` 를
실제 값으로 바꿔서 커밋한다.

**가장 중요한 경고**: 배포 후 `disk-low` 알림이 `DatasourceNoData` 상태로 계속 뜬다면, 그건
**mountpoint 라벨이 틀렸다는 신호이지 알림을 끄라는 뜻이 아니다.** 여기서 `noDataState` 를
`OK` 로 바꾸면 겉보기엔 "정상"이 되지만 실제로는 **디스크 알림이 조용히 아무것도 감시하지
않는 상태**가 된다 — 그리고 이 상태는 "알림이 없는 것" 보다 나쁘다. 알림이 아예 없으면 최소한
사람이 수동으로 디스크를 확인해야 한다는 걸 알지만, `noDataState: OK` 인 알림은 감시되고
있다는 착각을 준다. 원인(mountpoint 불일치)을 고치는 것이 유일하게 맞는 대응이다.


## 증상 → 원인 빠른 진단

| 증상 | 원인 | 조치 |
|---|---|---|
| 대시보드/데이터소스를 고쳤는데 Grafana 에 안 보인다 | provisioning 파일은 기동 시에만 읽힌다. `up -d`는 내용 변경만으로는 컨테이너를 재생성하지 않는다 | 해당 컨테이너 `--force-recreate`, 확인은 Grafana API/UI로 |
| Prometheus 스크랩 설정을 고쳤는데 안 먹는다 | `--web.enable-lifecycle` 이 없어 HTTP 리로드가 불가능 | Prometheus 컨테이너 `--force-recreate` |
| Discord 에 알림이 하나도 안 온다 | 웹훅 URL 이 더미 상태이거나 오타 | contact point Test 버튼으로 실제 발송 확인, 로그의 `discord` 관련 에러 확인 |
| `disk-low` 알림이 계속 `DatasourceNoData` | `mountpoint="/"` 라벨이 실제 Prometheus 라벨과 다름 | `df -T /` + Prometheus 라벨 목록 조회로 실제 값 확인 후 규칙 수정. **`noDataState`를 `OK`로 바꾸지 않는다** |
| 구글 계정만 있으면 비허용 이메일도 Viewer 로 로그인된다 | `GF_AUTH_GOOGLE_SKIP_ORG_ROLE_SYNC`가 없거나 `true` | `"false"`로 명시 후 grafana 재생성 |
| Grafana UI 에서 고친 대시보드/알림이 다음 배포 후 사라졌다 | export 해서 레포에 커밋하지 않아 `grafana-data` 볼륨에만 있었다 | Export → Classic model(대시보드) 또는 YAML(알림) → 레포에 커밋 |
| 배포 직후 `/api/health` 가 잠깐 404 | 헬스체크 경로 전환보다 api 배포가 먼저 나감 | [순서](#순서가-중요하다)대로: 프록시 경로 전환 → api 배포 |
| 재기동 후 로그가 Loki 에 중복 적재됨 | `alloy-data` 볼륨이 삭제되어 positions 소실 | 복구 불가 — 앞으로 `down -v` 를 쓰지 않는다 |
