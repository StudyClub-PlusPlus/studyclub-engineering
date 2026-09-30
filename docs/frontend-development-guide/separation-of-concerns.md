# Separation of Concerns

## Table of Contents

- [원칙](#원칙)
- [레이어별 책임](#레이어별-책임)
- [컴포넌트 분리 기준](#컴포넌트-분리-기준)
- [데이터 흐름](#데이터-흐름)

## 원칙

한 파일/함수/컴포넌트가 **한 가지 관심사**만 다루도록 한다.

- **UI** = 어떻게 보이는가 (렌더링, 스타일)
- **로직** = 무엇을 하는가 (상태 관리, 이벤트 처리)
- **데이터** = 어디서 가져오는가 (API 호출, 데이터 변환)

이 셋이 한 파일에 섞이면 변경 시 영향 범위가 커지고 테스트가 어려워진다.

## 레이어별 책임

```
src/
├── app/              # 라우팅 + 페이지 구성 (데이터 fetch → 컴포넌트 조합)
├── components/       # UI 렌더링 (props 받아서 그리기만)
├── lib/              # 비즈니스 로직, API 호출, 유틸
└── models/           # 타입 정의
```

### app/ (페이지)

- 데이터를 가져온다 (Server Component 에서 fetch 또는 import)
- 컴포넌트를 조합한다
- **직접 UI 를 그리지 않는다** (최소한의 레이아웃만)

```tsx
// ✅ 페이지는 데이터 + 컴포넌트 조합
export default async function StudiesPage() {
  const studies = await fetchStudies();  // 데이터
  return <StudyBrowser studies={studies} />;  // 위임
}

// ❌ 페이지에서 UI 로직까지 전부
export default async function StudiesPage() {
  const studies = await fetchStudies();
  const [filter, setFilter] = useState('all');
  const filtered = studies.filter(s => ...);
  return (
    <div className="grid grid-cols-3 gap-4">
      <select onChange={e => setFilter(e.target.value)}>...</select>
      {filtered.map(s => <div key={s.id}><h3>{s.title}</h3>...</div>)}
    </div>
  );
}
```

### components/ (UI)

- props 를 받아서 렌더링한다
- API 를 직접 호출하지 않는다
- 상태가 필요하면 UI 상태만 (탭 선택, 모달 열림 등)

```tsx
// ✅ 컴포넌트는 받은 데이터를 그리기만
interface StudyCardProps {
  study: Study;
  onJoin?: (id: string) => void;
}

export default function StudyCard({ study, onJoin }: StudyCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3>{study.title}</h3>
      <p>{study.description}</p>
      {onJoin && <button onClick={() => onJoin(study.id)}>참여</button>}
    </div>
  );
}
```

### features/ (그 기능의 데이터)

한 기능의 **타입·fetcher·쿼리 훅·전용 컴포넌트**가 한 폴더에 산다. 기능이 없어지면 폴더째 지운다.

```ts
// features/studies/queries.ts — 키·fetcher·훅을 같이 둔다
export const studyKeys = {
  all: ['studies'] as const,
  list: (filter: StudyFilter) => [...studyKeys.all, 'list', filter] as const,
};

export function useStudies(filter: StudyFilter) {
  return useQuery({
    queryKey: studyKeys.list(filter),
    queryFn: () => http<ApiStudyPage>(`/api/studies${qs(filter)}`),
    select: (page) => ({ rows: page.items.map(toRow), total: page.total }),
  });
}
```

### lib/ (기능을 모르는 유틸)

- `http.ts` — BFF 호출 래퍼, `ApiError`
- `query-client.ts` — QueryClient 생성
- `auth.ts` · 날짜·포맷 유틸

**기능 이름이 등장하면 `lib/` 이 아니다.** `lib/api/studies.ts` 같은 파일을 만들지 않는다 —
그건 `features/studies/` 로 간다.

## 컴포넌트 분리 기준

분리해야 할 때:
- **재사용** — 같은 UI 가 2곳 이상에서 쓰임 → 컴포넌트 분리
- **관심사 다름** — 필터 UI + 목록 UI → 각각 분리
- **Client/Server 경계** — 인터랙션 필요한 부분만 `'use client'` 로 분리

분리하지 않아도 될 때:
- 한 곳에서만 쓰이는 간단한 UI → 인라인으로 충분
- 10줄 미만의 단순 표시 → 별도 파일 불필요

## 데이터 흐름

읽기 전용 화면(랜딩·공개 목록):

```
Server Component (page.tsx) → fetch → props → Client Component (인터랙션만)
```

필터·저장이 있는 화면(운영 콘솔 대부분):

```
Client Component (page.tsx)
  → useXxx() 훅            (features/<기능>/queries.ts)
    → http()               (lib/http.ts)
      → /api/* BFF         (app/api/*)
        → 백엔드
```

**페이지에서 `fetch` 를 직접 부르지 않는다.** 훅을 거친다 — 그래야 로딩·에러·캐시를 매 화면에서
다시 짜지 않는다. 서버 상태는 `useState` 로 들고 있지 않는다(그건 캐시를 손으로 만드는 것이다).

- **단방향 데이터 흐름**: 위에서 아래로 props 전달
- **이벤트는 위로**: 콜백 함수를 props 로 전달, 자식이 호출
- **전역 상태 최소화**: props drilling 이 2단계 이하면 Context 불필요
