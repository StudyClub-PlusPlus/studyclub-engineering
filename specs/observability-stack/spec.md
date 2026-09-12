# 로그·메트릭 관측 스택 — Grafana 단일 창구

## WHAT

운영 백엔드(`studyclub-api`)의 **로그와 메트릭을 Grafana 한 곳으로 모으고**, 운영자가 서버에 SSH 하지
않고 브라우저에서 장애를 추적할 수 있게 한다. 지금은 로그를 보려면 호스트에 SSH 해서
`docker compose logs` 하는 방법밖에 없고, 메트릭은 수집 지점 자체가 없다.

달성 목표 네 가지:

1. **장애 원인 추적** — 에러 로그를 검색·필터하고, `requestId` 로 한 요청이 남긴 로그 전부를 꿰어본다
2. **서버 건강상태** — 요청률·에러율·응답시간(RED), JVM 힙/GC, DB 커넥션풀, 디스크 잔량
3. **장애 알림** — api 다운·5xx 급증·응답지연·디스크 부족 시 Discord 로 통보
4. **서비스 지표** — 일별 가입/스터디 개설/신청 (계측 코드 없이 MySQL 직접 쿼리)

**대상은 `studyclub-api` 컨테이너 하나**다. MySQL·프론트엔드·호스트 CPU/메모리는 이번 범위 밖이며,
나중에 compose 에 exporter 를 몇 줄 추가하면 붙도록 구조를 잡는다(디스크만 예외 — 아래 참조).

관측 스택은 **백엔드가 도는 그 호스트에 같이 올리고, 구성은 이 레포가 정본**이다.

## HOW

### 전체 그림

```
┌─ 배포 호스트 ───────────────────────────────────────────────┐
│                                                             │
│  studyclub-api                                              │
│    :8080  앱          ← 리버스 프록시가 밖으로 노출          │
│    :9090  actuator    ← publish 안 함. Prometheus 만 접근    │
│      │                                                      │
│      ├── 콘솔: 사람이 읽는 텍스트 (docker logs 용)           │
│      └── 파일: ECS JSON ──▶ [공유 볼륨] ──▶ Alloy ──▶ Loki ─┐│
│                                                            ││
│  node_exporter ─┐                                          ││
│                 ├──▶ Prometheus ──────────────────────┐    ││
│  api :9090 ─────┘                                     ▼    ▼│
│                                                     Grafana │
│  MySQL ────────────────────────────────────────────▶ :3000  │
│         (서비스 지표. 읽기 전용 계정)                  │      │
│                                        127.0.0.1 바인딩     │
└────────────────────────────────────────────────────────┼────┘
                                                         │
                            리버스 프록시 (TLS) ─────────┘
                                     │
                                     ▼
                    grafana.studyclub-plusplus.com
                       구글 로그인 · 이메일 allowlist
                                     │
                                     └──▶ Discord (알림)
```

**밖으로 열리는 구멍은 Grafana 하나뿐이다.** Loki·Prometheus·Alloy·node_exporter·actuator 는 전부
포트를 호스트에 publish 하지 않고 컨테이너 네트워크 안에서만 산다.

### 관측 스택 — `docker-compose.observability.yml` (신설)

| 서비스 | 이미지 | 포트 publish | 볼륨 | 역할 |
|---|---|---|---|---|
| grafana | `grafana/grafana` | `127.0.0.1:3000:3000` | 데이터 | 유일한 창구 |
| loki | `grafana/loki` | 없음 | 데이터 | 로그 저장 (30일) |
| prometheus | `prom/prometheus` | 없음 | 데이터 | 메트릭 저장 (15일 / 2GB) |
| alloy | `grafana/alloy` | 없음 | 공유 로그 볼륨(ro) + **positions** | 로그 운반 |
| node_exporter | `prom/node-exporter` | 없음 | 호스트 `/` (ro) | 디스크 잔량 |

기존 `docker-compose.yml`(로컬 개발 스택)과 **파일을 분리한다.** 로컬에서 `docker compose up` 할 때
관측 스택까지 같이 뜨면 무겁고, 로컬에서 굳이 필요하지도 않다. 필요하면
`docker compose -f docker-compose.yml -f docker-compose.observability.yml -f docker-compose.observability.api.yml up`
으로 같이 올린다.

`api:` 오버라이드(로그 파일 출력·관리 포트)는 별도 파일 `docker-compose.observability.api.yml`
로 둔다 — image/build 가 없는 오버레이 전용 블록이라, `docker-compose.observability.yml` 에
같이 두면 그 파일이 운영에서 단독으로 렌더되지 않는다(운영은 grafana/prometheus/loki/alloy/
node-exporter 만 이 레포의 compose 로 띄우고, api 쪽 변경은 호스트 compose 에 수동으로 옮겨
심는다 — "사람이 해야 하는 작업" 참조).

