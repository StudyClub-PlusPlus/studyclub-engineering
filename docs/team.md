# 팀 구성 · 라벨 매핑

PR 라벨링과 Discord 알림 라우팅, 리뷰어 배정의 근거 문서다.

> **정본(SSOT)은 Notion 「팀원」 DB** 이고 이 문서는 레포 도구가 참조하기 위한 사본이다.
> 인원 변동이 생기면 Notion 을 먼저 고치고 이 문서를 맞춘다.
>
> ⚠️ **PUBLIC 레포다.** 이메일·거주지·Discord 핸들·연락처는 여기 적지 않는다 (`AGENT.md` 규칙).
> Discord 멘션이 필요해지면 핸들이 아니라 숫자 user ID 가 필요한데, 그건 레포가 아니라
> `DISCORD_USER_MAP` GitHub Secret 에 JSON 으로 둔다.

## 두 가지 "스쿼드"

용어가 겹쳐서 혼동하기 쉬운데 **서로 다른 축**이다.

| 축 | 무엇 | 출처 | 라벨 |
|---|---|---|---|
| **조직 스쿼드** | 사람이 어디 소속인가 | Notion 「팀원」 DB | `squad: *` |
| **제품 도메인** | 무엇을 만드는가 | Notion 「도메인」 문서 | `domain: *` |

이름이 겹치는 `study` 도 별개다 — `squad: study` 는 스터디 스쿼드 소속이라는 뜻이고,
`domain: study` 는 스터디 기능(생성·탐색·모집·신청)을 건드린다는 뜻이다.

## 조직 스쿼드

| 스쿼드 | 라벨 | 리드 | 멤버 |
|---|---|---|---|
| 스터디 | `squad: study` | 김도율 | 김도율 · 김민정 · 김보아 · 김지연 · 김지윤 · 박세은 · 조아연 (7) |
| 커뮤니티 | `squad: community` | 박주현 | 김리나 · 박주현 · 백종빈 · 신동일 · 신효승 · 이진중 · 정영현 (7) |
| 디스코드 | `squad: discord` | 황준희 | 김도율 · 김민정 · 박세은 · 황준희 (4) |
| 기획 | `squad: planning` | 이가온 | 강주영 · 김연지 · 이가온 (3) |
| 디바이스 | `squad: device` | 윤준수 | 김보아 · 윤준수 (2) |
| 디자이너 | `squad: design` | 김연지 | 김연지 (1) |
| 운영 | `squad: ops` | — | 김민균 (1) |

## 파트

| 파트 | 리드 | 인원 |
|---|---|---|
| BE | 김지윤 (백엔드 리드) | 15 |
| FE | 김리나 (프론트 리드) | 12 |
| 인프라 | 강주영 (인프라 리드) | 5 |
| 기획 | 이가온 (기획 리드) | 4 |
| 운영 | — | 3 |
| Device | 윤준수 (디바이스 리드) | 1 |

## 멤버

| 이름 | GitHub | TZ | 조직 스쿼드 | 파트 | 리드 |
|---|---|---|---|---|---|
| 강주영 | `titaniper` | KST | 기획 | BE · FE · 인프라 | **인프라 리드** |
| 김도율 | `doxxx93` | KST | 스터디 · 디스코드 | BE · 인프라 | **스터디 리드** |
| 김리나 | `LeenaKim` | EST | 커뮤니티 | FE · BE · 인프라 | **프론트 리드** |
| 김민균 | `mikim42` | KST | 운영 | — | 채찍 |
| 김민정 | `jyami-kim` | KST | 디스코드 · 스터디 | BE · FE | — |
| 김보아 | `boakim-dev` | KST | 스터디 · 디바이스 | BE · FE | — |
| 김연지 | `yeonji-design` | PST | 디자이너 · 기획 | — | **디자인 리드** |
| 김지연 | `CLEO525` | KST | 스터디 | FE · BE | — |
| 김지윤 | `kimjiy9607` | PST | 스터디 | BE · 인프라 | **백엔드 리드** |
| 박세은 | `seeunrosypark` | KST | 디스코드 · 스터디 | BE · FE · 기획 | — |
| 박주현 | `j00hyun` | EST | 커뮤니티 | BE | **커뮤니티 리드** |
| 백종빈 | `jongbinny98` | KST | 커뮤니티 | BE · FE | — |
| 신동일 | `unknown33572` | KST | 커뮤니티 | BE · FE | — |
| 신효승 | `rowing0328` | KST | 커뮤니티 | BE · FE · 기획 · 인프라 | 커뮤니티 헬퍼 |
| 윤준수 | `joonscode` | KST | 디바이스 | Device · 운영 | **디바이스 리드** |
| 이가온 | `onzomonzo` | KST | 기획 | 운영 | **기획 리드** |
| 이진중 | `hereokay` | KST | 커뮤니티 | BE · FE | — |
| 정영현 | `Jeongyounghyeon` | KST | 커뮤니티 | BE · FE | — |
| 조아연 | `1zncl2` | KST | 스터디 | FE · BE · 기획 | — |
| 황준희 | `j7hwang` | PST | 디스코드 | 운영 | **디스코드 리드** |

