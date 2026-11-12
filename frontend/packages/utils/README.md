# @studyclub/utils

앱에 의존하지 않는 공용 함수·상수 패키지입니다. 공용 타입은 `@studyclub/types`, 저장값 검증은 Zod를 사용합니다.

- `src/browser-storage.ts`: JSON 읽기·쓰기 (`readJSON`, `writeJSON`)
- `src/study.ts`, `src/seoul-date.ts`: 날짜·스터디 표시 상태
- `src/crew.ts`: 출석 점수·출석률
- `src/constants.ts`: 카테고리·지역 상수
- `src/legacy-domain.ts`: 옛 도메인 리다이렉트

```ts
import { readJSON, toISODate, CATEGORY_DISPLAY } from '@studyclub/utils';
```

`readJSON(key, schema, fallback)`에 Zod 스키마를 필수로 전달합니다. JSON 파싱과 스키마 검증에 성공한 값만 반환하며, 손상된 값이나 접근 불가 상태는 기본값으로 처리합니다. 도메인 스키마는 각 기능에서 정의합니다. 인증·HTTP·쿠키 정책·React 훅은 각 앱에 유지합니다.

소비하는 패키지에 `workspace:*` 의존성을 선언하고 패키지 진입점에서 import합니다. [프론트 구조 가이드](../../../docs/frontend-development-guide/project-structure.md#공용-코드의-소유권)를 참고하세요.

```ts
import { z } from 'zod';
import { readJSON } from '@studyclub/utils';

const bookmarks = readJSON('sc_bookmarks', z.array(z.string()), []);
```

검증: `pnpm --filter @studyclub/utils test`, `pnpm --filter @studyclub/utils typecheck`.
