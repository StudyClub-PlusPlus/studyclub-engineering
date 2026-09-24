# playground — 디자인 샌드박스

디자이너·기획자가 **실제 서비스 컴포넌트로** 화면을 조립해 보는 곳입니다.
여기서 무엇을 깨뜨려도 `studyclub-plusplus.com` 배포는 영향을 받지 않습니다.

- 로컬: http://localhost:4702
- 배포(예정): https://playground.studyclub-plusplus.com — `main` 에 머지되면 자동 반영

---

## 처음 한 번만 (설치)

터미널을 열고 아래를 위에서부터 그대로 붙여넣습니다.

```bash
git clone git@github.com:StudyClub-PlusPlus/studyclub-engineering.git
cd studyclub-engineering/frontend
npm install
```

> `git clone` 이 권한 오류를 내면 GitHub 계정이 `StudyClub-PlusPlus` 조직에 아직 안 들어온 것입니다. 디스코드에서 알려주세요.

## 띄우기

```bash
cd studyclub-engineering/frontend
npm run dev --workspace=playground
```

브라우저에서 http://localhost:4702 를 엽니다. 파일을 저장하면 화면이 알아서 새로고침됩니다.

## 화면 하나 추가하기

```bash
cd studyclub-engineering/frontend/apps/playground/src/app/screens
cp -r study-detail 내가-만들-화면-이름
```

1. `내가-만들-화면-이름/page.tsx` 를 열어 내용을 고칩니다
2. `src/app/page.tsx` 의 `ENTRIES` 배열에 링크를 한 줄 추가합니다
3. http://localhost:4702 에서 확인합니다

**규칙 하나** — 버튼·카드 같은 부품은 직접 만들지 말고 `@studyclub/ui` 에서 가져옵니다.
어떤 게 있는지는 http://localhost:4702/components 에서 전부 볼 수 있습니다.

### 디자인 시스템 문서 3종의 역할

| | 무엇 | 언제 본다 |
|---|---|---|
| `packages/design/docs/design-system.md` | 규칙의 **정본** — 색·타이포·간격·접근성 기준 | 왜 이렇게 생겼는지 알고 싶을 때 |
| `packages/design/docs/styleguide.html` | 손으로 쓴 **정적 목업** | 의도한 모습을 볼 때 (코드와 갈릴 수 있음) |
| **이 playground `/components`** | **실제 React 컴포넌트를 렌더** | 지금 코드가 어떻게 생겼는지 볼 때 |

```tsx
import { StudyCard, StatusBadge, Pill } from "@studyclub/ui";
```

여기 없는 부품이 필요하면 **일단 그 화면 파일 안에** 만들어 두세요.
같은 게 두 화면에서 쓰이게 되면 그때 `packages/ui` 로 올립니다 (개발자에게 말해주세요).

## 색·글꼴을 바꾸고 싶다면

`frontend/packages/design/tokens.css` 한 파일입니다. 여기를 고치면
playground 와 실제 서비스가 **같이** 바뀝니다 — 그래서 시안 확인용으로 정확합니다.
바꾸기 전에 `packages/design/docs/design-system.md` 의 토큰 규칙을 먼저 읽으세요.

## 올리기 (PR)

```bash
cd studyclub-engineering
git checkout -b design/내가-만든-화면
git add -A
git commit -m "design: 내가 만든 화면 시안"
git push -u origin design/내가-만든-화면
```

푸시하면 터미널에 PR 링크가 뜹니다. 그 링크를 열고 **base 브랜치가 `beta` 인지** 확인한 뒤 만듭니다.
(`main` 이 아닙니다. `main` 은 승인이 필요한 배포 브랜치입니다.)

---

## 개발자용 메모

- 이 앱은 `core-front` 와 **배포가 완전히 분리**돼 있다. playground 빌드가 깨져도 core-front CI 는 영향 없음
- 컴포넌트는 `@studyclub/ui`(디자인 시스템 프리미티브), 토큰은 `@studyclub/design`, 데이터는 `@studyclub/mock`. 백엔드 호출 없음
- `robots.ts` 로 전체 noindex — 미공개 시안이 검색에 잡히지 않게
- 카탈로그는 **프리미티브만** 다룬다. `StudyCard`·`Nav` 같은 도메인 컴포넌트는 core-front 앱 안에 있어 여기서 import 하지 않는다.
  두 앱에서 같은 도메인 컴포넌트가 필요해지면 그때 `packages/ui` 승격을 논의한다

---

## 프로토 (`/proto`)

`/components` 가 **부품** 카탈로그라면 `/proto` 는 **완성된 화면**입니다.
신청부터 출석까지 이어지는 사용자 사이트 10개 · 운영 콘솔 5개를 실제 코드 그대로 띄웁니다.

http://localhost:4702/proto 로 들어가면 **사이트 첫 화면으로 바로 진입**합니다.
화면 이동은 색인 목록이 아니라 사이트의 진짜 Nav 로 합니다 — 실제 동선을 그대로 겪어 보라고요.
운영 콘솔로는 상단 검은 바에서 건너갑니다.

- 사용자 사이트: `/proto/core/ko/...` (ko·en 둘 다 있습니다)
- 운영 콘솔: `/proto/console/...`

