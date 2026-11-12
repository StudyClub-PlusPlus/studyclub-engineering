# 관리자 E2E와 PRD 대응표

기준: 2026-10-31 작업 트리. 범위: Story 레지스트리에서 Actor가 캡틴이고 PRD가 있는 18개 Story. 사용자 사이트 전용 Story와 PRD 없는 행사 기능은 포함하지 않는다.

사용자 사이트의 크루·네비게이터 시나리오는 [core-front 대응표](./core-e2e-prd-map.md)를 본다.

## 읽는 법

- `BO-ST-###-S##`: 완료 기준을 연결한 행동 시나리오. `BO-ST-###-V##`: PRD 상태별 화면을 연결한 표시 시나리오.
- `features/prd/*.feature`는 **자동화 예정 명세**다. `@planned`를 붙였으며 현재 Playwright 러너는 이 파일을 읽지 않는다. 연결된 표시 상태는 `features/prd/*.meta.ts`가 실행한다. `@catalog-partial`과 바로 위 주석이 실행 ID를 가리킨다. 원문 행동 전체의 자동화 완료를 뜻하지 않는다.
- 기존 실행 근거는 **부분 참고**다. 파일이 있거나 스크린샷이 통과했다고 완료 기준을 충족한 것으로 판정하지 않는다.
- 대응표의 PRD 원문 열은 보존한다. 사용자가 현재 코드를 기준으로 요청한 쟁점은 `@code-baseline` 시나리오에 실제 동작을 적고, 원문과 차이를 주석으로 남긴다. 한 기준에 조건이 여러 개면 실제 자동화 단계에서 케이스를 나눈다. 상태표가 없는 PRD에 상태표를 새로 만들어 넣지 않는다.
- `@needs-prd-review`는 아직 기준이 정해지지 않은 항목이다. 이번에 표시했던 4개 Story는 사용자 요청에 따라 코드를 확인해 `@code-baseline`으로 변경했다. PRD 내용은 번호 중복만 고쳤다.
- 실행 상태 ID는 `{pageId}--{state}`, 스크린샷은 `{pageId}--{state}--{viewport}.png`로 통일한다. PRD 연결은 파일명 접두사 대신 `prdScenarios`에 기록한다.
- PRD 수정 시 대응표와 feature를 함께 갱신한다. Story ID·기준 번호·상태 이름을 기준으로 추적한다.

## PRD 연결 실행 카탈로그 (2026-10-31)

신규 **45개 상태 · 48장**을 연결했다. 기존 8개 상태 · 10장과 합치면 **53개 상태 · 58장**이다. 신규 연결은 145개 명세 중 45개 시나리오에 표시 상태 근거를 제공하며, 나머지 100개에는 이번 신규 연결이 없다. 기존 부분 근거는 아래 표를 별도로 참고한다. 이 숫자는 완료 기준 통과율이 아니다.

고정 시각 `2026-10-31T03:00:00Z`, 로컬 가상 데이터, 상태별 API 응답으로 재현한다. API 주소를 테스트 설정에서 고정해 로컬 `.env`에 따라 MSW 응답이 달라지지 않게 한다. 정의하지 않은 브라우저 API 호출은 테스트 실패로 처리한다. 로딩·처리중은 응답을 보류하고, 오류는 HTTP 오류 응답으로 만든다.

| 실행 상태 ID | 연결 명세 | 캡처 뷰포트 |
|---|---|---|
| `study-list--create` | BO-ST-001-V01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-list--create--desktop.png) |
| `study-list--create-invalid` | BO-ST-001-V02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-list--create-invalid--desktop.png) |
| `study-detail--delete-confirm` | BO-ST-004-V05 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--delete-confirm--desktop.png) |
| `study-detail--edit-invalid` | BO-ST-004-V02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--edit-invalid--desktop.png) |
| `study-detail--unpublished` | BO-ST-003-V04 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--unpublished--desktop.png) |
| `study-detail--closed` | BO-ST-003-V03 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--closed--desktop.png) |
| `study-detail--next-cohort` | BO-ST-021-S01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--next-cohort--desktop.png) |
| `study-detail--publish-confirm` | BO-ST-020-V04 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--publish-confirm--desktop.png) |
| `study-detail--unpublish-confirm` | BO-ST-020-V05 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--unpublish-confirm--desktop.png) |
| `study-detail--publish-blocked` | BO-ST-020-V03 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--publish-blocked--desktop.png) |
| `study-detail--application-form-loading` | BO-ST-023-V01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-loading--desktop.png) |
| `study-detail--application-form-read-error` | BO-ST-023-V02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-read-error--desktop.png) |
| `study-detail--application-form-empty` | BO-ST-023-V07 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-empty--desktop.png), [mobile](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-empty--mobile.png) |
| `study-detail--application-form-editing` | BO-ST-023-V08 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-editing--desktop.png) |
| `study-detail--application-form-invalid` | BO-ST-023-V09 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-invalid--desktop.png) |
| `study-detail--application-form-saving` | BO-ST-023-V10 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-saving--desktop.png) |
| `study-detail--application-form-saved` | BO-ST-023-V11 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-saved--desktop.png) |
| `study-detail--application-form-save-error` | BO-ST-023-V12 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-save-error--desktop.png) |
| `study-detail--application-form-forbidden` | BO-ST-023-V04 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-forbidden--desktop.png) |
| `study-detail--application-form-locked` | BO-ST-023-V13 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-locked--desktop.png) |
| `study-detail--application-results-loading` | BO-ST-024-V01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-loading--desktop.png) |
| `study-detail--application-results-error` | BO-ST-024-V02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-error--desktop.png) |
| `study-detail--application-results-forbidden` | BO-ST-024-V04 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-forbidden--desktop.png) |
| `study-detail--application-results-no-questions` | BO-ST-024-V05 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-no-questions--desktop.png) |
| `study-detail--application-results-empty` | BO-ST-024-V06 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-empty--desktop.png) |
| `study-detail--application-results-summary` | BO-ST-024-V07 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-summary--desktop.png) |
| `study-detail--application-results-individual` | BO-ST-024-V08 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-individual--desktop.png), [mobile](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-individual--mobile.png) |
| `user-list--default` | BO-ST-028-V01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/user-list--default--desktop.png) |
| `user-list--empty` | BO-ST-028-V03 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/user-list--empty--desktop.png) |
| `user-list--role-menu` | BO-ST-029-V03 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/user-list--role-menu--desktop.png) |
| `notifications--empty` | BO-ST-032-V02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--empty--desktop.png) |
| `notifications--filter-empty` | BO-ST-032-V03 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--filter-empty--desktop.png) |
| `notifications--error` | BO-ST-032-V04 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--error--desktop.png) |
| `notifications--failed` | BO-ST-032-S01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--failed--desktop.png) |
| `notifications--resend-confirm` | BO-ST-032-S02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--resend-confirm--desktop.png) |
| `notification-templates--default` | BO-ST-030-S01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--default--desktop.png) |
| `notification-templates--create` | BO-ST-030-S02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--create--desktop.png) |
| `notification-templates--edit` | BO-ST-030-S02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--edit--desktop.png) |
| `notification-templates--preview` | BO-ST-030-S02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--preview--desktop.png) |
| `notification-templates--delete` | BO-ST-030-S03 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--delete--desktop.png) |
| `notices--default` | BO-ST-033-S01 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--default--desktop.png) |
| `notices--create` | BO-ST-033-S02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--create--desktop.png) |
| `notices--edit` | BO-ST-033-S02 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--edit--desktop.png) |
| `notices--delete` | BO-ST-033-S03 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--delete--desktop.png) |
| `dashboard--empty` | BO-ST-002-V01 / BO-ST-002-V02 / BO-ST-002-V03 / BO-ST-002-V04 | [desktop](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/dashboard--empty--desktop.png), [mobile](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/dashboard--empty--mobile.png) |

