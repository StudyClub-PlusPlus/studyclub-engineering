# observability — Grafana 설정의 정본

Grafana 의 대시보드·알림은 **이 디렉토리가 정본**이고, Grafana 안에 있는 것은 그 투영본이다.
Grafana 쪽에서 무엇이 사라지든 재적용 한 번으로 돌아온다.

```
observability/
├── README.md               ← 이 파일. 규약·절차·결정
├── dashboards/
│   ├── studyclub-logs.json       Loki — 로그 조회 (3 패널)
│   └── studyclub-metrics.json    Prometheus — RED·JVM·DB·디스크 (16 패널)
├── dashboard-tool.mjs      ← lint · normalize · drift · push. 불변식이 한 파일에 있다
└── alerting/               ← 아직 없음. 규칙 11종이 Grafana 안에만 있다
```

## 왜 레포에 두나

알림 규칙과 대시보드가 Grafana 안에만 있으면, 파드가 재생성되거나 Org 가 날아갈 때
규칙·정책·수신처·템플릿·대시보드가 한꺼번에 사라진다. **그런데 사라진 뒤의 화면은
"장애 없는 평온한 하루"와 똑같이 생겼다.** 알림이 안 오는 상태를 알아차릴 방법이 없다.

**Grafana 화면에서 고치는 길은 열어 둔다**(`editable: true`). 패널을 고치면 숫자가 어떻게
나오는지 봐야 하고, 그 확인을 거친 뒤에 PR 을 올리는 게 자연스러운 순서다. 막아 두면
"레포에 먼저 쓰고 머지한 다음 확인" 이라는 뒤집힌 순서를 강요하게 된다.

대신 **고치고 export 를 안 하면 다음 provisioning 에 덮인다.** 그래서 아래 §정본과 실물이
같은지 확인(drift 검사)이 안전장치다 — 덮기 전에 어긋난 것을 먼저 알려준다.

## 조용히 깨지는 네 가지 — 전부 Grafana 가 에러 없이 받아준다

| 무엇이 깨지나 | 왜 | 처방 |
|---|---|---|
| 다른 Grafana 에서 **패널이 빈다** | export JSON 에 그 인스턴스의 datasource uid 가 박힌다 | `templating` 의 `datasource` 변수 + 모든 참조를 `${datasource}` 로 |
| 기본 데이터소스가 다른 곳에서 **쿼리가 엉뚱한 데로 간다** | `datasource: null` 은 "조직 기본값"으로 늦게 해석된다 | `null` 도 `${datasource}` 로 명시 |
| 엉뚱한 대시보드를 덮거나 **404** | 숫자 `id` 는 인스턴스 로컬 값이다 | `id: null` + 안정적인 `uid`(파일명과 동일) |
| UI 에서 고친 패널이 **다음 배포에 덮인다** | provisioning 이 레포 내용으로 밀어 넣는다 | 막지 않는다 — **drift 검사**로 덮기 전에 알아챈다 (아래 §정본과 실물) |

앞의 세 가지는 **import 가 200 으로 성공하고 대시보드도 목록에 보인다.** 실패가 눈에
보이지 않으니 필요해지는 날 처음 안다. `dashboard-tool.mjs --lint` 가 이것들을 막는다.
네 번째만 성격이 다르다 — 막는 게 아니라 **알아채게** 한다.

### 실제로 어땠나 (2026-10-03 실측)

- `studyclub-metrics` — prometheus uid 가 **39곳** 박혀 있었다. 다른 Grafana 에 올리면 패널 16개가 전부 빈다
- `studyclub-logs` — 패널 `datasource` 가 전부 `null` 이었다. stage 는 **Loki 가 기본 데이터소스라
  우연히** 돌고 있었고, 기본이 Prometheus 인 Grafana 에서는 LogQL 을 Prometheus 에 던진다
- 두 대시보드 모두 숫자 `id`(1·2)가 남아 있었다
- `uid` 는 이미 읽을 수 있는 slug 였다(`studyclub-logs` · `studyclub-metrics`) — 바꿀 필요가 없었다

## 변수 규약

### 데이터소스 — `${datasource}`

대시보드마다 `type: datasource` 템플릿 변수 하나(`datasource`)를 두고, 모든 패널·타겟·
쿼리변수가 `uid: "${datasource}"` 를 참조한다. 변수의 `current` 는 **비워 둔다** —
import 시점에 해당 타입의 기본 데이터소스로 자동 해석된다.

