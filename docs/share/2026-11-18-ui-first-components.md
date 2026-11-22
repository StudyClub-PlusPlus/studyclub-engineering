---
상태: 결정됨
물어볼 사람: 프론트 개발 · 디자인
반영:
  - CLAUDE.md · AGENT.md (FE 핵심 요약 8) — 됨 (이 브랜치)
  - docs/frontend-development-guide/component-guide.md §공용 UI — 됨 (이 브랜치)
  - frontend/packages/design/docs/design-system.md §9-1 · §9-2 · §9-8 — 됨 (이 브랜치)
  - .claude/skills/prototype · self-review — 됨 (이 브랜치)
  - scripts/check-component-drift.mjs · .github/workflows/frontend-pr.yaml — 됨 (이 브랜치)
  - E2E 시나리오 · 대응표(core-e2e-prd-map · admin-e2e-prd-map) — 됨 (이 브랜치, PRD 원문은 그대로 두고 차이만 적음)
  - 01-planning/stories/crew-submit-application/PRD.md 「연동 확인중 … 스피너」 — 안 됨 (기획 확인)
  - 01-planning/stories/notification-history/PRD.md 재발송 「스피너」 — 안 됨 (기획 확인)
---

# 화면은 `@studyclub/ui` 부품으로만 짠다 — 예외는 태그에 이유를 적고, PR 검사가 막는다

## 미리 알아야 할 것

- **`@studyclub/ui`(packages/ui)** — 버튼 · 입력칸 · 탭처럼 여러 화면에 되풀이되는 모양을 한 번만 만들어 둔 부품 모음이다.
  사용자 사이트(core-front) · 운영 콘솔(back-office-front) · 프로토타입(playground)이 다 가져다 쓴다.
- **날 요소** — 부품 대신 HTML 의 `<button>` · `<input>` · `<select>` 를 화면에 직접 쓰고 클래스로 꾸민 것.
- **drift 검사** — `scripts/check-component-drift.mjs`. PR 마다 `design-drift` CI 가 돌린다. 「부품을 안 쓴 곳이 늘었나」를 센다.
- **카탈로그** — playground 의 `/components` 화면. ui 부품 실물을 한 화면에 늘어놓았다.

비유하면 레고다. 지금까지는 블록 상자(ui)가 있는데도 화면마다 찰흙으로 비슷한 블록을 빚어 붙였다.
모양이 조금씩 달라지고, 블록을 고쳐도 찰흙 쪽은 안 바뀌었다.

## 한 줄 요약

화면에서 ui 에 있는 부품을 다시 짜지 않는다. 없는 부품은 `packages/ui` 에 만든다.
일부러 다르게 둔 곳만 태그 안에 `// ui-native: 이유` 를 적는다. 이유 없는 날 요소는 PR 검사가 막는다(기준선 0).

## 왜 — 지금 뭐가 문제였나

- 규칙은 문서에 있었지만 검사는 「ui 와 같은 이름의 파일」만 봤다. 화면 안에 `<select>` · `<button>` 을 직접 써도 통과했다.
- 그래서 에이전트 · 사람 모두 playground 프로토에 입력칸 · 버튼을 새로 짰다. 세어 보니 날 버튼만 세 앱 합쳐 160개가 넘었다.
- 같은 「디스코드 · 자료실」 버튼이 세 파일에 복사돼 있었고, 도움말 말풍선도 다섯 군데 손으로 짜여 있었다.

## 정해진 것

1. **있으면 쓴다** — HTML 요소 대신 ui 부품.
   `<button>` → `Button` · `IconButton` / `<input>` → `Input` / 체크박스 · 라디오 → `Checkbox` · `Radio` / `<select>` → `Select` /
   켜고 끄기 → `Switch` / 알약 토글 · 요일 → `FilterChip` / 탭 줄 → `Segmented` · `Tabs` / 버튼 모양 링크 → `ButtonLink` / 「?」 도움말 → `HelpPopover`
2. **없으면 `packages/ui` 에 만든다** — 한 화면에서만 써도 같다. `pnpm --filter @studyclub/ui new-component {Name}` 이
   부품 · 스토리 · export · 카탈로그 칸을 한 번에 만든다. 만들기 전에 design-system.md §9 를 읽고, 없던 부품이면 같은 PR 에서 §9 에 스펙을 더한다.
3. **예외는 태그 안에 이유를 적는다** — `<button // ui-native: 출석부 칸 — 칸 전체가 누르는 곳`.
   인정하는 예외: 영역 전체가 누르는 곳(카드 · 표 칸 · 썸네일) · 고유 팝오버 위젯 · 표 머리 정렬 · 제목 링크 · 칩 안의 작은 표시 ·
   브랜드 규정(구글 · 애플 로그인) · 구글 폼 모양 설문 · 숨긴 파일 칸 · playground 검토 도구. 지금 세 앱에 80곳이 있다.
4. **검사** — 이유 없는 날 `<button>` · 폼 요소 · 버튼처럼 꾸민 링크 · 손으로 짠 말풍선, 스토리 없는 ui 부품, 카탈로그에 없는 ui 부품은 PR 을 막는다.
5. **프론트 PR CI** — `frontend-PR-CI` 가 playground 까지 포함해 lint · typecheck · 시험 · playground 빌드 · Storybook 빌드를 돌린다.
   결과는 `frontend-check` 하나로 모인다. (playground-beta 의 PR 검사는 여기로 합쳤다.)

### 화면에서 달라진 것

- 삭제를 여는 버튼(공지 · 템플릿 · 스터디 삭제)이 밑줄 글자에서 빨간 테두리 버튼(`danger`)으로 — design-system §9-1 · POL-0008 대로다
- 요일 · 반복 · 카테고리 고르기가 네모 칸 · 제각각 알약에서 `FilterChip` 알약으로 하나가 됐다
- 버튼 안에 돌던 로딩 스피너가 없어졌다 — §9-1 은 버튼 안 스피너를 쓰지 않는다(버튼을 잠그고 바깥에서 알린다)
- 스터디 상세의 신청 버튼만 예외로 알약 · 너비 100% 를 유지한다

## 영향 — 누가 무엇을 해야 하나

- **프론트 개발 · 에이전트** — 화면을 짤 때 `packages/ui/src/index.ts` 부터 본다. PR 전에 레포 루트에서 `node scripts/check-component-drift.mjs`.
- **디자인** — 새 부품이 생기면 design-system.md §9 에 스펙이 같이 들어온다. 카탈로그(`/components`)에서 실물을 본다.
- **기획** — 프로토타입도 같은 부품으로 짜인다. 프로토에서 본 모습이 실제 앱 모습이다.
  PRD 두 곳이 「스피너」를 적고 있다 — 스터디 신청의 「연동 확인중」, 알림 이력의 재발송. 지금 화면은 버튼을 잠그고 스피너를 돌리지 않는다.
  PRD 를 「버튼이 잠긴다」로 고칠지, 스피너를 다시 둘지(그러면 design-system §9-1 도 고친다) 정해 주세요.
- 로컬에서 `pnpm test` 가 `localStorage` 오류로 수십 개 깨지면 Node 25 이상이라서다 — Node 22 를 쓰거나 `NODE_OPTIONS=--no-experimental-webstorage`.