파일명 통일 후 검증: `pnpm run test:e2e:catalog` 일반 비교 **58 passed (46.6s)**. TypeScript·변경 파일 ESLint 통과. 신규 48개 이미지와 연결 명세 ID·문서 링크 확인.

### 현재 코드와 PRD 차이·남은 범위

- **ST-003 헤더:** 현재 `StudyConsole.tsx`는 모집 상태와 마감 날짜를 표시한다. PRD의 `D-N`·`오늘 마감` 문구가 있다고 처리하지 않는다. 신규 캡처는 미공개·모집 마감만 연결했다.
- **ST-023 잠금·권한 없음:** 현재 `ApplicationFormTab.tsx`는 저장 API의 403·409 응답 뒤 읽기 전용으로 전환한다. 최초 조회 시점 잠금 여부나 실제 서버 권한 판정은 이 캡처로 검증하지 않는다.
- **ST-030 템플릿 조건:** 현재 `features/notification-templates/types.ts`의 선택지는 `USER_REGISTERED`, `STUDY_NOTICE`다. PRD의 회원 탈퇴 조건·동일 조건 복수 템플릿과 다르다. 캡처는 현재 목록·추가·수정·미리보기·삭제 확인을 따른다.
- **ST-032 수신 주소:** `HistoryTable.tsx`는 가린 주소만 표시하며 펼치기 기능은 없다. 목록 캡처가 PRD의 주소 펼치기까지 검증한 것으로 보지 않는다.
- **ST-036 문의·오류 신고:** 백오피스 `src/app`에 대상 페이지가 없으며 PRD도 API 미구현으로 적고 있다. 프로토타입을 제품 화면으로 대체 캡처하지 않았다.
- 새 연결이 없는 반 편성·참석자·출석의 추가 상태, 인증 리다이렉트, 저장 후 사용자 사이트 반영과 실제 API의 CRUD·권한 검증은 기존 부분 근거 또는 예정으로 남는다.

## 기존 실행 시나리오

| 실행 상태 ID | PRD 연결 | 현재 범위 |
|---|---|---|
| login--default | 관리자 인증은 docs/frontend-development-guide/auth-flow.md 참고 | 로그인 기본 화면. 캡틴 Story PRD에 억지로 연결하지 않음 |
| study-list--default | ST-022 S01 / V01 | 기본 목록만 |
| study-detail--info | ST-004 S01 / V01; ST-003 S01 | 기본 폼과 헤더만 |
| study-detail--application-form | ST-023 S01 / V06 | 기본 폼, PC·모바일만 |
| study-detail--applicants | ST-025 S01 / V02; ST-026 S01 / V01 | 기본 명단만 |
| study-detail--schedule-empty | ST-025 S03 / V03 | 스터디 시간 없음 |
| study-detail--schedule | ST-025 S04·S05 | 생성 결과 일부와 킥오프 수정 버튼만 |
| study-detail--attendance | ST-027 S01 / V01 | 출석 기본 격자만 |

로그인 `.feature`의 미인증 리다이렉트는 실행 상태가 없으므로 `@planned`다. 행동 E2E의 `page.screenshot()`은 `test-results` 참고 이미지이며 golden 비교와 별개다.

## PRD별 연결

### ST-001 study-create