**로그 운반은 Alloy + 공유 볼륨 파일 방식이다.** docker socket 을 마운트하지 않는다.

- Alloy 에 `/var/run/docker.sock` 을 물리는 방식이 흔하지만, docker socket 접근은 사실상 호스트 root
  권한이다. 로그 한 컨테이너를 읽자고 낼 대가가 아니다.
- 앱이 `loki-logback-appender` 로 직접 push 하는 방식은 **외부 라이브러리 추가**(AGENT.md 규칙)이고,
  장애 시점에 로그 파이프라인이 앱 프로세스 안에 있게 된다 — 방향이 거꾸로다.
- docker `loki` 로깅 드라이버는 `docker logs` 를 못 쓰게 만든다. 현재 유일한 디버깅 수단을 뺏는다.
- 따라서 **api 가 JSON 로그를 파일로 쓰고, 그 볼륨을 Alloy 가 읽기 전용으로 tail 한다.** 앱은 Loki 의
  존재를 모르고, Loki 가 죽어도 앱은 영향받지 않는다.

Alloy 는 `local.file_match` → `loki.source.file` → `loki.write` 세 블록이면 된다.

**node_exporter 도 호스트 접근이 필요하다 — socket 만큼은 아니지만 작지 않다.** 디스크 잔량
수집을 위해 `--path.rootfs=/host` / `--path.procfs=/host/proc` 로 호스트 `/` 와 `/proc` 를
컨테이너에 읽기 전용으로 마운트한다(`/:/host:ro`, `/proc:/host/proc:ro`). 컨테이너는 `nobody`로
돌고 추가 capability·privileged 도 없지만, 그래도 호스트의 **모든 world-readable 파일**을 읽을
수 있다 — 이 호스트에는 studyclub 외 다른 프로젝트도 함께 살므로, 그 프로젝트가 기본 퍼미션
(0644)으로 남긴 `.env` 같은 파일이 여기 포함될 수 있다. `/proc` ro 는 호스트의 프로세스
목록·커맨드라인을 노출한다(`/` ro 쪽이 노출 범위가 훨씬 크다). 그럼에도 이 구성을 유지하는
이유: (1) 디스크 잔량 감시가 이 스펙의 목표 2번이라 필요하고, (2) 이건 node_exporter 의 표준
배포 패턴이라 마땅한 대안이 없으며, (3) read-only·비특권·`nobody` 라 위에서 거부한 docker
socket(사실상 호스트 root)보다는 대가가 훨씬 작다. 다른 프로젝트와 호스트를 공유한다면, 그
프로젝트들의 시크릿 파일 퍼미션을 `0600` 으로 조이는 것이 맞는 대응이다(운영 확인 절차는
`docs/observability-host-setup.md` 참조).

**볼륨은 배관이지 저장소가 아니다.** 두 컨테이너가 한 파일을 보려면 볼륨 말고는 방법이 없다 —
컨테이너는 각자 자기 레이어를 갖기 때문이다. 별도 수집기가 앱 로그를 가져가는 길은 셋뿐이고
(공유 파일시스템 / docker socket / 네트워크 push), 그중 **라이브러리도 root 권한도 요구하지 않는
유일한 방법**이라 이걸 고른 것이다.

이 방식에는 조용히 로그를 잃는 함정이 셋 있다. 셋 다 기본값이 위험한 쪽이다.

**(1) Alloy positions 볼륨이 없으면 재기동마다 로그가 중복된다.** Alloy 는 "어디까지 읽었는지"를
자기 데이터 디렉토리에 기록한다. 이게 휘발되면 재기동 시 파일을 **처음부터 다시 읽어** 같은 로그를
Loki 에 또 밀어넣는다. 배포할 때마다 Alloy 도 재기동되므로 상시로 벌어진다.
→ `alloy-data:/var/lib/alloy/data` 볼륨을 반드시 붙이고, **이 볼륨은 절대 지우지 않는다.**

**(2) 롤링된 파일은 감시 대상 밖이라 그대로 유실된다.** Alloy 가 `app.json` 하나만 보는데 로테이션이
일어나면 그 내용은 `app.json.<날짜>.0.gz` 가 되어 Alloy 시야에서 사라진다. Alloy 가 밀려 있는 상태에서
롤링이 나면 **그 구간은 Loki 에 영영 안 들어간다.**
→ **압축을 끄고**(`file-name-pattern` 에서 `.gz` 제거) glob 을 `app.json*` 으로 넓힌다. 이 파일들은
몇 시간~며칠만 사는 통로라 압축해서 아낄 것이 없다. 진짜 압축은 Loki 가 청크에서 한다.

