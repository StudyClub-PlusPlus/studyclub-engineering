# @studyclub/types

공용 도메인·국제화 타입 패키지입니다. 실행 코드나 앱·mock 데이터에 의존하지 않습니다.

| 파일 | 타입 |
|---|---|
| `src/i18n.ts` | `Locale`, `L10n` |
| `src/study.ts` | 스터디·모집·신청 폼 모델 |
| `src/crew.ts` | 참여자·출석 모델 |
| `src/community.ts` | 행사·운영진·지역·사이트 모델 |

```ts
import type { Locale, L10n, Study } from '@studyclub/types';
```

소비하는 패키지에 `workspace:*` 의존성을 선언하고 패키지 진입점에서 import합니다. [프론트 구조 가이드](../../../docs/frontend-development-guide/project-structure.md#공용-코드의-소유권)를 참고하세요.