타임존이 KST 15 · PST 3 · EST 2 로 갈려 있다. 리뷰 요청이나 알림을 볼 때 상대의 낮 시간을 감안할 것.

## 코드 경로 → `area:` 라벨

`.github/labeler.yml` 이 변경된 경로를 보고 **자동으로** 붙인다. 새 앱/패키지를 추가하면
`labeler.yml` 과 `.github/labels.yml` 을 함께 갱신한다.

| 경로 | 라벨 | 주 담당 파트 |
|---|---|---|
| `frontend/apps/core-front/**` | `area: core-front` | FE |
| `frontend/apps/back-office-front/**` | `area: back-office-front` | FE |
| `frontend/apps/playground/**` | `area: playground` | FE · 디자인 |
| `frontend/packages/{ui,design}/**` | `area: design-system` | FE · 디자인 |
| `frontend/packages/mock/**` | `area: mock` | FE |
| `backend/api/**` | `area: backend-api` | BE |
| `backend/{domain,common}/**` | `area: backend-domain` | BE |
| `.github/**` · `Dockerfile` · `*.gradle.kts` · `docker-compose.yml` | `area: infra` | 인프라 |
| `docs/**` · `specs/**` · `*.md` | `area: docs` | 기획 · 전체 |

> 이 표의 "주 담당 파트"는 제안이다. 스쿼드별 실제 오너십이 정해지면 `CODEOWNERS` 에도 반영하자
> (현재는 `* @titaniper` 한 줄뿐이다).

## 라벨 쓰는 법

- `area:` · `type:` — **자동.** 손대지 않아도 된다.
  - `type:` 은 PR 제목의 컨벤셔널 프리픽스에서 딴다. `feat:` `fix:` `docs:` `ci:` `refactor:` `chore:`
    형태로 써야 붙는다. 프리픽스가 없으면 그냥 안 붙는다 (실패하지 않는다).
- `squad:` · `domain:` — **수동.** PR 을 열 때 본인 스쿼드와 건드리는 제품 도메인을 붙인다.

라벨 정의를 바꿨으면 반영:

```bash
./.github/scripts/sync-labels.sh            # .github/labels.yml → GitHub (멱등, 삭제는 안 함)
```

## Discord 알림 (네이티브 웹훅)

Discord 는 GitHub 웹훅 페이로드를 그대로 받아 렌더링하는 전용 엔드포인트를 제공한다.
**GitHub App 도, 별도 Action 도 필요 없다** — 웹훅 URL 하나로 끝난다.
(GitHub 은 Slack·Teams 용 공식 앱은 내지만 Discord 용 공식 앱은 없다. 마켓플레이스의
서드파티 앱들은 미검증인 데다 레포 권한을 요구해서, PUBLIC 레포에는 권하지 않는다.)

### 설정 — 레포 **admin 권한**이 필요하다

1. **Discord**: 알림 받을 채널 → 편집 → 연동 → 웹후크 → 새 웹후크 → **웹후크 URL 복사**
2. **GitHub**: 레포 Settings → Webhooks → Add webhook
   - **Payload URL**: 복사한 URL 뒤에 **`/github` 를 붙인다** ← 이게 핵심
     ```
     https://discord.com/api/webhooks/<id>/<token>/github
     ```
   - **Content type**: `application/json`
   - **Secret**: 비워둔다 (Discord 는 GitHub 서명 검증을 하지 않는다)
   - **Which events**: `Let me select individual events` 를 고르고 **아래 지원 목록 안에서만** 체크
3. `Active` 체크 → `Add webhook`

### Discord 가 지원하는 이벤트 — 이 밖은 체크하지 말 것

```
issues · issue_comment · pull_request · pull_request_review · pull_request_review_comment
push · commit_comment · create · delete · fork · member · public · release · watch
check_run · check_suite · discussion · discussion_comment
```

지원 목록 밖의 이벤트를 켜면 Discord 가 처리하지 못해 배달 실패가 쌓인다.
라벨 변경(`label`) 알림은 Discord 에서 동작하지 않는 것으로 알려져 있다.

### 한계 — 부족하면 그때 얹는다

포맷이 영어로 고정이고, 필터링·채널 라우팅·강조가 안 된다.
"PRD 올라오면 기획 채널에 눈에 띄게" 같은 요구가 실제로 생기면 그때 GitHub Actions 로
직접 만든다. 이 레포의 `area:`/`type:` 라벨이 이미 자동으로 붙고 있으므로,
그 라벨을 조건으로 쓰면 된다. 먼저 네이티브로 써보고 판단할 것.