**(3) 볼륨을 배포 때 비우면 Alloy 가 밀린 구간이 사라진다.** 이 파일은 아카이브가 아니라 **Alloy 가
죽어 있는 동안 로그가 기다리는 큐**다. "어차피 Loki 가 들고 있다" 는 Alloy 가 살아있을 때만 참이다.
배포 직후는 컨테이너가 동시에 재기동되어 메모리 압박이 가장 큰 구간 — Alloy 가 죽어 있을 확률이
평소보다 높다. 하필 "배포가 뭘 깨뜨렸나" 를 알아야 하는 그 구간이다.
→ 로그 볼륨도 **배포 때 지우지 않는다.** 크기는 아래 `total-size-cap` 이 잡는다.

> Promtail 은 **2026-03-02 EOL** 이므로 쓰지 않는다. Alloy 가 후속이다.

### 백엔드 변경 — `backend/`

#### 1. actuator 를 앱 포트에서 떼어낸다

현재 `SecurityConfig` 는 `/actuator/**` 를 `permitAll()` 로 열어두고 있고, 실제로
`https://api.studyclub-plusplus.com/actuator` 가 인증 없이 200 을 준다. 여기에 `prometheus`
엔드포인트를 추가하면 URI별 호출량·응답시간·DB 커넥션풀·JVM 상태가 그대로 인터넷에 공개된다.

```yaml
management:
  server:
    port: ${MANAGEMENT_PORT:9090}      # actuator 전체가 9090 으로 이사
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      show-details: never
```

9090 은 호스트에 publish 하지 않는다. 리버스 프록시가 보는 8080 에서 `/actuator/*` 는 **404** 가
되고, 외부 노출이 구조적으로 불가능해진다. `SecurityConfig` 의 `/actuator/**` permitAll 도 같이
지운다 — 포트가 다르므로 기능상 무의미하지만, 남겨두면 나중에 누가 `management.server.port` 를
지웠을 때 조용히 다시 열린다.

**외부 헬스체크는 `/api/health` 로 이관한다.** actuator 를 9090 으로 옮기면 8080 의
`/actuator/health` 가 사라지므로, 리버스 프록시·외부 모니터가 이를 보고 있다면 경로를 바꿔야 한다.
`/api/health` 는 `HealthController` 에 이미 있고 permitAll 이며 운영에서 200 을 준다.

단 **두 엔드포인트는 답하는 질문이 다르다.**

| | `/actuator/health` | `/api/health` |
|---|---|---|
| 구현 | Spring 이 `DataSourceHealthIndicator` 등을 자동 집계 | `Map.of("status","UP")` 하드코딩 |
| MySQL 이 죽으면 | **DOWN** | 여전히 UP |
| 답하는 질문 | 의존성까지 건강한가 (readiness) | 프로세스가 살아있나 (liveness) |

프록시·재시작 판단이 알고 싶은 것은 liveness 이므로 `/api/health` 가 그 용도에는 오히려 정확하다.
대신 **이관으로 잃는 "DB 가 죽으면 헬스체크가 DOWN" 신호는 Grafana 알림이 인수한다**(아래 알림 절).
공개된 미인증 엔드포인트가 매 호출마다 DB 를 찌르지 않게 되는 것은 부수적 이득이다.

`/api/health` 를 DB 까지 확인하도록 바꾸지는 않는다 — actuator 와 역할이 겹치고, 헬스체크 주기마다
DB 쿼리가 도는 것은 공개 엔드포인트에 달갑지 않다.

의존성 **1개 추가**: `runtimeOnly("io.micrometer:micrometer-registry-prometheus")`.
AGENT.md 의 "외부 라이브러리 임의 추가 금지" 대상이라 명시적으로 올린다. 이것이 없으면
`/actuator/prometheus` 자체가 생성되지 않아 메트릭 수집이 불가능하다. actuator 의 표준 짝이고
런타임 전용이다.

#### 2. 로그를 JSON 으로 — 라이브러리 0개

Spring Boot 3.4 부터 **구조화 로깅이 내장**이다. 이 프로젝트는 3.5.16 이므로 logstash-encoder 같은
외부 라이브러리 없이 ECS JSON 을 낼 수 있다.