> 타입당 데이터소스가 **1개일 때만 해석이 확정적**이다. 2026-10-03 stage 기준
> Loki 1개 · Prometheus 1개라 모호함이 없다. 같은 타입이 둘 이상 생기면
> 기본값(또는 첫 번째)을 집으므로, 그때는 변수 `current` 를 명시하거나 환경별로 치환한다.

### 환경차 값 — Grafana 변수 문법을 쓰지 않는다

알림 YAML 에서는 환경차 값을 `${VAR}` 로 비우고 CI 가 치환한다. **대시보드 JSON 에서는
그 문법을 쓸 수 없다** — Grafana 자신의 변수 문법(`$var` · `${var}`)과 충돌해서, lint 가
"치환 대기 placeholder" 와 "Grafana 변수" 를 구분할 수 없다.

대신 lint 는 **더 센 검사**를 한다: JSON 안의 모든 `$var` 참조가 `templating` 에 선언된
변수이거나 Grafana 내장 변수여야 한다. 둘 다 아니면 실패한다. 치환 누락뿐 아니라
**변수명 오타까지** 같이 잡힌다 (Grafana 는 모르는 변수를 빈 문자열로 렌더하고 경고하지 않는다).

대시보드에 환경차 리터럴이 꼭 필요해지면 `__VAR__` 처럼 `$` 없는 구분자를 쓴다.

## 절차

### 새 대시보드를 정본에 넣기 / 기존 것 갱신

> **주소·계정은 레포에 적지 않는다.** `GRAFANA_URL` · `GF_USER` · `GF_PASS` 를 환경변수로
> 넣어 쓴다. 환경값(주소 · Org · 데이터소스 uid)은 Notion 「인프라 문서 → 알림 시스템 —
> 구조와 사용법」 의 「환경값」 표에 있다 — 이 레포는 PUBLIC 이다.

```bash
# 1. Grafana 에서 export (admin 계정. jq 없이 그대로 파이프해도 된다)
curl -s -u "$GF_USER:$GF_PASS" \
  "$GRAFANA_URL/api/dashboards/uid/<uid>" > /tmp/raw.json

# 2. 정규화 — 변수화 + id/editable/version 위생 + 키 정렬
#    (Grafana 에서 고쳐 보고 확인한 다음 여기로 가져온다 — 순서가 거꾸로면 안 된다)
node observability/dashboard-tool.mjs --normalize < /tmp/raw.json \
  > observability/dashboards/<uid>.json

# 3. 검사
node observability/dashboard-tool.mjs --lint observability/dashboards/*.json
```

`--normalize` 를 거치지 않고 커밋하면 lint 가 "정규화 형태가 아니다" 로 막는다.
키 정렬·2칸 들여쓰기를 강제해서 **재export 때 diff 가 순서 때문에 흔들리지 않게** 한다.

### 정본과 실물이 같은지 확인 (drift 검사)

```bash
GRAFANA_URL=... GRAFANA_TOKEN=... \
  node observability/dashboard-tool.mjs --drift observability/dashboards/*.json
```

어긋나면 **누가 언제 Grafana 쪽을 고쳤는지**까지 찍고 `exit 3` 으로 끝난다
(실패 `1` 과 구분하려고 3을 쓴다 — CI 가 "설정 오류" 와 "어긋남" 을 다르게 다룬다).

수동 반영이 필요하면:

```bash
GRAFANA_URL=... GRAFANA_TOKEN=... \
  node observability/dashboard-tool.mjs --push observability/dashboards/*.json
```

> **재export 하면 `id` 가 숫자로 돌아온다** — Grafana 가 서버에서 부여하는 값이라 정상이다.
> `--normalize` 가 다시 `null` 로 돌리므로 diff 는 0 이다. 놀라지 말 것.

> **`POST /api/dashboards/db` 응답의 `version` 은 쓰기 *전* 버전이다.** 2026-10-03 실측 —
> 저장된 값 10 → 응답 `"version": 10` → 다시 읽으면 11. 응답을 그대로 로그에 찍으면
> Grafana 의 변경 이력과 1씩 어긋나고, "이 버전을 만든 커밋" 을 추적할 때 엉뚱한 줄을
> 본다. `--push` 는 그래서 **되읽은 값**을 찍는다 (+1 로 계산하지 않는다 — 서버가 실제로
> 무엇을 저장했는지는 서버만 안다).

**이 검사가 UI 편집을 열어 둔 대가를 치른다.** diff 가 나오면 둘 중 하나다 —
누가 Grafana 에서 고치고 아직 PR 을 안 올렸거나(→ export 해서 PR), 레포가 앞서 있고
아직 배포가 안 됐거나(→ merge 를 기다린다). **덮기 전에 알아야 하므로 provisioning
워크플로에서 먼저 돌린다.**