로그인해야 열리는 화면(마이페이지·내 스터디)은 미리보기 세션이 자동으로 깔립니다.
데이터는 전부 mock 이고, 입력한 값은 브라우저에만 남습니다.

### 설명 보기

화면 아래 **설명 보기** 버튼(단축키 <kbd>A</kbd>)을 누르면 요소마다 번호 배지가 붙고
오른쪽에 그 번호의 설명이 열립니다. 기획서의 "1 · 1-1 · 1-2" 번호 규칙을 화면 위에서 그대로 씁니다.

지금 명세가 있는 화면은 아래입니다.

| 화면 | 주소 | 명세 출처 |
|---|---|---|
| 회원가입 · 온보딩 | `/proto/core/ko/onboarding?scenario=default` | Story PRD · `specs/user-onboarding/spec.md` |
| Google 로그인 미리보기 | `/proto/core/ko/login?scenario=new` | 온보딩 진입·복귀 흐름 |
| 스터디 목록 | `/proto/core/ko/studies` | Story PRD 「크루로서, 스터디 목록을 둘러보고 검색·필터링할 수 있다.」 |
| 스터디 상세 · 신청 | `/proto/core/ko/studies/{id}` | Story PRD 「크루로서, 스터디 신청 폼을 제출할 수 있다.」 |
| 스터디 등록 모달 | `/proto/console/studies?new=1` | Story PRD 「운영자로서, 스터디를 등록할 수 있다.」 |
| 내 스터디 · 참여 모음 | `/proto/core/ko/my/joined` | 코드 (`lib/joined.ts`, `lib/attendance-book.ts`) |
| 내 스터디 · 출석 | `/proto/core/ko/my/studies` | 코드 (`lib/attendance.ts`) |
| 스터디 운영 | `/proto/console/studies/{id}` | 코드 (`StudyConsole.tsx`) |

**기획 문서는 앱과 자동으로 연결되지 않습니다.** 문서가 정본이고, `spec.ts` 는 그것을 옮겨 적은 사본입니다.
문서를 고치면 `spec.ts` 도 같이 고쳐야 합니다.

### 온보딩 시안 검토

- 한국어: `/proto/core/ko/onboarding?scenario=default`
- 영어: `/proto/core/en/onboarding?scenario=default`
- 상단의 **화면 상태**로 필수값 누락, 닉네임 형식·중복, 서버 오류, 세션 만료, 제출 중을 확인합니다. **초기화**는 작성 중인 값을 지우고 해당 상태로 돌아갑니다.
- **로그인**에서는 신규·미완료·기존 회원의 진입 동선과 인증 취소·실패를 확인합니다. 실제 Google 인증이나 API 호출은 하지 않습니다.
- 언어를 전환해도 작성 중인 값과 동의가 유지됩니다. 시간대는 기기 값을 기본 선택하고, 국가·도시 또는 IANA 이름으로 검색합니다.
- 약관 2종은 기존 한국어 원문을 스크롤 박스로 재사용합니다. 영어 화면에도 한국어 약관 제공 안내가 있으며, 영문 법률 문안은 별도 준비가 필요합니다.
- 작성 중 값은 탭의 `sessionStorage`에 저장하고 완료·초기화 때 지웁니다. 완료한 예시 프로필은 기존 미리보기 세션의 `localStorage`에만 저장됩니다. 서버 저장·메일 발송은 없습니다.
- `next`로 전달된 playground 내부 주소가 있으면 가입 후 해당 화면으로 돌아갑니다. 외부 주소는 허용하지 않습니다.

정책 출처: [온보딩 PRD](https://app.notion.com/p/benkang/1f683feabad3839b996781bd773ec465), `specs/user-onboarding/spec.md`.
실제 서비스 연동 시 로그인 응답의 `user.name`·최상위 `suggestedNickname`과 명세의 응답 구조 차이, `core-front` 로그인 중계의 `suggestedNickname` 전달을 확인해야 합니다. 시안은 playground 안에서만 동작합니다.

### 새 화면에 번호를 달려면

1. 화면의 요소에 `data-anno="1-1"` 을 답니다 — 번호는 **화면 위 위치 기준**, 큰 영역이 `1`, 그 안이 `1-1`
2. 같은 폴더에 `spec.ts` 를 두고 번호마다 설명을 씁니다
3. 화면 컴포넌트 안에 `<ScreenSpecRegistrar spec={SPEC} />` 를 한 줄 놓습니다
4. 화면에서 설명을 켜고 배지가 의도한 요소에 붙었는지 봅니다

같은 번호가 목록에서 여러 번 나오면 **첫 번째에만** 배지가 붙습니다 — 번호는 요소의 종류에 붙는 것이라서요.
탭 전환처럼 조건부로만 보이는 요소는 `when: '탭이 …일 때'` 를 적어 두면 "대조 실패"로 세지 않습니다.

### 원본과의 관계

`/proto` 화면은 `core-front` · `back-office-front` 에서 **복사해 온 사본**입니다.
자유롭게 고쳐도 실서비스에 영향이 없지만, 원본이 바뀌면 여기는 따라오지 않습니다.
색·타이포는 `packages/design/tokens.css` 를 공유하므로 토큰을 고치면 양쪽이 같이 바뀝니다.