```yaml
logging:
  structured:
    format:
      file: ${LOG_JSON_FORMAT:}       # 운영만 "ecs". 콘솔은 건드리지 않는다
  file:
    name: ${LOG_FILE:}                # 운영만 /var/log/studyclub/app.json
  logback:
    rollingpolicy:
      max-file-size: 10MB
      max-history: 1                  # ⚠️ "파일 1개" 가 아니라 "1일치" 다
      total-size-cap: 30MB            # ← 실제 디스크 상한은 이것뿐이다
      file-name-pattern: ${LOG_FILE}.%d{yyyy-MM-dd}.%i   # .gz 제거 — Alloy 가 롤링분을 읽어야 한다
```

**콘솔은 사람이 읽는 텍스트 그대로 두고, 파일만 JSON 으로 쓴다.** SSH 로 `docker logs` 할 때의
가독성과 Loki 수집을 둘 다 살린다. 두 env 가 비어 있으면 동작이 지금과 완전히 동일하므로
**로컬 개발 경험은 바뀌지 않는다.**

##### 로그가 세 벌로 저장된다 — 의도된 것이며, 셋의 역할이 다르다

```
앱 ──┬── stdout (텍스트) ──▶ docker json-file ──▶ docker logs
     │                                            컨테이너 재생성 시 소멸
     │
     └── 파일 (ECS JSON) ──▶ [공유 볼륨] ──▶ Alloy ──▶ Loki ──▶ [Loki 볼륨]
                                                                30일, 배포와 무관하게 생존
```

| 사본 | 정체 | 수명 | 크기 상한 |
|---|---|---|---|
| docker json-file | "지금 무슨 일이 나나" · **부팅 실패·JVM 크래시** 창구 | **컨테이너 재생성 시 소멸** — 배포마다 리셋된다 | `max-size: 10m` × 3 |
| 앱 JSON 파일 | **Alloy 인계 버퍼** | Alloy 가 실시간으로 tail. 아카이브가 아니다 | `total-size-cap: 30MB` |
| Loki 청크 | **유일한 아카이브** (압축) | 30일 | retention + compactor |

**셋 중 하나도 뺄 수 없다.**

- docker json-file 을 끄면 **JVM 크래시·OOM·Spring 부팅 실패 출력이 사라진다.** 이들은 파일
  appender 가 초기화되기 전에 stdout 으로 나가므로, 끄면 "부팅이 안 되는데 이유를 알 수 없는"
  상태가 된다
- 앱 JSON 파일을 빼고 Alloy 가 docker json-file 을 직접 읽게 하면 **docker socket 으로 되돌아간다.**
  socket 없이 `/var/lib/docker/containers/` 를 읽으면 컨테이너를 **ID 로만** 구분할 수 있는데 ID 는
  배포마다 바뀐다. glob 으로 전부 읽으면 같은 호스트의 **다른 프로젝트 로그가 섞인다**
- Loki 는 이 스펙의 목적 그 자체다

**따라서 줄여야 할 것은 사본 수가 아니라 각 사본의 크기다.** 앱 JSON 파일은 Alloy 가 즉시 퍼가는
인계 버퍼이므로 며칠치를 들고 있을 이유가 없다(`max-history: 1`). 아카이브 역할은 Loki 하나만 진다.

콘솔 레벨은 INFO 그대로 둔다. `logging.threshold.console: WARN` 로 낮춰 docker 쪽 사본을 더 줄일 수
있지만, 그 사본은 **어차피 배포마다 리셋되어 크게 자라지 않는다.** 아끼는 양에 비해 `docker logs` 의
INFO 가시성을 잃는 대가가 크고, 해당 프로퍼티는 과거 동작 불량 이슈가 있었다.

#### 3. 요청 상관관계 — `RequestContextFilter` 신설

요청마다 짧은 `requestId` 를 만들고(들어온 `X-Request-Id` 헤더가 있으면 계승) MDC 에
`requestId` / `method` / `uri` 를 심는다. Spring Boot 의 구조화 로깅이 MDC 를 JSON 필드로 자동
포함하므로, Loki 에서 `requestId` 로 한 요청이 남긴 로그 전부를 꿰어볼 수 있다. 응답 헤더로도
돌려줘서 사용자 문의 시 식별자로 쓴다. `finally` 에서 반드시 MDC 를 clear 한다(스레드 재사용 오염).

**PII 규칙 준수** — `uri` 는 경로만 남기고 **query string 과 body 는 남기지 않는다.** OAuth `code`
나 이메일이 query 에 실릴 수 있다. `docs/backend-development-guide/logging-guide.md` 의 금지 항목과
일치한다.

#### 4. 에러 로그를 쓸모있게 — `GlobalExceptionHandler`

현재 500 은 `log.error("Unhandled exception", e)` 로만 남아 **어느 URI 에서 터졌는지 알 수 없고**,
4xx(`BusinessException`)는 로그가 아예 없다. 정작 `logging-guide.md` 는
`log.error("Unexpected error: uri={}", ...)` 를 모범으로 제시한다.