## 배포

[`.github/workflows/observability.yaml`](../.github/workflows/observability.yaml)

| 트리거 | 하는 일 | 토큰 |
|---|---|---|
| `beta`·`develop`·`main` 으로의 PR | lint 만 | **없음** |
| `beta` push | lint 만 | **없음** |
| `develop` push | lint → drift → push → 재확인 | Environment `stage` |
| `main` push | 〃 | Environment `production` |

반영 잡은 네 단계다 — **덮기 전에 drift 를 먼저 보고**, 반영한 뒤 **같은 도구로 되읽어
확인한다.** `POST` 가 200 이었다는 것은 반영됐다는 뜻이 아니다(Grafana 는 잘못된 설정도
200 으로 받는다).

Environment 시크릿 두 개가 필요하다 — `GRAFANA_URL` · `GRAFANA_SA_TOKEN`.
**주소까지 시크릿으로 둔다**: 워크플로 로그도 공개되므로 시크릿이어야 마스킹된다.
시크릿이 없는 환경에서는 **빨간 체크 대신 "건너뜀" 요약**을 남긴다 — "설정이 안 됐다" 와
"반영이 실패했다" 는 구분되어야 한다.

**PR 워크플로에 토큰을 주지 않는다.** 이 레포는 public 이라 누구나 PR 을 열 수 있고,
PR 에서 도는 워크플로에 토큰이 닿으면 그 PR 의 코드가 토큰을 읽는다.

provisioning 을 `beta` 가 아니라 `develop`·`main` 에 묶는 이유 — 대시보드·알림은 **그것이
관측하는 앱과 같은 브랜치에서 나가야** 한다(`backend-develop.yaml`→stage, `backend-main.yaml`→prod).
`beta` 에서 먼저 나가면 앱이 아직 내보내지 않는 메트릭을 알림이 참조해 `NoData` 로 뜬다.

Grafana 는 브랜치가 아니라 **환경(클러스터)당 한 벌**이다. 즉 같은 JSON 을 stage·prod 두
Grafana 에 각각 올리는 구조이고, 환경 주소는 워크플로의 Environment 변수로 주입한다.

## 삭제 동기화 — 대시보드는 자동 삭제하지 않는다

provisioning API 는 **upsert 만** 한다. 레포에서 지워도 Grafana 에는 남는다.

자동 삭제를 넣으려면 지울 대상을 "레포에 없는 것" 으로 잡아야 하는데, **그러면 사람이
「Save as copy」로 만든 실험 사본까지 지운다.** 사본은 uid 가 새로 생기고 태그는 그대로
따라오기 때문에, 표식으로 "우리 것" 과 "남의 사본" 을 가릴 수가 없다. 그리고 우리는
실험용 사본을 **권장**하고 있다(위 §절차).

그래서 **대시보드는 `--drift` 가 목록만 보여 주고 삭제는 사람이 한다.** 남아 있는 비용이
"안 보는 화면이 하나 더" 수준이라 자동화할 값이 아니다.

**알림 규칙은 사정이 다르다** — 레포에서 지운 규칙이 `NoData` 로 영구히 떠 있으면
**쓰이지 않는 경고가 쌓여 진짜 경고를 묻는다.** 그쪽은 자동 삭제를 넣는다(알림 작업에서).

> 실험은 「Save as copy」로. 사본은 레포가 관리하지 않으니 덮이지도 지워지지도 않는다.

## 참고

- 설계 판단과 배치: [`specs/observability-stack/spec.md`](../specs/observability-stack/spec.md)
  — 「대시보드」 「알림」 절
- 알림 규칙 11종과 추가 절차: [`docs/observability/adding-alerts.md`](../docs/observability/adding-alerts.md)
- 왜 webhook 으로 보내는지 등 결정 배경: [`share/2026-09-28-grafana-alert-discord-bot.md`](../share/2026-09-28-grafana-alert-discord-bot.md)
- 환경값(주소 · Org · 데이터소스 uid): Notion 「알림 시스템 — 구조와 사용법」 §환경값
- Grafana 자체(Loki·Alloy 포함)는 이 레포가 아니라 인프라 쪽에서 띄운다. 이 디렉토리는
  **그 위에 올라가는 설정**만 정본으로 갖는다
- 데이터소스는 코드로 선언돼 있지 않다 — 그래서 `uid` 가 환경마다 다르고, 위
  `${datasource}` 규약이 필요하다. 데이터소스 자체를 선언형으로 옮기는 것은 별 작업
