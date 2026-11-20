# 프론트엔드 개발 가이드

2026-10-31 작업 트리 기준. 구현 경로와 테스트 명령은 현재 코드에 맞춰 정리했다. PRD 완료 여부는 대응표의 실행 근거와 미연결 항목을 함께 확인한다.

| 문서 | 용도 |
|---|---|
| [프로젝트 구조](project-structure.md) | 앱·types/utils/mock 소유권·기능별 배치·개발 포트 |
| [관심사 분리](separation-of-concerns.md) | 페이지·기능·API·공유 UI의 책임 |
| [API 연동](api-integration.md) | 직접 백엔드 호출·React Query·오류 처리 |
| [인증 흐름](auth-flow.md) | OAuth·쿠키·세션·현재 갱신 범위 |
| [컴포넌트](component-guide.md) | 공통 UI·기능 컴포넌트·폼 |
| [레이아웃](layout.md) | core-front 레이아웃과 백오피스 차이 |
| [UI 카피](ui-copy.md) | 문구 규칙과 구현 확인 |
| [Storybook](storybook-guide.md) | 공통 컴포넌트 확인 |
| [E2E 실행](e2e-guide.md) | 실행 명령·스크린샷 규약·데이터 조건 |
| [core-front PRD 대응표](core-e2e-prd-map.md) | 크루·네비게이터 PRD 16개와 카탈로그·스크린샷 |
| [관리자 PRD 대응표](admin-e2e-prd-map.md) | 캡틴 PRD 18개와 카탈로그·스크린샷 |

PRD가 바뀌면 대응표 → `.feature` 예정 명세 → `.meta.ts` 실행 상태 → 스크린샷을 함께 갱신한다. 캡처 성공은 저장·권한·외부 연동을 포함한 PRD 전체 완료를 뜻하지 않는다.

공용 타입은 `@studyclub/types`, 공용 함수·상수는 `@studyclub/utils`, 예시 데이터·MSW는 `@studyclub/mock`에서 가져온다. 앱 전용 API·검증·화면은 `features/<기능>/`에 둔다. 자세한 배치 기준은 [프로젝트 구조](project-structure.md#공용-코드의-소유권)를 참고한다.