- 500 → `method` / `uri` 를 함께 남긴다
- 4xx → `WARN` 으로 `errorCode` 만 남긴다 (메시지 본문은 PII 우려로 제외)

이래야 "에러율" 그래프와 "무슨 에러였나" 검색이 둘 다 성립한다.

#### 5. 접근 로그

요청 1건 = 로그 1줄 (`method`, `uri`, `status`, 소요 ms, `requestId`). Tomcat access log 대신
위 필터에서 남겨 JSON 포맷·MDC 와 형태를 일치시킨다. 헬스체크·정적 경로는 제외(노이즈).

### 노출 · 인증

- `GF_SERVER_ROOT_URL=https://grafana.studyclub-plusplus.com`
- 익명 접근 off, 신규 가입 off
- **구글 OAuth** — 백오피스가 쓰는 GCP 클라이언트를 재사용하고, 접근 가능 이메일을 명시적으로 제한한다

계정이 `@gmail.com` 이라 Grafana 의 `allowed_domains` 는 무의미하다(전 세계 gmail 통과). 개별 이메일
allowlist 가 필요하므로 `role_attribute_path` 에 JMESPath 를 넣고 `role_attribute_strict=true` 로
미매칭 사용자의 로그인을 거부시킨다. **이 방식이 `auth.google` 에서 실제로 차단되는지는 붙여서 눈으로
확인한다**(미확인 항목). 동작하지 않으면 `generic_oauth` 로 구글을 붙이는 방식이 대안이다.

Grafana 는 사실상 모든 애플리케이션 로그와 DB 조회 권한을 들고 있다. **여기가 뚫리면 로그를 통해
DB 내용까지 샌다.** allowlist 가 실제로 막는 것을 확인하기 전에는 서브도메인을 공개하지 않는다.

호스트 쪽 노출 작업은 아래 "사람이 해야 하는 작업" 참조.

### 대시보드 (provisioning 파일로 커밋)

1. **API 개요** — 요청률 · 에러율 · 응답시간(RED) + 상태코드 분포
2. **JVM** — 힙, GC, 스레드, DB 커넥션풀
3. **로그 탐색** — level · requestId · uri 필터, 에러 스트림
4. **서비스 지표** — MySQL 데이터소스로 일별 가입 / 스터디 개설 / 신청. **계측 코드 0줄**
5. **디스크** — 남은 용량 (node_exporter)

데이터소스·대시보드·알림은 **전부 provisioning 파일로 커밋한다.** UI 에서 클릭해 만든 설정은 그
머신이 죽으면 같이 사라진다. git 이 정본이다.

MySQL 데이터소스에는 **읽기 전용 계정**만 준다.

### 알림 (Grafana Unified Alerting → Discord)

| 알림 | 조건 |
|---|---|
| api 다운 | 스크랩 2분 연속 실패 |
| 5xx 급증 | 5분간 5xx 비율 5% 초과 |
| 응답 지연 | 5분간 p95 > 2s |
| 디스크 부족 | 남은 용량 15% 미만 |
| **DB 연결 이상** | 커넥션 획득 실패 / pending 급증이 2분 지속 |

마지막 항목은 헬스체크를 `/api/health` 로 이관하며 잃는 신호를 대체한다. Hikari 커넥션풀 메트릭
(`hikaricp_connections_*`)으로 판단하며, 정확한 PromQL 은 구현 시 실제 지표를 보고 확정한다.
DB 장애는 5xx 급증으로도 드러나지만, 그건 사용자가 이미 에러를 맞은 뒤다 — 풀 지표가 더 빠르다.

Discord webhook URL 은 env 로 주입한다(PUBLIC 레포 — 평문 금지).

### 디스크 상한 — 모든 저장 지점에

이 호스트에는 studyclub 외의 프로젝트도 함께 떠 있다. **디스크가 차면 studyclub 만이 아니라 그
머신의 모든 프로젝트가 같이 죽는다.** 관측 스택은 성격상 디스크를 계속 먹는 물건이므로 모든 저장
지점에 상한을 건다.

| 저장 지점 | 상한 | 안 걸면 |
|---|---|---|
| Loki 청크 | `retention_period: 720h` + **compactor** | 무한 증가 |
| Loki 유입량 | `ingestion_rate_mb: 4`, `per_stream_rate_limit: 3MB` | 로그 폭주 1회에 디스크 소진 |
| Prometheus | `--storage.tsdb.retention.time=15d` **+ `--storage.tsdb.retention.size=2GB`** | 시간 제한만으론 카디널리티 폭발을 못 막음 |
| 앱 JSON 로그 파일 | **`total-size-cap: 30MB`** | Alloy 가 퍼가도 원본이 쌓임 |
| docker json-file 로그 | `max-size: 10m`, `max-file: 3` | **기본값이 무제한** |

