---
name: prototype
description: "유저스토리 하나의 playground 프로토타입을 생성·수정하고, PR 전에 그 프로토타입을 근거로 Story PRD 와 API 스펙을 갱신하고, 화면 캡처를 PR 에 싣고, 끝나면 EPIC · STORY · TASK 나누는 안을 승인받아 ZAPP 에 반영한다. prototype-agent 스킬 규약을 따른다. 유저스토리 화면을 playground 에 새로 만들거나 고칠 때, 프로토 PR 전에 PRD·spec.ts·스펙·레지스트리를 맞출 때 쓴다. 「프로토타입 만들어」「프로토 고쳐」「playground 에 화면 추가」「PRD 갱신」「/prototype {정규문장}」"
---

# /prototype — 유저스토리 프로토타입 → 문서

한 유저스토리의 playground 프로토타입을 만들거나 고치고, **PR 올리기 전에** 그 프로토타입을 근거로 문서를 맞춘다.
규약의 정본은 [prototype-agent](https://github.com/StudyClub-PlusPlus/prototype-agent) 레포의 두 파일이다. 작업 전에 둘 다 읽는다.

- [`SKILL.md`](https://github.com/StudyClub-PlusPlus/prototype-agent/blob/main/SKILL.md)
- [`references/prd-guide.md`](https://github.com/StudyClub-PlusPlus/prototype-agent/blob/main/references/prd-guide.md) (아래 「prd-guide §…」는 이 파일의 절)

이 레포에는 사본이 없다. `gh api repos/StudyClub-PlusPlus/prototype-agent/contents/{경로} -H 'Accept: application/vnd.github.raw'` 로 읽는다.

## 사용법

```
/prototype {USER_STORY}
```

`{USER_STORY}` 는 정규문장 그대로 받는다. 목록은 [`01-planning/_registry/stories.md`](../../../01-planning/_registry/stories.md) 의 유저스토리 표다.

```
/prototype 네비게이터로서, 스터디별 공지를 등록할 수 있다.
```

## 전제

- **레지스트리 모드**로 동작한다. Story 는 [`01-planning/_registry/stories.md`](../../../01-planning/_registry/stories.md) 의 `ST-###` 행이다.
  새 Story·화면이면 같은 파일 맨 위 번호 대장(NUMBER LEDGER)에서 `ST`·`IA` 번호를 받고, 같은 커밋에서 `next` 를 +1 한다
- 여러 Story 에 걸치는 규칙은 PRD 에 값을 쓰지 않고 [`POL-####`](../../../01-planning/_registry/policies.md) 를 가리킨다
- Story 폴더 이름(`{story-name}`)은 kebab-case, `{actor}-{행동}` (예: `crew-edit-profile`, `captain-publish-study`)
- 표에 이미 PRD 가 걸린 Story 면 **수정**, PRD 칸이 비어 있으면 **생성**이다

## 1. 프로토타입 생성·수정

위치: `frontend/apps/playground/src/`

| 관객 | 화면 | 공용 컴포넌트 |
| --- | --- | --- |
| 크루 (사용자 사이트) | `app/(proto)/proto/core/[locale]/…/page.tsx` | `proto/core/` |
| 캡틴 (운영 콘솔) | `app/(proto)/proto/console/…/page.tsx` | `proto/console/` |
| 네비게이터 · 캡틴 (사용자 사이트 스터디 관리) | `app/(proto)/proto/core/[locale]/my/joined/[id]/manage/…` | `proto/core/` |

**부품은 `@studyclub/ui` 에서 가져온다.** 화면을 짜기 전에 `frontend/packages/ui/src/index.ts` 의 export 목록부터 본다.

- `<input>` → `Input` · `<input type="checkbox">` → `Checkbox` · `<input type="radio">` → `Radio` · `<select>` → `Select` · `<textarea>` → `Textarea`/`AutoTextarea` · `<button>` → `Button`/`IconButton` · 켜고 끄기 → `Switch`.
  프로토에 HTML 폼 요소 · `<button>` 을 직접 쓰지 않는다. 알약 토글은 `FilterChip`, 탭 줄은 `Segmented`·`Tabs`, 표 칸 아이콘은 `IconButton size='xs'`, 버튼 모양 링크는 `ButtonLink`, 「?」 도움말은 `HelpPopover`.
  카드 전체가 누르는 곳 같은 예외는 여는 태그 안에 `// ui-native: 이유` 를 단다
  ([component-guide 예외 표](../../../docs/frontend-development-guide/component-guide.md#공용-ui--studyclubui-먼저))
- 모양이 안 맞으면 `frontend/packages/ui` 부품에 variant·props 를 더한다 — 그래야 프로토에서 본 모습이 실제 앱에도 들어간다
- 필요한 부품이 없으면 `proto/` 가 아니라 `packages/ui` 에 만든다 — `pnpm --filter @studyclub/ui new-component {Name}` 이 본체 · 스토리 · `index.ts` export · `/components` 카탈로그 칸을 함께 만든다
- 부품을 만들거나 고치기 전에 [`frontend/packages/design/docs/design-system.md`](../../../frontend/packages/design/docs/design-system.md) §9(부품 스펙)와 §2~§7(토큰), `tokens.css` 를 읽고 그대로 따른다.
  §9 에 없는 부품이면 같은 PR 에서 §9 에 스펙을 추가한다
  ([component-guide §공용 UI](../../../docs/frontend-development-guide/component-guide.md#공용-ui--studyclubui-먼저))

`proto/` 에 ui 와 같은 이름의 부품을 새로 만들지 않고, 색은 Tailwind 기본 팔레트(`text-red-600` …)나 색 코드(`text-[#FCD34D]`) 대신 토큰(`text-danger-fg` …)을,
글자 크기는 `text-[13px]` 대신 타입 스케일(`text-xs` · `text-sm` …)을 쓴다. 맞는 토큰이 없으면 `tokens.css` 에 먼저 추가한다.

1. 기존 화면이 이 Story 를 담을 수 있으면 그 화면을 고친다. 새 지면은 기존 지면에 자리가 없을 때만 만든다
2. 데이터는 `@studyclub/mock` 을 쓴다. 실 API 교체 지점에 `// TODO(api): {METHOD} {path}` 를 단다
   - **스터디를 가리키는 주소 값은 `study_id`(STUDY.ID) 다** — 경로의 `[id]` 도 `study_id` 다.
     mock 스터디의 문자열 `id` 는 신청·북마크·출석 저장용 내부 키라 URL 에 넣지 않는다
3. **번호별 명세를 `spec.ts` 로 같은 폴더에 둔다** — 프로토타입의 필수 산출물이다
   - `ScreenSpec` 하나 = Story 하나. `chip` 은 Story 짧은 이름, `scope` 는 번호 이름공간
   - 번호는 **Story 마다 1 부터**. 큰 영역 `1`, 그 안의 요소 `1-1`
   - 화면 요소에 `data-anno="<scope>:<n>"` 을 단다. 조건부 요소는 `when` 을 적는다
   - `display` 는 형태가 아니라 **알려주는 것**, `policy` 는 **코드로 옮길 수 있는 규칙**만 (prd-guide §1.4-A·B)
   - 페이지에서 `<ScreenSpecRegistrar spec={SPEC} />` 로 등록한다
4. 주석 모드를 켜고 **번호 → 대상 요소 대조표**에서 대조 실패가 0 인지 확인한다
5. `frontend/` 에서 `pnpm --filter playground run build` 가 통과해야 커밋한다 — playground 는 `beta` 에서 바로 배포된다
   - 레포 루트에서 `node scripts/check-component-drift.mjs` 도 통과해야 한다 — ui 부품 사본·날 HTML 폼 요소·날 `<button>`·토큰 우회가 기준선보다 늘거나 스토리가 없거나 카탈로그에 없는 ui 부품이 있으면 실패한다

## 2. 문서 갱신 (PR 올리기 전)

프로토타입이 **정본**이다. 문서는 프로토타입과 `spec.ts` 를 근거로 쓰고, 프로토에 없는 것은 창작하지 않는다.

### PRD.md — `01-planning/stories/{story-name}/PRD.md`

- prd-guide 의 Story PRD 구성을 따른다
  - 제목 = 정규문장 · `기준 프로토타입:` 한 줄
  - §1 기본설명 (흐름 다이어그램 · 완료 기준) · §2 화면명세 (`spec.ts` 번호와 1:1) · §3 시스템 요건 · §4 미확정
- **§3 맨 앞에 `### 개발 범위` 표를 둔다** — `| 구분 | 대상 | 지금 | 할 일 |`. 기준일과 `beta` 를 머리에 적는다
  - FE 줄: 실제 앱(core-front · back-office-front)의 라우트·컴포넌트와 데이터 연결(API · mock · 없음)
  - BE 줄: 엔드포인트마다 스펙 상태 칸 값을 그대로 옮긴다. 스펙이 없으면 「스펙 없음」
  - 기획 줄: 문서끼리 어긋나 정해야 하는 것
  - 다 끝나면 「할 일」이 모두 「없음」이 된다. PRD 를 고칠 때마다 이 표도 다시 본다
- `spec.ts` 의 번호·`display`·`behavior`·`policy`·`data` 를 §2 의 내용·동작·정책·데이터로 옮긴다. 번호를 바꾸지 않는다
- **`§2 화면명세` 안에 `spec.ts` 의 `scope` 마다 마커 쌍을 반드시 넣는다** — `scope` 생략 시 `screen`

  ```markdown
  <!-- spec:start {scope} -->

  <!-- spec:end {scope} -->
  ```

  마커를 넣은 뒤 `frontend/` 에서 `pnpm --filter playground export-specs` 를 실행하면 내용을 자동으로 채운다. **마커가 없으면 playground CI(`export-specs --check`)가 막는다.**
- 프로토 링크는 배포된 절대 URL 만. 배포 전이면 지면 이름만 적는다
- prd-guide §5 자가 검증 체크리스트를 통과시킨다

### SPEC.md — API 계약

- 이 레포의 API 계약은 `specs/{도메인}/spec.md` 다. Story 폴더에 따로 만들지 않는다
- 프로토의 `TODO(api)` 와 PRD §3 의 API 가 스펙의 엔드포인트 목록에 있는지 확인한다. 없으면 [`/spec`](../spec/SKILL.md) 규약으로 추가한다
- 스펙 헤더의 `Story PRD:` 에 PRD 링크를 건다

### 인덱스

- [`01-planning/_registry/stories.md`](../../../01-planning/_registry/stories.md) 유저스토리 표의 PRD · 프로토 · Spec 칸에 링크를 건다
- 새 화면이면 [`01-planning/_registry/informationarchitecture.md`](../../../01-planning/_registry/informationarchitecture.md) 에 `IA-###` 노드를 추가한다
- 새 도메인 스펙이면 [`specs/README.md`](../../../specs/README.md) 표에도 한 줄 추가한다

## 3. 화면 캡처 (PR 올리기 전)

리뷰어가 playground 를 띄우지 않고도 화면을 보게, **프로토 PR 에는 화면 캡처를 반드시 싣는다.** 손으로 찍지 않고 목록으로 찍는다 — 화면이 바뀌면 같은 목록으로 다시 찍는다.

1. 찍을 화면 목록을 `01-planning/stories/{story-name}/screens/shots.json` 에 쓴다 (형식은 [`capture-screens.mjs`](../../../frontend/apps/playground/scripts/capture-screens.mjs) 머리 주석)
   - PRD §2 「상태별 화면」 중 **그림으로 봐야 아는 상태**를 고른다: 기본 · 조건부 요소가 보이는 상태 · 검증 실패 · 역할별 차이. 카피 한 줄이 전부인 상태(빈 결과 · 로딩)는 찍지 않는다 (prd-guide §1.4)
   - 넓은 표·화면이 있으면 모바일(`"viewport": "mobile"`)도 한 장
2. `frontend/` 에서 `pnpm --filter playground capture-screens 01-planning/stories/{story-name}/screens/shots.json --md`
   - 서버가 없으면 스크립트가 `next dev` 를 띄운다. 로그인은 예시 계정(example.com)으로 들어간다
   - 한 장이라도 실패하면 멈춘다. 목록을 고쳐 다시 찍는다 — 빠진 채로 올리지 않는다
3. 찍힌 PNG 를 **열어서 본다.** 빈 화면 · 로딩 중 · 개발 도구 오류 표시 · 실제 개인정보(이름 · 메일)가 찍혔으면 다시 찍는다 (PUBLIC 레포)
4. `screens/` 폴더(PNG + `shots.json`)를 같은 커밋에 넣는다

## 4. PR

- 대상 브랜치는 `beta`
- 한 PR = 한 Story. 프로토타입과 문서를 같은 PR 에 담는다
- 본문에 Story 정규문장 · 프로토 지면 · PRD 링크 · 스펙 변경 여부 · 남은 미확정을 적는다
- 본문에 **`## 화면` 절** — 3 의 `--md` 가 출력한 마크다운을 그대로 붙인다 (push 뒤에 붙여야 이미지가 열린다. 이미 올린 PR 이면 `gh pr edit {번호} --body-file`)
- `pr-dev-rules` 가 프로토 화면이 바뀌었는데 `screens/*.png` 가 없으면 경고를 단다

## 5. ZAPP 반영 (PR 을 올린 뒤 — 매번)

프로토타입 작업이 끝나면 **언제나** 작업 결과를 ZAPP 에 반영한다. 단, ZAPP 에 쓰기 전에 **나누는 안을 먼저 제안하고 승인을 받는다.** 승인 없이 만들지 않는다.

### 5-1. 읽기

- `list_projects` → 프로젝트(StudyClub++) · `list_initiatives` · `list_issues`(같은 기능 이름으로) — 이미 있는 에픽 · 스토리에 붙일 수 있으면 새로 만들지 않는다
- 기획에서 시작한 기능이면 `get_plan_case(include: ['items'])` 로 R · F · S 항목을 읽는다

### 5-2. 나누는 안 제안 (채팅으로, 표 하나)

| 층 | ZAPP | 나누는 기준 |
|---|---|---|
| **EPIC** | 이니셔티브 (`save_initiative`) | 기능 하나 — 사용자가 이름으로 부르는 덩어리 (예: 스터디 미팅 회고). 이미 있으면 그걸 쓴다 |
| **STORY** | 이슈 `type: STORY` (`initiativeId` 로 에픽에) | `stories.md` 의 `ST-###` 하나 = ZAPP 스토리 하나. 제목은 정규문장 그대로, 본문에 PRD · 프로토 · PR 링크 |
| **ISSUE(TASK)** | 이슈 `type: TASK` (`parentId` = 스토리, `discipline`) | PRD §3 「개발 범위」 표의 「할 일」이 있는 줄 하나 = 작업 하나. FE 줄 → `DEV`(core-front/back-office-front 화면 · API 연결), BE 줄 → `DEV`(엔드포인트 묶음), 기획 줄 → `PLAN`, 디자인 시안 손질 → `DESIGN`, 화면 카탈로그(e2e) → `QA` |

제안 표에는 층 · 제목 · 상위 · 직군 · 근거(PRD 의 어느 줄)를 적는다. 이미 있는 것은 「기존 — 갱신」으로 표시한다.
같이 묻는다: 기획(plan case) 항목에 프로토에서 새로 생긴 요구(R · F · S)를 제안으로 올릴지 · 디자인 아티팩트를 스토리에 걸지.

### 5-3. 승인 뒤 반영

1. 에픽: `save_initiative` (없을 때만 생성, `stage: 'screens'`, note 에 PR 링크)
2. 스토리: `create_issue(type: 'STORY', initiativeId)` — 이미 있으면 `update_issue` 로 본문에 PRD · PR 링크만 더한다
3. 작업: `create_issue(type: 'TASK', parentId: 스토리, discipline)` — `status: 'BACKLOG'`. 마감 · 담당은 사람이 정한다 (비운다)
   - 기획 기능명세와 잇는다: 이슈를 기능명세 항목에 직접 거는 도구는 없다(`prdId` 는 옛 기능 스펙용). 스토리 · 작업 본문 끝에 `기능명세: F-01 · S-01 …` 줄과 기획 링크를 적는다. 승인 전 신규 항목은 제목으로 적고, 승인되어 코드가 붙으면 코드로 바꾼다
4. 승인받았으면: `propose_plan_items`(늘 제안 — 사람이 기능명세 탭에서 승인) · `link_artifact`(디자인 아티팩트 → 스토리)
5. 만든 것의 링크를 채팅에 표로 남기고, PR 본문 끝에 「ZAPP」 한 줄(에픽 · 스토리 링크)을 더한다

승인받지 못한 층은 만들지 않는다. 일부만 승인했으면 승인한 것만 만든다.
