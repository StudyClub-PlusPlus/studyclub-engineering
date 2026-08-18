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