**Loki 는 `retention_period` 만 적어두면 무시한다.** compactor 를 함께 켜야 실제로 지워진다:

```yaml
compactor:
  working_directory: /loki/compactor
  retention_enabled: true              # 없으면 retention_period 가 무시된다
  delete_request_store: filesystem     # 없으면 삭제가 동작하지 않는다
```

마지막 줄(docker json-file 무제한)은 **이 변경과 무관하게 지금도 이미 위험하다.** 현재 운영 api
컨테이너의 로그는 컨테이너가 재생성될 때까지 계속 커지고 있다.

**`max-history` 는 파일 개수가 아니라 일수다.** Spring Boot 의 기본 롤링 패턴이 `날짜.%i` 라서 하루
안에서 크기 초과로 몇 번이든 롤링되고, `max-history` 는 그 **일수**만 센다. 하루에 로그가 쏟아지면
10MB 파일이 몇십 개 생겨도 `max-history: 1` 은 아무것도 막지 못한다. **디스크 상한 역할을 하는 것은
`total-size-cap` 하나뿐이다** — 이걸 빠뜨리면 이 절 전체가 무의미해진다.

위 상한을 다 적용했을 때 로컬 디스크 사용량은 **약 60MB + Loki 30일치**다. 앱 JSON 파일을
`50MB × 3` 으로 잡았던 초안은 인계 버퍼에 28일치를 들려주는 셈이라 200MB 를 낭비했고, 게다가
`max-history` 의 단위를 잘못 알아 실제로는 상한 자체가 걸려 있지 않았다.

볼륨은 **named volume** 을 쓴다. 바인드 마운트는 크기 확인(`du -sh`)이 쉽지만 Grafana(uid 472)·
Loki(uid 10001) 가 서로 다른 uid 로 돌아 권한 문제로 부팅이 깨지는 것이 첫 관문이다. named volume 은
그 문제가 없고 로컬에서도 동일하게 뜬다. 크기는 `docker system df -v` 로 본다. 다만 named volume 은
`/var/lib/docker/volumes` 아래에 살아 **도커 파티션 용량을 그대로 쓴다** — 그 파티션이 작으면
바인드 마운트로 전환하고 권한을 명시적으로 잡는다(미확인 항목).

### 테스트

- **단위** — `RequestContextFilter`: MDC 설정·정리, `X-Request-Id` 헤더 계승
- **통합** — 응답에 `X-Request-Id` 가 실리는지
- **통합(회귀 방지)** — **앱 포트에서 `/actuator/prometheus` 가 404 인지.** 이 테스트가 actuator
  재노출을 막는 안전장치다
- **수동 체크리스트** — 일부러 500 을 내고, 그 `requestId` 로 Grafana Explore 에서 검색되는지까지 확인

`@DisplayName` 은 한글로 (testing-guide 규약).

### 구현 중 실측으로 확인한 함정

코드 주석에 적지 않고 여기 모아둔다. 공통점은 **설정이 틀린 티를 내지 않는다**는 것 — 에러도
경고도 없이 그냥 기대한 일이 안 일어난다.

