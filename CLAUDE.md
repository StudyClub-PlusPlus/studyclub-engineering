# StudyClub · AI Agent Context

**코드를 읽거나 작성하기 전에 [`AGENT.md`](AGENT.md) 를 반드시 읽을 것.**
프로젝트 개요, 보안 규칙, BE/FE 개발 규약, docs 참조가 모두 거기에 있다.


## 프론트 부품 — `@studyclub/ui` 먼저

`frontend/` 의 화면(core-front · back-office-front · playground 프로토)을 만들거나 고칠 때 이 순서를 따른다.
여러 화면에 되풀이되는 모양이 대상이다. 한 곳에만 있고 일부러 다르게 꾸민 것(설문 빌더의 밑줄 칸, 카드형 라디오 등)은 억지로 부품에 맞추지 않는다.

1. **있는지 먼저 본다** — `frontend/packages/ui/src/index.ts` 의 export 목록. 있으면 `import { … } from '@studyclub/ui'` 로 쓴다
   - `<input>` → `Input`(검색은 `leadingIcon`) · `<input type="checkbox">` → `Checkbox`(표의 행 선택은 `hideLabel`) · `<input type="radio">` → `Radio` · `<select>` → `Select` · `<textarea>` → `Textarea`/`AutoTextarea` · `<button>` → `Button`/`IconButton` · 켜고 끄기(`role="switch"`) → `Switch`
   - 라벨·도움말·오류는 `FieldShell` (또는 `Input` 의 `label`·`helper`·`error` props)
   - 알약 토글 · 요일 고르기 → `FilterChip`(폼 값이면 `role='radio'`) · 화면 전환 알약 줄 → `Segmented` · 밑줄 탭 → `Tabs` · 표 칸의 작은 아이콘 → `IconButton size='xs'`
   - 버튼 모양의 링크 → `ButtonLink`(앱 안은 `linkAs={Link}`, 바깥 사이트는 `external`) — `sc-button` 클래스를 손으로 붙이지 않는다 · 「?」 도움말 말풍선 → `HelpPopover`
   - **예외는 여는 태그 안에 이유를 단다** — `<button // ui-native: 카드 전체가 누르는 곳`. 인정하는 예외: 카드 · 표 칸 · 썸네일처럼 영역 전체가 누르는 곳, 고유 팝오버 위젯(listbox · 아바타 메뉴)의 단추 · 항목, 표 머리 정렬 · 제목 링크, 칩 · 썸네일 안에 겹친 작은 표시, 브랜드 규정 버튼(구글 · 애플 로그인), 구글 폼 모양 설문 칸, 숨긴 파일 선택 칸, playground 검토 도구. 표시 없는 날 `<button>` · 폼 요소는 drift 검사가 막는다(기준선 0)
2. **모양이 조금 안 맞으면 부품을 고친다** — 화면에서 className 으로 덮거나 HTML 요소로 새로 짜지 않고, `packages/ui` 부품에 variant·size·props 를 추가한다
3. **없으면 `packages/ui` 에 새로 만든다** — 앱·`proto/` 에 만들지 않는다. `frontend/` 에서 `pnpm --filter @studyclub/ui new-component {Name}` 을 실행하면 `src/{Name}.tsx` · `src/{Name}.stories.tsx` · `index.ts` export · playground `/components` 카탈로그 칸이 함께 생긴다. 스토리와 카탈로그 칸은 지우지 않고 상태별로 채운다. 작성 규칙은 [`frontend/packages/ui/docs/component-guide.md`](frontend/packages/ui/docs/component-guide.md)
   - **코드를 쓰기 전에 디자인 문서를 읽는다** — [`frontend/packages/design/docs/design-system.md`](frontend/packages/design/docs/design-system.md) 의 §9 Components(같은 부품·비슷한 부품 스펙), §2 색 · §3 타이포 · §4 간격 · §5 라운딩 · §6 그림자 · §7 모션 · §11 접근성, 그리고 `frontend/packages/design/tokens.css`. 색·크기·라운딩·그림자는 문서의 semantic 토큰으로만 쓴다
   - 기존 부품을 바꾸는 경우(2번)도 그 부품의 §9 스펙을 먼저 읽고 어긋나지 않게 한다
   - §9 에 없는 부품이면 **같은 PR 에서 §9 에 스펙을 추가**한다 (9-8 표 한 줄 또는 새 절). 필요한 토큰이 없으면 `tokens.css` 와 §2~§7 에 먼저 추가한다 — 문서에 없는 값을 부품에서 지어내지 않는다
4. **검사** — 레포 루트에서 `node scripts/check-component-drift.mjs`. 스토리가 없거나 `/components` 카탈로그에 안 보이는 ui 부품이 하나라도 있으면, 또는 날 HTML 폼 요소·날 `<button>`·같은 이름 사본·토큰 우회가 기준선보다 늘면 실패한다 (PR 의 `design-drift` CI 도 같은 검사)

## 그로스 계측 — 기능을 만들 때 퍼널까지 본다

- 이 레포의 트래킹 플랜(이벤트 목록의 정본): `specs/analytics/spec.md`
- **기능 스펙에는 `## 퍼널·계측` 절을 둔다.** 이 기능이 퍼널(유입 → 가입 → 활성화 → 결제 → 재방문) 어느 단계를 바꾸나 · 추가/변경 이벤트(Amplitude 이름 / GA4 이름 / front·server) · 이 서비스의 지표 하나(OMTM)에 기대하는 변화 · 실험(A/B)으로 확인할지. 바꾸는 게 없으면 "해당 없음" 한 줄
- 이벤트를 추가·변경하면 **같은 PR 에서** 트래킹 플랜 표를 고친다. 코드에만 있는 이벤트, 표에만 있는 이벤트를 만들지 않는다
- 가입·결제·활성화처럼 확정되는 사건은 **서버에서** 보낸다 — insertKey 필수(자연키에서 결정적인 insert_id), 트랜잭션 커밋 후, 비동기, 실패는 삼킨다
- 이름: Amplitude 는 Title Case 과거형(`User Signed Up`), GA4 는 권장 이벤트 이름(`sign_up`), 속성은 snake_case. 주문 건수는 `Order Completed`(금액 없음), 매출은 `Revenue Tracked`
- user_id 에 이메일·이름을 넣지 않는다. Clarity 는 개인정보·토큰이 보이는 영역에 `data-clarity-mask="true"`
- GA4·Clarity 는 운영(`APP_ENV=production`)에서만 로드한다. utm_medium 은 GA4 인식값만(cpc·social·email·referral…)
