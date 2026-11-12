# @studyclub/mock

StudyClub 모노레포의 공유 목 데이터 + MSW(Mock Service Worker) 계층 패키지입니다. 공용 타입과 함수는 `@studyclub/types`, `@studyclub/utils`에 있습니다.

## 디렉토리 구조

```
frontend/packages/mock/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                     # mock 데이터·설정 진입점
    │
    ├── constants/                   # 상수 정의
    │   ├── study.ts                 # 예시 신청 폼 템플릿
    │   ├── community.ts
    │   └── index.ts
    │
    ├── data/                        # 순수 Mock 데이터 소스
    │   ├── index.ts                 # studies, crew, community re-export
    │   ├── crew.ts
    │   ├── community.ts
    │   └── studies/                 # 스터디 도메인 원본 데이터
    │       ├── helpers.ts           # StudyDraft 타입 및 데이터 빌더 헬퍼
    │       ├── recruiting.ts        # 모집 중 데이터
    │       ├── ongoing.ts           # 진행 중 데이터
    │       ├── closed-2026.ts       # 2026년 마감 데이터
    │       ├── closed-2025.ts       # 2025년 마감 데이터
    │       ├── closed-2024.ts       # 2024년 마감 데이터
    │       └── index.ts             # 시드 병합 및 Study[] export
    │
    └── msw/                         # MSW (Mock Service Worker) 계층
        ├── index.ts                 # MSW 초기화 및 통합 진입점
        ├── context.ts               # 핸들러 프리셋/오버라이드 컨텍스트
        ├── utils.ts                 # mockClient 및 핸들러 그룹 생성기
        ├── provider.tsx             # React용 MSW Provider
        ├── devtool.tsx              # MSW 시나리오 변경 DevTool UI
        ├── data.ts                  # 도메인 모델(Study) -> 백엔드 API DTO(ApiStudy) 변환 매퍼
        └── handlers/                # API 엔드포인트별 핸들러
            ├── index.ts             # 전체 핸들러 취합
            ├── accounts.ts          # 계정 관련 엔드포인트 (/api/accounts/*)
            ├── notification-templates.ts
            └── studies.ts           # 스터디 관련 엔드포인트 (/api/studies/*)
```

## 사용법

### 1. Mock 데이터 가져오기

```typescript
import { studies, events, members, operators } from '@studyclub/mock';
```

### 2. MSW Provider 및 DevTool 설정

```tsx
import { mockHandlerGroups, MSWProvider } from '@studyclub/mock/msw';

const loadWorker = () => import('msw/browser').then(({ setupWorker }) => setupWorker());

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MSWProvider mockHandlerGroups={mockHandlerGroups} loadWorker={loadWorker} fallback={null}>
      {children}
    </MSWProvider>
  );
}
```

## 데이터 수정 안내

- **스터디**: `src/data/studies/` (`recruiting.ts`, `ongoing.ts`, `closed-*.ts`)
- **크루(멤버·운영진)**: `src/data/crew.ts`
- **커뮤니티(행사·공지·사이트정보)**: `src/data/community.ts`
- **공용 타입·함수·상수**: `../types/src/`, `../utils/src/`
- **예시 신청 폼·사이트 설정**: `src/constants/`
- **MSW 핸들러 및 API DTO**: `src/msw/handlers/`, `src/msw/data.ts`

### 공용 코드의 소유권

- `@studyclub/types`: `Locale`, `L10n`, 스터디·참여자·커뮤니티 모델 타입. 실행 코드나 mock 데이터에 의존하지 않는다.
- `@studyclub/utils`: 날짜 변환, 스터디 표시 상태, 출석 계산, 카테고리·지역 상수, 브라우저 JSON 저장소, 옛 도메인 리다이렉트. 공용 타입과 Zod를 참조한다.
- `@studyclub/mock`: 예시 데이터·신청 폼·사이트 설정과 MSW 핸들러. 공용 타입·함수를 재수출하지 않는다. MSW 응답 DTO·변환 코드는 현재 `mock/msw`에 유지한다.
- 인증, HTTP, 쿠키 정책, React 훅 등 앱 동작에 의존하는 코드는 각 앱에 둔다.

```ts
import type { Locale, L10n, Study } from '@studyclub/types';
import { readJSON, toISODate, CATEGORY_DISPLAY } from '@studyclub/utils';
import { studies } from '@studyclub/mock';
```