| 지점 | 기본값/직관 | 실제 | 안 막으면 |
|---|---|---|---|
| Grafana `[auth.google] skip_org_role_sync` | 다른 커넥터처럼 `false` 일 것 | **구글 커넥터만 기본 `true`** | `role_attribute_path` 가 통째로 무시돼 **구글 계정만 있으면 누구나 로그인**. mock OIDC 로 미허용 계정이 Viewer 로 들어오는 것 재현함 |
| Alloy `level = "log.level"` | 따옴표를 씌우는 게 안전 | 씌우면 **flat 키** `"log.level"` 을 찾음 | ECS 는 중첩(`log:{level:}`)이라 `level` 라벨이 조용히 빈 값 |
| `EndpointRequest.toAnyEndpoint()` | actuator 매처로 충분 | 관리 포트가 분리되면 엔드포인트가 **자식 컨텍스트**에만 매핑돼 `PathMappedEndpoints` 를 못 찾고 매치 자체가 안 됨 | 관리 포트 요청이 `anyRequest().authenticated()` 로 떨어져 401 (Prometheus 스크랩 차단) |
| 경로 매처만으로 actuator 체인 구성 | 포트별로 갈릴 것 | 빈이 메인·관리 **양쪽 컨텍스트에 다 적용**됨 | 누가 `management.server.port` 를 지우면 그 순간 **앱 포트에서 `/actuator/**` 가 permitAll** — 제거했던 취약점이 부활. 그래서 `@ConditionalOnManagementPort(DIFFERENT)` 로 빈 존재 자체를 막는다 (회귀 테스트: `ActuatorMergedPortRegressionTest`) |
| `LogbackLoggingSystem` 재초기화 | 컨텍스트마다 초기화 | `LoggerContext` 가 JVM 싱글턴이고 "이미 초기화됨" 마커를 심어 **두 번째부터 통째로 건너뜀** | 스위트 전체를 돌리면 뒤에 뜨는 테스트의 `logging.file.name` 오버라이드가 무시돼 파일이 안 생김. 단독 실행은 통과하고 전체 실행만 깨져 원인 찾기 어려움 |
| `api/src/test/resources/application.yml` | main 과 병합될 것 | 같은 `classpath:/application.yml` 이라 **main 을 통째로 가림** | 테스트 런타임에 `logging.logback.rollingpolicy` 블록이 아예 없음 → **롤링 정책은 자동 테스트가 못 지킨다.** `LoggingYamlConfigTest` 는 yaml 텍스트만 검사하고, 실제 동작은 bootJar 로 수동 확인해야 한다 |
| `file-name-pattern: ${LOG_FILE}...` + `LOG_FILE` 미설정 | placeholder 해결 실패로 기동 오류 | `logging.file.name` 이 비면 파일 어펜더 자체가 비활성이라 **평가되지 않음** | (문제 없음 — 로컬 개발·CI 경로가 안전하다는 확인) |

Spring Boot 4.1.1 / Java 25 에서 재확인한 것: ECS 의 `log.level` 중첩 구조 유지, 롤링 아카이브에
`.gz` 없음(`app.json.2026-09-11.0`), `max-history` 1일 적용.

### 사람이 해야 하는 작업 (코드로 안 되는 것)

1. 호스트 SSH 접속 후 자원 확인 (`free -h`, `df -h /var/lib/docker`, `docker network ls`)
2. DNS A 레코드 `grafana.studyclub-plusplus.com` 추가
3. **Let's Encrypt 인증서 SAN 목록에 위 도메인 추가** — 현재 인증서는 와일드카드가 아니라 6개
   도메인을 나열한 멀티 SAN 이다. 갱신 설정에 수동으로 넣어야 한다
4. 리버스 프록시에 vhost 추가 (→ `127.0.0.1:3000`)
5. GCP 콘솔에 Grafana redirect URI 추가
6. Discord webhook 생성
7. **리버스 프록시·외부 모니터의 헬스체크 경로를 `/actuator/health` → `/api/health` 로 변경.**
   actuator 포트 분리보다 **먼저** 해야 한다. 순서가 바뀌면 그 사이에 헬스체크가 404 를 맞는다
8. **운영 배포 스크립트·compose 수정** — 이 레포 밖(호스트)에 있다. 아래 참조

### 운영 배포 설정 수정 (레포 밖)

운영 api 는 GitHub Actions 가 SSH 로 접속해 호스트의 `deployment/studyclub/api-production.sh` 를
실행해 뜬다. **그 compose 파일은 이 레포에 없다.** 다음이 필요하다:

- env 주입: `MANAGEMENT_PORT`, `LOG_JSON_FORMAT=ecs`, `LOG_FILE`
- 공유 로그 볼륨 마운트 (Alloy 가 읽을 경로)
- `logging.options` 로 docker json-file 로테이션
- 관측 스택과 **같은 docker 네트워크**에 참여 (Prometheus 가 `api:9090` 을 스크랩해야 한다).
  로컬 개발 compose 와 운영 compose 는 서로 다른 compose 프로젝트이므로 자동으로 붙지 않는다 —
  공용 external 네트워크를 하나 만들어 양쪽이 참여한다

장기적으로는 이 운영 compose 도 레포로 가져오는 편이 낫지만, 이번 범위 밖이다.

## 미확인 (착수 전 확인)

| 항목 | 확인 방법 | 틀렸을 때 |
|---|---|---|
| Grafana 구글 개별 이메일 allowlist | 문서 + **실제 차단 검증** | `generic_oauth` 방식으로 대체 |
| `/var/lib/docker` 파티션 크기 | `df -h` | named volume → 바인드 마운트 + 권한 명시 |
| 운영 api 가 붙은 docker 네트워크 | `docker network ls` | Prometheus 스크랩 경로를 그에 맞게 조정 |

### 확인 대신 결정한 것