[PRD](../../01-planning/stories/study-create/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/study-create.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: e2e/specs/study-form.spec.ts (등록 창·날짜 역전 차단만)

**현재 추가된 실행 근거:** [study-list--create](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-list--create--desktop.png), [study-list--create-invalid](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-list--create-invalid--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

**현재 코드 확인:** 현재 코드 기준: 카운터는 제목 권장 24자·소개 권장 25자를 표시하고 초과 시 경고한다. 카운터 수치와 저장 제한은 다르다. 실제 최대치는 trim 후 제목 60자·한 줄 소개 255자이며 초과 시 등록·수정 요청을 차단한다. Discord·드라이브 URL은 2,048자까지 허용한다. PRD의 폭 40 기준과는 다르다. 근거: src/features/studies/form-schema.ts 및 StudyForm.tsx.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 스터디 목록에서 등록 창 열기 | `BO-ST-001-S01` |
| 2 | 새 프로그램 등록 — 프로그램과 첫 기수 동시 생성, 종류(스터디·클럽) 지정 | `BO-ST-001-S01` |
| 3 | 기존 클럽의 새 기수 등록 — 제목·소개·설명·카테고리·시간대·채널·드라이브 주소 최신 기수 값 자동 채움 | `BO-ST-001-S02` |
| 4 | 필수 네 항목(제목·한 줄 소개·카테고리·모집 마감일) 검증, 칸별 오류 안내 | `BO-ST-001-S03` |
| 5 | 권장 길이 초과 경고 — 등록은 가능 | `BO-ST-001-S03` |
| 6 | 상세 설명 기본 템플릿 (목표 / 진행 방식 / 참가 대상 / 특이사항) | `BO-ST-001-S01` |
| 7 | 정원 기본 제한 없음, 풀면 1 이상 정수 | `BO-ST-001-S01` |
| 8 | 등록 결과는 항상 미공개 | `BO-ST-001-S04` |
| 9 | 처리 중 중복 제출 차단 | `BO-ST-001-S04` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 새 프로그램 · 스터디 · 정원 제한 없음 · 설명 템플릿 / — | `BO-ST-001-V01` |
| 검증 실패 | 칸별 오류 / `60자 이내로 입력하세요.` · `모집 마감일을 입력하세요.` · `기수를 추가할 프로그램을 고르세요.` · `http(s):// 로 시작하는 주소를 입력하세요.` · `1 이상의 정수로 입력하세요. …` | `BO-ST-001-V02` |
| 처리중 | 등록 잠김 / — | `BO-ST-001-V03` |
| 완료 | 완료 화면 / — | `BO-ST-001-V04` |

### ST-002 console-dashboard

[PRD](../../01-planning/stories/console-dashboard/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/console-dashboard.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: e2e/specs/smoke.spec.ts (main 노출만)

**현재 추가된 실행 근거:** [dashboard--empty](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/dashboard--empty--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 활성 크루·평균 출석률·1인당 참여 스터디·커뮤니티 멤버 한 줄 조회 | `BO-ST-002-S01` |
| 2 | 진행중·모집중 스터디와 예정 행사를 건수와 함께 조회 | `BO-ST-002-S01` |
| 3 | 모집 마감·행사까지 남은 일수 표기 | `BO-ST-002-S01` |
| 4 | 평균 출석률 전주 대비와 최근 12주 추세 | `BO-ST-002-S01` |
| 5 | 크루 지역 분포 | `BO-ST-002-S01` |
| 6 | 카테고리별 스터디 수 — 진행중·누적 전환 | `BO-ST-002-S02` |
| 7 | 항목에서 해당 스터디·목록으로 이동 | `BO-ST-002-S03` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 보드 칸이 비었을 때 | 칸 높이를 지킨 채 가운데 안내만. 「모집중 스터디가 없습니다」 | `BO-ST-002-V01` |
| 전주 값 없음 | 값만 적고 변화 자리를 비워 두지 않는다 | `BO-ST-002-V02` |
| 출석 기록 없음 | 「아직 출석 기록이 없습니다.」 | `BO-ST-002-V03` |
| 카테고리 0건 | 막대 대신 「해당하는 스터디가 없습니다.」 | `BO-ST-002-V04` |

### ST-003 study-detail

[PRD](../../01-planning/stories/study-detail/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/study-detail.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: screen-catalog/features/studies/studies.meta.ts (일부 탭 기본 캡처)

**현재 추가된 실행 근거:** [study-detail--unpublished](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--unpublished--desktop.png), [study-detail--closed](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--closed--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

**현재 코드 확인:** 현재 코드 기준: 정보·신청 폼·신청 결과·신청자·일정·출석 6개 탭. 탭 옆 저장 전 문구 없이 출석 칸 테두리와 aria-label로 변경을 표시하고 이탈 전에 묻는다. 근거: src/features/studies/StudyConsole.tsx, src/features/attendance/AttendanceBook.tsx.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 상단에서 스터디명·모집 상태 확인 — 남은 일수 포함 | `BO-ST-003-S01` |
| 2 | 미공개 스터디는 상단에 그 사실 표기 | `BO-ST-003-S01` |
| 3 | 정보·신청 폼·신청 결과·신청자·출석 다섯 탭 전환 및 현재 위치 표시 | `BO-ST-003-S02` |
| 4 | 출석 탭 미저장 변경 시 탭 이동 전 경고 | `BO-ST-003-S03` |
| 5 | 클럽은 이 화면에서 다음 기수 생성 | `BO-ST-003-S04` |
| 6 | 목록으로 돌아가기 | `BO-ST-003-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 모집중 | 헤더에 「모집중 · D-N」 | `BO-ST-003-V01` |
| 오늘 마감 | 헤더에 「오늘 마감」 — 아직 신청을 받는다 | `BO-ST-003-V02` |
| 모집 마감 | 헤더에 「모집 마감」 | `BO-ST-003-V03` |
| 미공개 | 모집 상태 옆에 「미공개」 | `BO-ST-003-V04` |
| 출석 저장 전 | 출석 탭 이름 옆에 「저장 전」 | `BO-ST-003-V05` |

### ST-004 study-edit

[PRD](../../01-planning/stories/study-edit/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/study-edit.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: study-detail--info (기본 캡처; 저장·삭제 미검증)

**현재 추가된 실행 근거:** [study-detail--delete-confirm](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--delete-confirm--desktop.png), [study-detail--edit-invalid](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--edit-invalid--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 정보 탭에서 등록 항목 수정 | `BO-ST-004-S01` |
| 2 | 저장 시 사용자 사이트 목록·상세 반영 | `BO-ST-004-S01` |
| 3 | 등록과 같은 검증 — 실패 시 저장 차단 및 칸별 오류 | `BO-ST-004-S02` |
| 4 | 저장 완료 표시 | `BO-ST-004-S01` |
| 5 | 삭제는 확인 후 실행 — 함께 사라지는 것 사전 고지 | `BO-ST-004-S03` |
| 6 | 소속 프로그램 표시 — 연결은 변경 불가 | `BO-ST-004-S01` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 저장된 값이 채워진 폼 / — | `BO-ST-004-V01` |
| 검증 실패 | 해당 칸에 오류와 문구 / 「제목을 입력하세요.」 / 「한 줄 소개를 입력하세요.」 / 「카테고리를 선택하세요.」 / 「모집 마감일을 고르세요.」 / 「60자 이내로 입력하세요.」 | `BO-ST-004-V02` |
| 처리중 | 저장·삭제 모두 비활성 / — | `BO-ST-004-V03` |
| 저장 완료 | 저장 버튼 옆에 안내 / 「저장되었습니다.」 | `BO-ST-004-V04` |
| 삭제 확인 | 확인 창 / 「'{스터디명}' 스터디를 삭제합니다.」 / 「크루 명단과 출석 기록도 함께 사라지며 되돌릴 수 없습니다.」 | `BO-ST-004-V05` |

### ST-020 captain-publish-study

[PRD](../../01-planning/stories/captain-publish-study/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-publish-study.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

**현재 추가된 실행 근거:** [study-detail--publish-confirm](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--publish-confirm--desktop.png), [study-detail--unpublish-confirm](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--unpublish-confirm--desktop.png), [study-detail--publish-blocked](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--publish-blocked--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 목록 각 행에서 공개·미공개 전환 | `BO-ST-020-S01` |
| 2 | 공개 시 그날이 모집 시작일, 상태 「개설」, 사용자 사이트 노출 | `BO-ST-020-S01` |
| 3 | 전환은 확인 창에서 한 번 더 | `BO-ST-020-S01` |
| 4 | 신청 폼 없으면 공개 차단 및 사유 안내 | `BO-ST-020-S02` |
| 5 | 미공개로 되돌리기 — 상태는 「작성 중」 | `BO-ST-020-S01` |
| 6 | 등록 직후는 항상 미공개 | `BO-ST-020-S02` |
| 7 | 행마다 신청 폼 유무 표기 | `BO-ST-020-S02` |
| 8 | 공개 상태 필터 | `BO-ST-020-S03` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 미공개 | 공개 설정 / `미공개` | `BO-ST-020-V01` |
| 공개 | 공개 설정 / `공개` | `BO-ST-020-V02` |
| 공개 불가 | 누를 수 없는 공개 설정 / `신청 폼을 먼저 연결하세요.` | `BO-ST-020-V03` |
| 공개 확인 | 팝업 / `‘스터디명’ 스터디를 공개하시겠습니까?` | `BO-ST-020-V04` |
| 비공개 확인 | 팝업 / `비공개로 전환하시겠습니까?` | `BO-ST-020-V05` |

### ST-021 captain-reregister-cohort

[PRD](../../01-planning/stories/captain-reregister-cohort/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-reregister-cohort.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

**현재 추가된 실행 근거:** [study-detail--next-cohort](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--next-cohort--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 클럽 운영 화면에서 다음 기수 생성 — 스터디 종류에는 없음 | `BO-ST-021-S01` |
| 2 | 등록 창의 「기존 클럽의 새 기수」와 같은 결과 | `BO-ST-021-S01` |
| 3 | 새 기수 창은 프로그램 고정, 제목·소개·설명·카테고리 자동 채움 | `BO-ST-021-S01` |
| 4 | 모집 마감일·진행 일정·정원은 비움 — 기수마다 재지정 | `BO-ST-021-S01` |
| 5 | 채운 값 수정이 지난 기수에 영향 없음 | `BO-ST-021-S02` |
| 6 | 새 기수는 같은 프로그램 아래 미공개로 저장 | `BO-ST-021-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 최신 기수 값이 채워진 창 / — | `BO-ST-021-V01` |
| 검증 실패 | 칸별 오류 / 신규 등록과 같은 문구 | `BO-ST-021-V02` |
| 처리중 | 등록 잠김 / — | `BO-ST-021-V03` |
| 완료 | 완료 화면 / — | `BO-ST-021-V04` |

### ST-022 captain-list-all-studies

[PRD](../../01-planning/stories/captain-list-all-studies/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-list-all-studies.feature)

**자동화 상태: 예정.** 추가 전 부분 근거: study-list--default (1건 기본 캡처; 필터·정렬·페이지 미검증)

**현재 코드 확인:** 현재 코드 기준: 같은 열은 오름→내림→오름 반복, 다른 열은 오름부터 시작한다. 기본 모집 상태 오름은 내부 값 all로 표현하며 정렬 해제 단계가 아니다. 근거: src/features/studies/list-filters.ts nextSortFor 및 list-filters.test.ts.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 한 행에서 카테고리·시간대·모집 일정·모집 상태·지원 현황·시작일·신청 폼·공개 상태·작성자 조회 | `BO-ST-022-S01` |
| 2 | 지원 현황 — 현재 인원 / 정원. 정원 없으면 「제한 없음」 | `BO-ST-022-S01` |
| 3 | 작성자 열 — 기록 없으면 「—」 | `BO-ST-022-S01` |
| 4 | 검색·카테고리·상태·모집·공개·신청 폼 필터 | `BO-ST-022-S02` |
| 5 | 신청 폼 드롭다운 — 있음 · 없음 | `BO-ST-022-S02` |
| 6 | 열 이름을 누르면 오름차순, 다시 누르면 내림차순. 기본은 모집 상태 오름차순 | `BO-ST-022-S03` |
| 7 | 열 순서는 고정 — 끌어서 바꾸지 않음 | `BO-ST-022-S01` |
| 8 | 한 페이지 20개, 필터·검색·정렬 변경 시 1페이지로 | `BO-ST-022-S03` |
| 9 | 출석률은 목록에 두지 않음 | `BO-ST-022-S01` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 기본 순서로 첫 페이지 / 「N개」 | `BO-ST-022-V01` |
| 빈 결과 | 필터·검색에 걸린 스터디가 없음 / 「조건에 맞는 스터디가 없습니다.」 | `BO-ST-022-V02` |

### ST-023 captain-application-form

[PRD](../../01-planning/stories/captain-application-form/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-application-form.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: study-detail--application-form; e2e/specs/application-form.spec.ts (질문 추가·저장·재조회 일부)

**현재 추가된 실행 근거:** [study-detail--application-form-loading](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-loading--desktop.png), [study-detail--application-form-read-error](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-read-error--desktop.png), [study-detail--application-form-empty](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-empty--desktop.png), [study-detail--application-form-editing](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-editing--desktop.png), [study-detail--application-form-invalid](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-invalid--desktop.png), [study-detail--application-form-saving](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-saving--desktop.png), [study-detail--application-form-saved](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-saved--desktop.png), [study-detail--application-form-save-error](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-save-error--desktop.png), [study-detail--application-form-forbidden](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-forbidden--desktop.png), [study-detail--application-form-locked](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form-locked--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 설문 제목·설명 작성, 추가 질문 생성 및 순서 변경 | `BO-ST-023-S01` |
| 2 | 질문 설명 여러 줄 입력 — 마크다운이 지원자 화면에 그대로 | `BO-ST-023-S01` |
| 3 | 편집 카드가 지원자 화면과 같은 모양 — 별도 미리보기 없음 | `BO-ST-023-S01` |
| 4 | 디스코드 서버 별명 문항 고정 — 삭제·타입 변경 불가 | `BO-ST-023-S01` |
| 5 | 이름·이메일 문항 없음 | `BO-ST-023-S01` |
| 6 | 저장 시 해당 기수 폼 반영 및 「저장되었습니다.」 | `BO-ST-023-S02` |
| 7 | 신청이 들어왔거나 모집 시작 시각이 지나면 수정 차단 | `BO-ST-023-S03` |
| 8 | 추가 질문 없이도 저장 — 지원자는 기본 문항만 | `BO-ST-023-S02` |
| 9 | 저장된 폼이 없어도 탭 열림 — 기수 제목·소개와 기본 질문 표시 | `BO-ST-023-S02` |
| 10 | 입력 길이 상한, 접힌 카드의 제목·설명은 줄바꿈으로 전부 표시 | `BO-ST-023-S04` |
| 11 | 불러오기·저장 실패와 권한 없음 안내. 조회 완료 전 저장 차단 | `BO-ST-023-S05` |
| 12 | 권한 — 담당 캡틴만 수정, 다른 캡틴은 조회. 네비게이터·크루는 백오피스 진입 불가 | `BO-ST-023-S03` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 로딩 | 신청 폼 탭 / `불러오는 중`. 저장 불가 | `BO-ST-023-V01` |
| 조회 실패 | 같은 탭 / `신청 폼을 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도`. 저장 불가 | `BO-ST-023-V02` |
| 미로그인 | 콘솔 로그인 / 로그인 화면 카피. `next` = 이 탭 | `BO-ST-023-V03` |
| 권한 없음 | 같은 탭 / `이 스터디의 신청 폼을 고칠 권한이 없습니다.` 저장·삭제·순서 변경 없음 | `BO-ST-023-V04` |
| 첫 진입 · 폼 없음 | 같은 탭 / 기수 제목·한 줄 소개 · 기본 질문 · `질문 추가` | `BO-ST-023-V05` |
| 기본 | 같은 탭 / 제목·설명·기본 질문·추가 질문 | `BO-ST-023-V06` |
| 추가 질문 없음 | 같은 탭 / 제목·설명·기본 질문 · `질문 추가` | `BO-ST-023-V07` |
| 편집 중 | 선택한 카드 / 제목·타입·설명·선택지·필수 | `BO-ST-023-V08` |
| 검증 실패 | 해당 카드 / `질문 제목을 입력해 주세요.` / `선택지를 하나 이상 넣어 주세요.` | `BO-ST-023-V09` |
| 처리중 | 저장 버튼 / `저장`. 다시 누르지 못함. 닫기 불가 | `BO-ST-023-V10` |
| 완료 | 같은 탭 / `저장되었습니다.` | `BO-ST-023-V11` |
| 저장 실패 | 같은 탭 / `저장하지 못했습니다. 다시 시도해 주세요.` `다시 시도` | `BO-ST-023-V12` |
| 잠금 | 같은 탭 / `모집이 시작되어 신청 폼을 수정할 수 없습니다.` 연필·추가·삭제·저장 불가 | `BO-ST-023-V13` |

### ST-024 captain-application-results

[PRD](../../01-planning/stories/captain-application-results/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-application-results.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: e2e/specs/application-results.spec.ts (두 보기·응답 수·일부 표시 검증; 이 행동 테스트 자체는 기준 이미지 비교를 하지 않음)

**현재 추가된 실행 근거:** [study-detail--application-results-loading](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-loading--desktop.png), [study-detail--application-results-error](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-error--desktop.png), [study-detail--application-results-forbidden](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-forbidden--desktop.png), [study-detail--application-results-no-questions](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-no-questions--desktop.png), [study-detail--application-results-empty](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-empty--desktop.png), [study-detail--application-results-summary](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-summary--desktop.png), [study-detail--application-results-individual](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-results-individual--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 신청 결과 탭에서 추가 질문 응답 조회 | `BO-ST-024-S01` |
| 2 | 응답 인원 「응답자 N명」 표기 | `BO-ST-024-S01` |
| 3 | 질문별·응답자별 전환 — 기본은 질문별 | `BO-ST-024-S01` |
| 4 | 질문별 보기에는 응답자를 붙이지 않음 — 인원과 답 내용만 | `BO-ST-024-S01` |
| 5 | 응답자별 보기 — 디스코드 별명·이메일·질문별 답을 한 행으로 | `BO-ST-024-S01` |
| 6 | 추가 질문 없을 때 안내. 모집 시작 전에는 신청 폼 탭에서 질문 추가 | `BO-ST-024-S02` |
| 7 | 신청 없을 때 「아직 들어온 신청이 없습니다.」 | `BO-ST-024-S02` |
| 8 | 조회 전용 — 신청 수정·삭제 없음. 담당 기수만 열람 | `BO-ST-024-S03` |
| 9 | 불러오기 실패·미로그인 안내 | `BO-ST-024-S03` |
| 10 | 긴 선택지·별명·이메일은 한 줄 말줄임, 답 본문은 줄바꿈으로 전부 | `BO-ST-024-S04` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 로딩 | 신청 결과 탭 / `불러오는 중` | `BO-ST-024-V01` |
| 조회 실패 | 같은 탭 / `결과를 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도` | `BO-ST-024-V02` |
| 미로그인 | 콘솔 로그인 / 로그인 화면 카피. `next` = 이 탭 | `BO-ST-024-V03` |
| 권한 없음 | 같은 탭 / `이 스터디의 신청 결과를 볼 권한이 없습니다.` | `BO-ST-024-V04` |
| 추가 질문 없음 | 같은 탭 / `이 스터디는 신청 폼에 추가 질문이 없습니다.` | `BO-ST-024-V05` |
| 신청 없음 | 같은 탭 / `아직 들어온 신청이 없습니다.` | `BO-ST-024-V06` |
| 질문별 | 같은 탭 / `응답자 N명` · `질문별` | `BO-ST-024-V07` |
| 응답자별 | 같은 탭 / `응답자 N명` · `응답자별` | `BO-ST-024-V08` |
| 그 질문 답 없음 | 질문별 묶음 / `아직 답이 없습니다.` | `BO-ST-024-V09` |

### ST-025 captain-assign-classes

[PRD](../../01-planning/stories/captain-assign-classes/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-assign-classes.feature)

**자동화 상태: 예정.** 추가 전 부분 근거: study-detail--applicants / schedule-empty / schedule; e2e/specs/participants.spec.ts (반 생성·수정·이동 일부)

**현재 코드 확인:** 현재 코드 기준: 완료 기준 중복 번호를 10(기간)·11(캡틴 명단)로 수정했다. 시간 창에 시작일·종료일은 없고 요일 1개 이상만 저장 시 검증한다. 시각 공란은 차단하지 않으며 시간대는 서버 반 값으로 고정된다. 근거: src/features/schedule/GroupTimeDialog.tsx.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 「반 추가」로 반 제목만 입력해 반 생성. 제목이 비면 생성 불가 | `BO-ST-025-S01` |
| 2 | 반 생성 시 회차를 만들지 않음 | `BO-ST-025-S01` |
| 3 | 반 한 줄에 반 제목 · 속한 크루 수 | `BO-ST-025-S01` |
| 4 | 반 「수정」으로 제목 변경 — 회차·출석 유지 | `BO-ST-025-S01` |
| 5 | 크루별 반 지정·이동 | `BO-ST-025-S02` |
| 6 | 크루 없는 반만 삭제 | `BO-ST-025-S01` |
| 7 | 반이 없을 때 다음 할 일 안내 | `BO-ST-025-S01` |
| 8 | 일정 탭에서 스터디 시간 없는 반에 「스터디 시간 정하기」 → 요일 · 시각 · 시간대만 저장. 회차는 만들지 않음 | `BO-ST-025-S03` |
| 8-1 | 회차는 일정 표 「회차 추가」로만 생성. 회차 없는 반은 스터디 요일 매주 반복 · 시각으로 채워져 열림. 회차 추가는 킥오프를 만들지 않음 | `BO-ST-025-S04` |
| 8-2 | 킥오프는 캡틴이 일정 탭 「킥오프 정하기 · 수정」으로 일자 · 시각을 정함. 1회차보다 앞, 지난 날도 가능. 네비게이터는 고칠 수 없음 | `BO-ST-025-S05` |
| 9 | 일정 탭 반 정보 카드의 스터디 시간 「수정」 — 요일·시각·시간대만 변경. 회차 추가·재생성 없음 | `BO-ST-025-S03` |
| 10 | 반의 기간은 저장하지 않음 — 첫 회차 ~ 마지막 회차 | `BO-ST-025-S03` |
| 11 | 캡틴 전용 명단 줄 없음. 참여하려는 캡틴은 신청 폼 제출 후 크루와 같은 줄로 표시 | `BO-ST-025-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 반 없음 | 안내 / `아직 반이 없습니다. 「반 추가」로 반을 만들고 크루를 나눠 주세요.` | `BO-ST-025-V01` |
| 기본 | 반 목록 · 크루의 반 / — | `BO-ST-025-V02` |
| 스터디 시간 없음 | 일정 탭 안내 · 「스터디 시간 정하기」 / `아직 이 반의 스터디 시간이 없습니다.` | `BO-ST-025-V03` |
| 검증 실패 | 카드 안 반 제목 입력 · 반 일정 창 / `반 제목을 입력해 주세요.` · `시작일 · 종료일 · 요일을 모두 정해야 합니다.` | `BO-ST-025-V04` |
| 삭제 불가 | 크루가 있는 반의 삭제 잠김 / — | `BO-ST-025-V05` |

### ST-026 captain-view-attendees

[PRD](../../01-planning/stories/captain-view-attendees/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-view-attendees.feature)

**자동화 상태: 예정.** 추가 전 부분 근거: study-detail--applicants; e2e/specs/participants.spec.ts (배정 저장·이탈·오류 일부)

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 스터디명과 모집 상태 확인 | `BO-ST-026-S01` |
| 2 | 참여 크루의 닉네임·디스코드 닉네임·이메일·지역·반 조회 | `BO-ST-026-S01` |
| 3 | 반 · 역할 변경은 「저장」으로 한 번에 반영. 저장 전 탭 이동 시 확인 | `BO-ST-026-S02` |
| 4 | 역할 드롭다운으로 네비게이터 지정·해제(기본 크루) — 복수 지정 가능 | `BO-ST-026-S02` |
| 5 | 신청한 캡틴은 크루와 같은 줄로 표시. 신청하지 않은 캡틴 줄 없음 | `BO-ST-026-S01` |
| 6 | 반 · 지역 드롭다운 필터 — 제목 아래 줄. 둘 다 고르면 둘 다 맞는 크루만 | `BO-ST-026-S03` |
| 7 | 체크박스로 여러 명을 골라 반 · 역할 일괄 변경. 표 맨 위 작업 바 「n명 선택」 · 「반 변경」 · 「역할 변경」 (마우스로 고르는 순간(키보드는 화살표로 옮긴 뒤 Enter 를 누르거나 칸을 떠날 때) 적용, 「적용」 버튼 없음), 저장으로 반영. 고르기 전에는 드롭다운이 옅은 회색 | `BO-ST-026-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 머리 · 명단 · 인원 / `참여 크루 N/M` | `BO-ST-026-V01` |
| 공개 전 | 머리 / `미공개` · 「사이트 공개」 스위치 꺼짐 | `BO-ST-026-V02` |

### ST-027 captain-view-attendance-roster

[PRD](../../01-planning/stories/captain-view-attendance-roster/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-view-attendance-roster.feature)

**자동화 상태: 예정.** 추가 전 부분 근거: study-detail--attendance (기본 캡처; 편집·저장·이탈 미검증)

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 반별 크루 × 회차 출석 격자 조회 | `BO-ST-027-S01` |
| 2 | 반 칩으로 한 반씩 본다. 모든 반을 잇는 전체 보기는 없다. 반이 하나면 칩을 두지 않는다 | `BO-ST-027-S01` |
| 3 | 제목 줄 「출석 · 전체 N」 · 서울(KST)/LA(PT) 전환. 반 이름은 반 칩이 말한다(머리 줄 · 규모 · 기준 시간대 문구는 두지 않는다) | `BO-ST-027-S01` |
| 4 | 크루별 출석률 표시 | `BO-ST-027-S01` |
| 5 | 칸 클릭으로 상태 변경, 저장으로 일괄 반영, 저장 전 되돌리기 | `BO-ST-027-S02` |
| 6 | 저장 전 고친 칸은 상태 색 테두리로 표시(변경 칸 수 · 「저장 필요」 문구 없음). 이탈 시 재확인 | `BO-ST-027-S02` |
| 7 | 회차 없을 때 할 일과 이동 경로 안내 | `BO-ST-027-S03` |
| 8 | 반마다 고쳐 저장. 저장하지 않은 고침이 있으면 다른 반 칩 · 탭으로 옮기기 전에 묻는다 | `BO-ST-027-S02` |
| 9 | 체크박스로 크루를 골라 출석 일괄 변경(「출석 상태」 고르면 바로 적용) · 참여 중단(네비게이터 제외). 사용자 사이트 출석부와 같은 기능 | `BO-ST-027-S04` |
| 10 | 회차 머리 시간대 서울(KST)/LA(PT) 전환 | `BO-ST-027-S01` |
| 11 | 표 맨 위 작업 바, 닉네임 · 디스코드 닉네임 열, 고정 열, 고친 칸 상태 색 테두리, 「?」 발표 표시 설명. 사용자 사이트 출석부와 같다 | `BO-ST-027-S01` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 반 칩 · 제목 줄 · 작업 바 · 격자 / `출석 · 전체 N` | `BO-ST-027-V01` |
| 회차 없음 | 회차 없음 안내 / `이 반은 아직 스터디 시간이 없습니다.` · `이 반에는 아직 회차가 없습니다.` | `BO-ST-027-V02` |
| 저장 전 | 고친 칸 상태 색 테두리 · 「저장」 활성 / - (스크린리더 `저장되지 않음`) | `BO-ST-027-V03` |
| 처리중 | 저장·칸 잠김 / - | `BO-ST-027-V04` |
| 완료 | 테두리 사라짐 · 「저장」 잠김 / - (스크린리더 `출석 n칸을 저장했습니다.`) | `BO-ST-027-V05` |
| 이탈 확인 | 확인 창 / `저장하지 않은 변경이 있습니다` | `BO-ST-027-V06` |

### ST-028 captain-list-users

[PRD](../../01-planning/stories/captain-list-users/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-list-users.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

**현재 추가된 실행 근거:** [user-list--default](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/user-list--default--desktop.png), [user-list--empty](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/user-list--empty--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 가입 회원 전체 조회 — 탈퇴 회원 제외 | `BO-ST-028-S01` |
| 2 | 이름·이메일·권한·담당 스터디·가입일 표기 | `BO-ST-028-S01` |
| 3 | 전체·캡틴·네비게이터·크루 필터 | `BO-ST-028-S02` |
| 4 | 이름·이메일 검색 | `BO-ST-028-S02` |
| 5 | 걸러진 인원 수 표시 | `BO-ST-028-S02` |
| 6 | 참여 스터디 없는 회원은 휴면 구분 | `BO-ST-028-S01` |
| 7 | 20명씩 페이지 이동 | `BO-ST-028-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 탭 · 검색 · 목록 / 인원 수 | `BO-ST-028-V01` |
| 휴면 | 이름 칸 / `휴면` | `BO-ST-028-V02` |
| 검색 결과 없음 | 인원 0 / — | `BO-ST-028-V03` |

### ST-029 captain-grant-roles

[PRD](../../01-planning/stories/captain-grant-roles/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-grant-roles.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

**현재 추가된 실행 근거:** [user-list--role-menu](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/user-list--role-menu--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 유저 목록에서 계정 권한을 캡틴·크루로 변경 | `BO-ST-029-S01` |
| 2 | 선택 즉시 반영 | `BO-ST-029-S01` |
| 3 | 자기 권한 변경 차단 | `BO-ST-029-S02` |
| 4 | 마지막 캡틴 강등 차단 | `BO-ST-029-S02` |
| 5 | 변경 불가 행 구분 및 사유 안내 | `BO-ST-029-S02` |
| 6 | 역할별 기본 권한 표 열람 | `BO-ST-029-S03` |
| 7 | 네비게이터는 이 화면에서 주지 않음 — 스터디 크루 명단에서 지정 | `BO-ST-029-S01` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 기본 | 지금 권한 하나 | `BO-ST-029-V01` |
| 바꿀 수 없음 | 구분된 칸, 짚으면 이유(본인 · 마지막 캡틴) | `BO-ST-029-V02` |
| 고르는 중 | 캡틴 · 크루 | `BO-ST-029-V03` |
| 변경 중 | 원래 배지 그대로, 옆에서 하나가 돈다. 그 줄은 다시 고를 수 없다 | `BO-ST-029-V04` |
| 완료 | 바뀐 배지와 알림 한 번(디스코드 안내 포함) | `BO-ST-029-V05` |
| 실패 | 원래 배지 그대로. 사유와 다시 시도를 알린다 | `BO-ST-029-V06` |

### ST-030 notification-template

[PRD](../../01-planning/stories/notification-template/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/notification-template.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

**현재 추가된 실행 근거:** [notification-templates--default](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--default--desktop.png), [notification-templates--create](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--create--desktop.png), [notification-templates--edit](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--edit--desktop.png), [notification-templates--preview](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--preview--desktop.png), [notification-templates--delete](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notification-templates--delete--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 등록된 템플릿 목록 — 알림 조건 · 채널 · 제목 · 마지막 수정 | `BO-ST-030-S01` |
| 2 | 템플릿 추가 — 알림 조건 · 제목 · 본문 | `BO-ST-030-S02` |
| 3 | 템플릿 수정 — 목록에서 조건을 누르면 값이 채워진 팝업. 조건 · 제목 · 본문 모두 변경 가능. 치환 변수 원문 그대로 | `BO-ST-030-S02` |
| 4 | 템플릿 삭제 — 수정 팝업 안, 확인 단계 후 삭제. 되돌리기 없음. 지난 발송 이력 유지 | `BO-ST-030-S03` |
| 5 | 알림 조건 둘 — 회원가입 · 회원 탈퇴. 같은 조건에 템플릿 여럿 가능 | `BO-ST-030-S01` |
| 6 | 본문 편집 · 미리보기 — 같은 팝업에서 전환하며 저장 전 내용도 확인한다. HTML은 메일 모양으로, 일반 텍스트는 줄바꿈을 유지해 표시한다. 제목·본문의 모든 치환 변수는 미리보기에서도 원문 그대로 표시하고 저장 원문을 보존한다 | `BO-ST-030-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 별도 상태별 화면 절 없음 | 완료 기준과 §2 화면명세의 상태 조건을 구현 단계에서 세분화 | 위 S 시나리오 |

### ST-032 notification-history

[PRD](../../01-planning/stories/notification-history/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/notification-history.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

**현재 추가된 실행 근거:** [notifications--empty](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--empty--desktop.png), [notifications--filter-empty](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--filter-empty--desktop.png), [notifications--error](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--error--desktop.png), [notifications--failed](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--failed--desktop.png), [notifications--resend-confirm](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notifications--resend-confirm--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 최근 순 조회 — 요청 시각 · 알림 조건 · 채널 · 수신 주소 · 상태 · 발송 시각 | `BO-ST-032-S01` |
| 2 | 조건·상태 드롭다운과 조건에 걸린 건수 확인 | `BO-ST-032-S01` |
| 3 | 상태 문구 표기 — 색만으로 가르지 않음 | `BO-ST-032-S01` |
| 4 | 수신 주소 가림과 줄별 펼침 | `BO-ST-032-S01` |
| 5 | 조회 실패와 0건 구분 | `BO-ST-032-S01` |
| 6 | 실패 건 재발송 — 한 건은 바로, 묶음은 확인 후 | `BO-ST-032-S02` |
| 7 | 재발송 진행 표시와 결과 알림 1회 | `BO-ST-032-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 읽는 중 | 표 자리에 20줄의 빈 칸. 거르는 칸과 전체 재발송은 눌리지 않는다 | `BO-ST-032-V01` |
| 이력 없음 | 「아직 알림 발송 이력이 없습니다.」 | `BO-ST-032-V02` |
| 거른 결과 없음 | 「선택한 조건의 발송 이력이 없습니다.」와 전체 보기 | `BO-ST-032-V03` |
| 실패 | 「발송 이력을 불러오지 못했습니다. 다시 시도해 주세요.」와 다시 시도 | `BO-ST-032-V04` |

### ST-033 captain-post-notice

[PRD](../../01-planning/stories/captain-post-notice/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-post-notice.feature)

**자동화 상태: 표시 상태 일부 실행 연결. 행동 전체는 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

**현재 추가된 실행 근거:** [notices--default](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--default--desktop.png), [notices--create](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--create--desktop.png), [notices--edit](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--edit--desktop.png), [notices--delete](../../frontend/apps/back-office-front/e2e/screen-catalog/specs/__screenshots__/notices--delete--desktop.png). PC·모바일 전체 목록은 위 실행 카탈로그 표를 참고한다.

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 운영 콘솔 사이드바 「공지」 — 대시보드 · 스터디 · 행사 · 유저 · **공지** · 알림 순 | `BO-ST-033-S01` |
| 2 | 공지 목록 — 제목 · 작성자 · 게시일 · 마지막 수정. 제목 검색, 20개씩 | `BO-ST-033-S01` |
| 3 | 정렬 — 컬럼 이름을 누르면 오름차순, 다시 누르면 내림차순. 기본은 게시일 내림차순 | `BO-ST-033-S01` |
| 4 | 공지 등록 — 제목 · 본문(서식 없는 글, 줄바꿈 유지). 등록 즉시 사이트 공지에 게시 | `BO-ST-033-S02` |
| 5 | 공지 편집 — 목록에서 제목을 누르면 값이 채워진 팝업. 저장 즉시 사이트에 반영 | `BO-ST-033-S02` |
| 6 | 공지 삭제 — 편집 팝업 안, 확인 단계 후 삭제. 사이트·콘솔 목록에서 빠짐. 되돌리기 없음(소프트 삭제) | `BO-ST-033-S03` |
| 7 | 작성자 — 등록한 캡틴. 운영 콘솔에만 표시 | `BO-ST-033-S01` |
| 8 | 사용자 사이트에 바로 보인다 — 열람 화면은 [crew-view-notices](../../01-planning/stories/crew-view-notices/PRD.md) | `BO-ST-033-S02` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 별도 상태별 화면 절 없음 | 완료 기준과 §2 화면명세의 상태 조건을 구현 단계에서 세분화 | 위 S 시나리오 |

### ST-036 captain-view-feedbacks

[PRD](../../01-planning/stories/captain-view-feedbacks/PRD.md) · [시나리오](../../frontend/apps/back-office-front/screen-catalog/features/prd/captain-view-feedbacks.feature)

**자동화 상태: 예정.** 추가 전 부분 근거: 없음 (관리자 카탈로그·행동 E2E 기준).

| 완료 기준 | PRD 원문 | 연결 시나리오 |
|---|---|---|
| 1 | 목록 — 접수 시각 · 유형 · 제목 · 제출자 · 상태 · 완료 처리자. 접수 시각 내림차순 고정, 20건씩 | `BO-ST-036-S01` |
| 2 | 제목·내용 검색(400ms 뒤) · 유형 · 상태로 거른다. 무엇이든 바꾸면 1페이지 | `BO-ST-036-S01` |
| 3 | 줄을 누르면 상세 — 유형 · 제목 · 제출자 · 접수 시각 · 내용 · 첨부 이미지 · 브라우저 · 화면 크기 | `BO-ST-036-S01` |
| 4 | 상태 — 상세의 상태 뱃지가 곧 드롭다운. 미확인 · 확인 · 완료, 고르면 바로 저장 | `BO-ST-036-S02` |
| 5 | 회신 — 10~2000자, 「전송」하면 저장 + 상태 「완료」. 회신 뒤에는 읽기 전용과 「수정」 | `BO-ST-036-S03` |
| 6 | 캡틴 전용 메모 — 저장 버튼으로 저장, 제출자에게 보이지 않음 | `BO-ST-036-S04` |
| 7 | 완료 처리자 — 「완료」로 바꾼 캡틴. 완료가 아니면 비어 있음 | `BO-ST-036-S02` |
| 8 | 회신 알림 — 알림 조건 「문의 회신」으로 템플릿 · 발송 이력에 연결 | `BO-ST-036-S03` |

| 상태 | PRD의 화면·카피 | 연결 시나리오 |
|---|---|---|
| 불러오는 중 | 표 자리 20줄 스켈레톤 / — | `BO-ST-036-V01` |
| 접수 없음 | 빈 표 / `접수된 문의·오류 신고가 없습니다.` | `BO-ST-036-V02` |
| 걸러서 없음 | 빈 표와 전체 보기 / `조건에 맞는 문의·오류 신고가 없습니다.` · `전체 보기` | `BO-ST-036-V03` |
| 목록 오류 | 안내와 다시 시도 — 0건으로 보이지 않는다 / `불러오지 못했습니다. 다시 시도해 주세요.` | `BO-ST-036-V04` |
| 상태 변경 | 초록 알림 / 실패 시 이전 값으로 되돌림 / `상태를 변경했습니다.` / `상태를 변경하지 못했습니다. 다시 시도해 주세요.` | `BO-ST-036-V05` |
| 회신 전송 | 초록 알림 / 실패 시 입력 유지 / `회신을 보냈습니다.` / `회신을 보내지 못했습니다. 다시 시도해 주세요.` | `BO-ST-036-V06` |
| 메모 저장 | 초록 알림 / 실패 / `저장했습니다.` / `저장하지 못했습니다. 다시 시도해 주세요.` | `BO-ST-036-V07` |
| 상세 없음 | 삭제되었거나 없는 건 / `삭제되었거나 없는 문의·오류 신고입니다.` | `BO-ST-036-V08` |

## 다음 구현 단계

1. 이번에 확인한 4개 Story의 쟁점은 현재 코드 기준으로 자동화한다. 이는 PRD가 코드와 일치한다는 뜻이 아니다. 나머지 원문 차이가 나오면 별도로 대조한다.
2. S/V 시나리오별 시드·응답·검증 조건을 만들고 `.meta.ts` 또는 행동 E2E에 같은 식별자를 연결한다.
3. 예정 → 일부 구현 → 해당 조건 검증 완료를 구분한다. 한 시나리오의 통과로 Story 전체를 완료 처리하지 않는다.
4. PRD와 실제 화면의 차이를 검토한 다음에만 기준 이미지를 생성·갱신한다.