- **`/actuator/health` 외부 의존** — 확인해서 대응하는 대신, **외부가 actuator 를 쓰지 않게 만든다.**
  헬스체크는 `/api/health` 로 이관하고 actuator 는 전부 내부 포트로 내린다. 무엇이 actuator 를
  보고 있었든 관계없이 결과가 같아진다.
- **호스트 여유 메모리** — 충분하다고 가정하고 LGTM 스택(약 1GB)으로 진행한다. 실제로 부족한 것이
  드러나면 경량 스택(VictoriaMetrics + VictoriaLogs)으로 선회하며, 그때 바뀌는 것은 저장소 두 개와
  쿼리 문법뿐이고 백엔드 변경·대시보드 구성·노출 방식은 그대로 쓴다.

## 한계 / 후속

- **호스트 CPU·메모리·네트워크 미수집** — node_exporter 는 넣되 디스크 패널만 만든다. 나머지
  패널은 필요할 때 추가한다(수집은 이미 되고 있으므로 대시보드만 그리면 된다)
- **MySQL exporter 없음** — 슬로우쿼리·커넥션 지표는 후속. 당분간 Spring 커넥션풀 지표로 대신한다
- **프론트엔드(Next.js) 로그 미수집** — 후속
- **분산 트레이싱 없음** — `requestId` 는 단일 서비스 내 상관관계만 제공한다. 서비스가 늘면
  Tempo + OpenTelemetry 를 검토한다
- **로그 장기 보관·백업 없음** — 30일 지나면 사라진다. 감사 목적의 보관이 필요해지면 별도 설계
- **관측 스택이 감시 대상과 같은 머신에 있다** — 머신이 통째로 죽으면 그 사실을 Grafana 로 알 수
  없다. 외부에서의 단순 uptime 체크(무료 SaaS)를 별도로 두는 것이 후속 보완책
- **`/api/health` 는 liveness 전용** — 하드코딩된 `UP` 이라 DB·외부 의존성 상태를 반영하지 않는다.
  의존성 건강은 Grafana 알림에만 의존하게 되므로, **관측 스택이 죽으면 DB 장애를 알아챌 경로도 같이
  사라진다.** 외부 uptime 체크를 별도로 두는 후속과 함께 봐야 한다
- **로그가 세 벌로 저장된다** — 위에 적은 제약(socket 회피 · 크래시 출력 보존 · 남의 프로젝트 로그
  차단)에서 나온 구조다. 사본을 줄이려면 그 제약 중 하나를 포기해야 한다
- **`docker logs` 는 배포마다 리셋된다** — 컨테이너가 재생성되기 때문이다. 배포 직전의 로그를
  나중에 보려면 Loki 를 봐야 한다. 관측 스택이 뜨기 전까지는 그 구간이 사실상 사각지대다
- **알림 채널이 Discord 하나** — Discord 가 죽으면 알림도 죽는다
- **운영 compose 가 레포 밖** — 이 스펙의 절반은 레포 밖 파일 수정에 의존한다

## 변경이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-09-06 | 최초 작성 — Grafana 단일 창구, LGTM 스택 self-host, actuator 포트 분리, ECS JSON 파일 로깅 + Alloy 운반 | 운영 백엔드에 로그·메트릭 관측 부재 |
| 2026-09-06 | 외부 헬스체크를 `/api/health` 로 이관 확정, 그로 인해 잃는 DB 신호를 커넥션풀 알림으로 대체. 메모리는 충분 가정 | actuator 를 외부가 아예 쓰지 않게 만드는 편이 확인 후 대응보다 확실 |
| 2026-09-06 | 로그 저장 계층(버퍼 2 + 아카이브 1)을 명시하고 앱 JSON 파일 상한을 `50MB×3` → `10MB×1` 로 축소. 콘솔은 INFO 유지 | 인계 버퍼에 아카이브 크기를 잡아 약 200MB 를 낭비하고 있었다 |
| 2026-09-06 | Alloy 의 level 추출 표현식 정정 — ECS 는 level 을 `{"log":{"level":…}}` 로 nest 하므로 따옴표를 씌운 flat 키 탐색이 아니라 중첩 순회여야 한다 | 구현 중 실제 출력과 포매터 소스로 확인. 틀리면 에러 없이 레이블만 빈 값이 되어, 로그 조회가 안 잡히고서야 드러난다 |
| 2026-09-06 | 로그 유실 함정 3건 보강 — `total-size-cap` 추가(`max-history` 는 일수라 상한이 아니었음), 롤링 압축 해제 + glob 확장, Alloy positions 볼륨 신설 | 셋 다 기본값이 위험한 쪽이고, 조용히 로그를 잃거나 중복시킨다 |
