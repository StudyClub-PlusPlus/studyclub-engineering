# core-front E2E와 PRD 대응표

기준: 2026-10-31 작업 트리. [Story 레지스트리](../../01-planning/_registry/stories.md)의 크루·네비게이터 PRD 16개를 대상으로 한다. 관리자 화면은 [관리자 대응표](./admin-e2e-prd-map.md)를 본다.
16개 PRD의 완료 기준 149개와 상태 112개를 총 261개 예정 시나리오에 연결했다. 이 중 70개는 실행 카탈로그의 부분 화면 근거가 있고, 191개는 아직 실행 근거가 없다.


## 연결 규칙

- `CORE-ST-###-S##`: 완료 기준 번호에 대응하는 예정 행동 시나리오. `V##`: PRD 상태별 화면 순서에 대응하는 예정 표시 시나리오.
- `features/prd/*.feature`는 사람이 읽는 명세다. **Playwright는 `.meta.ts`를 실행한다.** `@planned`는 해당 시나리오 전체 자동화가 끝나지 않았다는 뜻이다.
- 실행 상태의 `prdScenarios`와 아래 표를 양방향으로 연결한다. `@catalog-partial`은 일부 화면 근거이며 완료 기준 전체 통과를 뜻하지 않는다.
- `@code-baseline`은 현재 코드의 화면을 기준으로 캡처한 경우다. PRD와 차이는 각 Story 아래에 남긴다. PRD를 코드에 맞춰 임의 수정하지 않는다.
- 완료 기준의 하위 조건도 보존한다. 오류·지연·동시성·실제 저장·외부 OAuth/발송은 별도 행동/응답 조건 검증이 필요하다.
- 소개·가이드·행사·홈·찜한 스터디는 대응하는 등록 PRD가 없어 기존 카탈로그로 유지한다.

## 실행 근거

2026-10-31 검증: 실행 상태 **35개**, 기준 이미지 **60장**. 이미지 갱신 후 일반 비교 `pnpm run test:e2e:catalog` **60 passed (54.7s)**. `typecheck`·`lint` 통과.

스크린샷 파일명은 `{pageId}--{state}--{viewport}.png`다. 신청 화면의 옛 `study-apply--*` 이름도 `study-detail--*`로 통일했다.

| 실행 상태 | PRD 시나리오 (부분 연결) | 스크린샷 |
|---|---|---|
| `login--default` | CORE-ST-005-V01, CORE-ST-005-S01 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/login--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/login--default--mobile.png) |
| `onboarding--default` | CORE-ST-005-V04, CORE-ST-005-S05, CORE-ST-005-S07, CORE-ST-005-S08 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/onboarding--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/onboarding--default--mobile.png) |
| `onboarding--discord` | CORE-ST-005-V09, CORE-ST-005-S11 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/onboarding--discord--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/onboarding--discord--mobile.png) |
| `study-list--default` | CORE-ST-006-V01, CORE-ST-006-S01, CORE-ST-006-S04, CORE-ST-006-S05, CORE-ST-006-S06, CORE-ST-006-S07, CORE-ST-006-S08 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-list--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-list--default--mobile.png) |
| `study-detail--recruiting` | CORE-ST-007-V01, CORE-ST-007-S01 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-detail--recruiting--desktop.png) |
| `study-detail--ongoing` | CORE-ST-007-V04 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-detail--ongoing--desktop.png) |
| `study-detail--not-found` | CORE-ST-007-V06, CORE-ST-007-S03, CORE-ST-008-V20 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-detail--not-found--desktop.png) |
| `study-detail--application-form` | CORE-ST-008-V03, CORE-ST-008-S01 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-detail--application-form--mobile.png) |
| `study-detail--discord-gate` | CORE-ST-008-V08, CORE-ST-008-S03 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-detail--discord-gate--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/study-detail--discord-gate--mobile.png) |
| `my-joined--default` | CORE-ST-009-V01, CORE-ST-009-S01, CORE-ST-009-S02, CORE-ST-009-S03 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined--default--mobile.png) |
| `my-joined--ended` | CORE-ST-009-S05 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined--ended--desktop.png) |
| `my-joined-attendance--crew` | CORE-ST-010-V01, CORE-ST-010-S01, CORE-ST-010-S02, CORE-ST-010-S05, CORE-ST-017-V07, CORE-ST-018-V10, CORE-ST-018-S10 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--crew--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--crew--mobile.png) |
| `my-joined-schedule--crew` | CORE-ST-015-V02, CORE-ST-011-V01, CORE-ST-011-S01 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--crew--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--crew--mobile.png) |
| `my-joined-schedule--navigator` | CORE-ST-015-V01, CORE-ST-015-S03 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--navigator--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--navigator--mobile.png) |
| `my-joined-schedule--captain` | CORE-ST-015-V01 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--captain--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--captain--mobile.png) |
| `my-joined-attendance--navigator` | CORE-ST-017-V01, CORE-ST-017-S01, CORE-ST-018-V01, CORE-ST-018-V02 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--navigator--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--navigator--mobile.png) |
| `my-joined-attendance--captain` | CORE-ST-017-V01, CORE-ST-017-S07 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--captain--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--captain--mobile.png) |
| `my-joined-notice--captain` | CORE-ST-016-S01, CORE-ST-016-S02, CORE-ST-016-S04, CORE-ST-016-S07 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-notice--captain--desktop.png) |
| `my--default` | CORE-ST-012-V01, CORE-ST-012-S01, CORE-ST-012-S11 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my--default--mobile.png) |
| `my--editing` | CORE-ST-012-V02, CORE-ST-012-S02 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my--editing--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my--editing--mobile.png) |
| `my-leave--default` | CORE-ST-013-V01, CORE-ST-013-S02, CORE-ST-013-S03 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-leave--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-leave--default--mobile.png) |
| `my-joined-schedule--create` | CORE-ST-015-S04 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--create--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-schedule--create--mobile.png) |
| `my-joined-attendance--presenter-help` | CORE-ST-010-S03, CORE-ST-017-S13 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--presenter-help--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/my-joined-attendance--presenter-help--mobile.png) |
| `notice-list--empty` | CORE-ST-034-V03 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/notice-list--empty--desktop.png) |
| `terms--default` | CORE-ST-014-V01, CORE-ST-014-S02, CORE-ST-014-S04, CORE-ST-014-S05, CORE-ST-014-S06 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/terms--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/terms--default--mobile.png) |
| `privacy--default` | CORE-ST-014-V01, CORE-ST-014-S02, CORE-ST-014-S04, CORE-ST-014-S05, CORE-ST-014-S07 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/privacy--default--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/privacy--default--mobile.png) |
| `terms--english` | CORE-ST-014-V02 | [desktop](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/terms--english--desktop.png), [mobile](../../frontend/apps/core-front/e2e/screen-catalog/specs/__screenshots__/terms--english--mobile.png) |

## PRD별 완료 기준과 상태

### ST-005 crew-google-login-onboarding

[PRD](../../01-planning/stories/crew-google-login-onboarding/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-google-login-onboarding.feature)

**현재 코드 기준:** PRD 기준 1은 Google만 명시하지만 현재 로그인 화면에는 Apple도 있다. 기준 11의 나중에 하기 버튼은 현재 「스터디 신청할 때 하기」다. 현재 코드 캡처를 유지하며 OAuth 성공·복귀 검증과 구분한다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | Google 계정 로그인 — 다른 인증 수단 없음 | `CORE-ST-005-S01` | `login--default` |
| 2 | 온보딩 완료 회원은 원래 보던 화면(없으면 홈)으로 | `CORE-ST-005-S02` | 미연결 |
| 3 | 신규·온보딩 미완료 회원은 온보딩 화면으로 | `CORE-ST-005-S03` | 미연결 |
| 4 | 인증 취소·실패 시 사유 안내 및 재시도 | `CORE-ST-005-S04` | 미연결 |
| 5 | 닉네임 제안값(Google 이름) 자동 채움 및 수정 | `CORE-ST-005-S05` | `onboarding--default` |
| 6 | 닉네임 형식·중복 검사 — 제출 전 결과 표시 | `CORE-ST-005-S06` | 미연결 |
| 7 | 시간대 선택 3종 — 기기 시간대 기본 선택 | `CORE-ST-005-S07` | `onboarding--default` |
| 8 | 필수 동의 3종 검증, 마케팅 수신은 선택 | `CORE-ST-005-S08` | `onboarding--default` |
| 9 | 약관·방침 전문 열람 및 그 자리에서 동의 | `CORE-ST-005-S09` | 미연결 |
| 10 | 서버 오류·세션 만료 시 입력값 유지 | `CORE-ST-005-S10` | 미연결 |
| 11 | 가입 완료 후 「지금 연결 / 나중에 하기」 선택 | `CORE-ST-005-S11` | `onboarding--discord` |
| 12 | 연결 실패·취소·건너뛰기 시 가입 완료 상태 유지 | `CORE-ST-005-S12` | 미연결 |
| 13 | 스터디 신청에서 진입 후 연결 성공 시 선택했던 신청 폼 복귀 | `CORE-ST-005-S13` | 미연결 |
| 14 | 나중에 하기 선택 시 해당 스터디 상세 복귀, 다음 신청 시 연결 안내 | `CORE-ST-005-S14` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 로그인 버튼 / — | `CORE-ST-005-V01` | `login--default` |
| 처리중 | 로그인 버튼 잠김 / — | `CORE-ST-005-V02` | 미연결 |
| 인증 실패 | 오류 안내 + 로그인 버튼 / 오류 이유와 다시 시도 안내 | `CORE-ST-005-V03` | 미연결 |
| 온보딩 기본 | 제안 닉네임 · 기기 시간대 · 동의 모두 해제 / — | `CORE-ST-005-V04` | `onboarding--default` |
| 검증 실패 | 닉네임 상태 줄 / 형식 오류 · 중복 문구 | `CORE-ST-005-V05` | 미연결 |
| 제출 중 | 가입 완료 잠김 / — | `CORE-ST-005-V06` | 미연결 |
| 처리 실패 | 오류 안내, 입력 유지 / 다시 시도 | `CORE-ST-005-V07` | 미연결 |
| 세션 만료 | 오류 안내, 입력 유지 / 다시 로그인 | `CORE-ST-005-V08` | 미연결 |
| 가입 완료 | 디스코드 연결 선택 / `스터디는 디스코드에서 진행돼요. 지금 연결할까요?` | `CORE-ST-005-V09` | `onboarding--discord` |
| 연결 실패·취소 | 안내 유지, 재시도·나중에 하기 가능 / `디스코드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.` / `디스코드 연결을 취소했어요. 다시 연결할 수 있어요.` | `CORE-ST-005-V10` | 미연결 |
| 연결 완료 | 원래 화면 또는 선택한 스터디 신청 폼 / — | `CORE-ST-005-V11` | 미연결 |

### ST-006 crew-browse-studies

[PRD](../../01-planning/stories/crew-browse-studies/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-browse-studies.feature)

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 로그인 없이 전체 공개 스터디 조회 | `CORE-ST-006-S01` | `study-list--default` |
| 2 | 검색어·모집 상태·시간대·카테고리 동시 적용 | `CORE-ST-006-S02` | 미연결 |
| 3 | 결과 없음 안내 — 검색어가 있으면 지우기 버튼 | `CORE-ST-006-S03` | 미연결 |
| 4 | 카드에 신청·찜 버튼 없음 — 상세로 이동 후 처리 | `CORE-ST-006-S04` | `study-list--default` |
| 5 | 카드 상단 모집 상태 배지 — 모집중(D-N) · 진행중 · 모집 마감 | `CORE-ST-006-S05` | `study-list--default` |
| 6 | 카드 본문에 시작 예정일 — 값이 없으면 「미정」 | `CORE-ST-006-S06` | `study-list--default` |
| 7 | 카드에 진행 시간대 표기 (KST · PST · 동시 모집) | `CORE-ST-006-S07` | `study-list--default` |
| 8 | 정렬 컨트롤 없음 — 최신순 고정 | `CORE-ST-006-S08` | `study-list--default` |
| 9 | 카드 클릭 시 스터디 상세로 이동 | `CORE-ST-006-S09` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 카드 그리드 / — | `CORE-ST-006-V01` | `study-list--default` |
| 필터 결과 없음(검색어 없음) | 빈 상태 / 조건에 맞는 스터디가 없다는 안내 | `CORE-ST-006-V02` | 미연결 |
| 검색 결과 없음 | 빈 상태 + 지우기 버튼 / `"{검색어}"에 해당하는 스터디를 찾을 수 없어요` / `검색어 지우기` | `CORE-ST-006-V03` | 미연결 |
| 비공개 스터디 | — / 목록에 노출하지 않는다(서버·빌드 판정) | `CORE-ST-006-V04` | 미연결 |

### ST-007 crew-view-study-detail

[PRD](../../01-planning/stories/crew-view-study-detail/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-view-study-detail.feature)

**현재 코드 기준:** 없는 주소의 PRD 카피는 영문 기본 404지만 현재 상세는 「스터디를 찾을 수 없어요」를 표시한다. 현재 문구를 assertion으로 사용한다. 비공개 접근 차단은 별도 응답 조건 검증이 필요하다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 공개 스터디 상세 조회 — 제목·한 줄 소개·카테고리·모집 상태·일정 또는 시간대·시작 예정일 | `CORE-ST-007-S01` | `study-detail--recruiting` |
| 2 | 상세 소개 있을 때만 본문 노출 | `CORE-ST-007-S02` | 미연결 |
| 3 | 잘못된 키·비공개 스터디는 상세 열리지 않음 | `CORE-ST-007-S03` | `study-detail--not-found` |
| 4 | 진입 경로 전부 `study_id` 키 사용 | `CORE-ST-007-S04` | 미연결 |
| 5 | 모집 상태 문구는 목록과 동일 | `CORE-ST-007-S05` | 미연결 |
| 6 | 시작 예정일 없으면 「미정」 | `CORE-ST-007-S06` | 미연결 |
| 7 | 스터디 목록으로 돌아가기 | `CORE-ST-007-S07` | 미연결 |
| 8 | 모집중이면 신청 흐름 시작 — 마감·기신청은 차단 | `CORE-ST-007-S08` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 상세 / 제목·한 줄 소개·분야·모집 상태·시작 예정일 | `CORE-ST-007-V01` | `study-detail--recruiting` |
| 소개 없음 | 소개 절 없음 / — | `CORE-ST-007-V02` | 미연결 |
| 시작일 없음 | 시작 예정일 / `시작 예정일 미정` | `CORE-ST-007-V03` | 미연결 |
| 모집 마감 | 신청 / `모집 마감` | `CORE-ST-007-V04` | `study-detail--ongoing` |
| 이미 신청 | 신청 / `신청 완료` | `CORE-ST-007-V05` | 미연결 |
| 없는 주소 | 찾을 수 없음 / `This page could not be found.` | `CORE-ST-007-V06` | `study-detail--not-found` |

### ST-008 crew-submit-application

[PRD](../../01-planning/stories/crew-submit-application/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-submit-application.feature)

**현재 코드 기준:** PRD의 스터디 없음 카피와 현재 상세 문구가 다르다. 연동 팝업은 환경의 OAuth 준비 상태에도 영향받는다. 기본 폼·연동 게이트 캡처는 실제 OAuth 성공이나 신청 저장을 증명하지 않는다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 모집중 스터디 상세에서 신청 폼 열기 — 목록에는 신청하기 없음 | `CORE-ST-008-S01` | `study-detail--application-form` |
| 2 | 미로그인 시 로그인 화면으로, 로그인 후 신청 흐름 이어가기 | `CORE-ST-008-S02` | 미연결 |
| 3 | 디스코드 미연동 시 연동 후에만 폼 열림 / 하위 조건: 로그인·온보딩을 거쳐도 선택한 스터디 유지; 가입 후 지금 연결 성공 시 선택했던 신청 폼으로 바로 복귀; 나중에 하기는 해당 상세로 복귀, 다시 신청하기를 누를 때 연결 안내 | `CORE-ST-008-S03` | `study-detail--discord-gate` |
| 4 | 별명·참여 가능 요일·필수 추가 질문·일정 참여 확인 검증 | `CORE-ST-008-S04` | 미연결 |
| 5 | 미충족 항목으로 화면 이동 및 칸별 실패 문구 | `CORE-ST-008-S05` | 미연결 |
| 6 | 제출 후 「신청 완료」 표기 — 재제출·수정 불가 | `CORE-ST-008-S06` | 미연결 |
| 7 | 완료 후 상세 머무르기 또는 내 스터디 해당 탭 열기 | `CORE-ST-008-S07` | 미연결 |
| 8 | 모집 마감·정원 마감 시 폼 열리지 않음 | `CORE-ST-008-S08` | 미연결 |
| 9 | 제출·연동 실패 시 같은 화면에서 재시도. 처리 중 창 닫기 차단 | `CORE-ST-008-S09` | 미연결 |
| 10 | 스터디를 생성한 캡틴도 신청 폼을 제출하면 그 스터디에 참여 — 크루와 같은 흐름·검증 | `CORE-ST-008-S10` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 미로그인 CTA | 상세 / `신청하기`. 누르면 로그인. `next` = 이 신청 흐름 | `CORE-ST-008-V01` | 미연결 |
| 모집중 CTA | 상세 / `신청하기` | `CORE-ST-008-V02` | 미연결 |
| 기본 | 신청 폼 / 제목 `스터디 신청`. 제출 버튼 `신청` | `CORE-ST-008-V03` | `study-detail--application-form` |
| 폼 로딩 | 신청 폼 / `불러오는 중`. 신청 불가 | `CORE-ST-008-V04` | 미연결 |
| 폼 조회 실패 | 신청 폼 / `신청 폼을 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도`. 신청 불가 | `CORE-ST-008-V05` | 미연결 |
| 추가 질문 없음 | 신청 폼 / 기본 문항만. 빈 안내 없음 | `CORE-ST-008-V06` | 미연결 |
| 연동 확인중 | 상세 CTA / `신청하기`. 스피너. 다시 누르지 못함. 8초 넘으면 폼을 연다(제출이 403 이면 연동 팝업) | `CORE-ST-008-V07` | 미연결 |
| 연동 없음 | 연동 팝업 / `스터디 신청 전 디스코드 연동은 필수입니다.` | `CORE-ST-008-V08` | `study-detail--discord-gate` |
| 연동 준비 중 | 연동 팝업 / `디스코드 연동은 준비 중입니다. 운영진에게 문의해 주세요.` `닫기`만. OAuth 팝업·서버 시크릿 전 | `CORE-ST-008-V09` | 미연결 |
| 연동 처리중 | 연동 팝업 / `디스코드 연동하기`. 중복 연결 요청 방지. 취소로 연결 시뮬레이션 중단 | `CORE-ST-008-V10` | 미연결 |
| 연동 실패 | 연동 팝업 / `디스코드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.` 다른 계정에 이미 연동(409)이면 `이 디스코드 계정은 다른 StudyClub 계정에 이미 연동되어 있습니다.` 로그인 만료(401)면 로그인으로 | `CORE-ST-008-V11` | 미연결 |
| 서버 미가입 | 연동 팝업 / `스터디클럽 디스코드 서버에 아직 가입하지 않았습니다. 서버에 가입한 뒤 다시 연동해 주세요.` `디스코드 서버 가입하기`(초대 링크, 새 탭). 연동 팝업에 잔류 (403 `DISCORD_NOT_IN_GUILD`) | `CORE-ST-008-V12` | 미연결 |
| 검증 실패 | 해당 항목 / §3 표의 실패 카피 | `CORE-ST-008-V13` | 미연결 |
| 처리중 | 신청 버튼 / `신청`. 중복 제출 및 닫기 차단 | `CORE-ST-008-V14` | 미연결 |
| 제출 실패 | 신청 폼 / `신청하지 못했습니다. 다시 시도해 주세요.` `다시 시도` | `CORE-ST-008-V15` | 미연결 |
| 완료 | 완료 팝업 / `스터디 신청이 완료되었습니다. 내 스터디로 이동할까요?` | `CORE-ST-008-V16` | 미연결 |
| 이미 신청 | 상세 CTA / `신청 완료`. 폼 없음. 수정·삭제 없음 | `CORE-ST-008-V17` | 미연결 |
| 모집 마감 | 상세 CTA / `모집 마감`. 폼 없음 | `CORE-ST-008-V18` | 미연결 |
| 정원 마감 | 상세 CTA / `정원 마감`. 폼 없음 | `CORE-ST-008-V19` | 미연결 |
| 스터디 없음 | 상세 / `이 스터디를 찾을 수 없습니다.` 폼 없음 | `CORE-ST-008-V20` | `study-detail--not-found` |

### ST-009 crew-joined-studies

[PRD](../../01-planning/stories/crew-joined-studies/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-joined-studies.feature)

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 목록에 참여 상태별 스터디가 보임 | `CORE-ST-009-S01` | `my-joined--default` |
| 2 | 처음 열면 참여중 탭임 | `CORE-ST-009-S02` | `my-joined--default` |
| 3 | 카드마다 내 역할이 「캡틴」 · 「네비게이터」 · 「크루」 중 하나로 보임 | `CORE-ST-009-S03` | `my-joined--default` |
| 4 | 카드나 주간 칸을 누르면 모집공고 상세가 아니라 그 스터디의 스터디 일정으로 감. 참여 중단 카드는 누를 수 없음 | `CORE-ST-009-S04` | 미연결 |
| 5 | 완주와 참여 중단이 같은 탭에 모이되, 카드에서 완주만 따로 구분됨 | `CORE-ST-009-S05` | `my-joined--ended` |
| 6 | 정렬(다음 회차 · 시작일 · 종료일 · 이름)을 고를 수 있고, 운영하는 스터디가 있으면 역할(운영 · 참여)로 거를 수 있음 | `CORE-ST-009-S06` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 참여중 탭, 주간 일정, 카드 목록 / `내 스터디` | `CORE-ST-009-V01` | `my-joined--default` |
| 로딩 | 본문 자리 / `불러오는 중…` | `CORE-ST-009-V02` | 미연결 |
| 빈 결과 | 탭별 빈 안내 / 위 3번 표 | `CORE-ST-009-V03` | 미연결 |
| 조회 실패 | 본문 자리 / `스터디 목록을 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도` | `CORE-ST-009-V04` | 미연결 |
| 권한 없음 | 로그인 화면으로 이동. `next` = 이 화면 / (로그인 화면 카피) | `CORE-ST-009-V05` | 미연결 |

### ST-010 crew-view-attendance-record

[PRD](../../01-planning/stories/crew-view-attendance-record/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-view-attendance-record.feature)

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 스터디 일정 › 출석 탭에서 내 분반 전원의 회차별 출석 조회 | `CORE-ST-010-S01` | `my-joined-attendance--crew` |
| 2 | 칸은 출석·지각·결석·휴가·미체크 — 크루는 변경 불가 | `CORE-ST-010-S02` | `my-joined-attendance--crew` |
| 3 | 발표 맡은 회차에 발표 표시, 발표 횟수 열. 제목 옆 「?」 로 발표 표시 설명 | `CORE-ST-010-S03` | `my-joined-attendance--presenter-help` |
| 4 | 참여자별 출석률 — 킥오프 제외 | `CORE-ST-010-S04` | 미연결 |
| 5 | 닉네임 옆 칩으로 캡틴·네비게이터 구분. 옆 열에 디스코드 닉네임 | `CORE-ST-010-S05` | `my-joined-attendance--crew` |
| 6 | 참여 중단자는 흐린 이름과 「참여 중단」 칩으로 맨 아래 | `CORE-ST-010-S06` | 미연결 |
| 7 | 회차 없을 때 안내 | `CORE-ST-010-S07` | 미연결 |
| 8 | 다른 분반·스터디 출석부 접근 불가 | `CORE-ST-010-S08` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 출석부 격자 (보기만) / — | `CORE-ST-010-V01` | `my-joined-attendance--crew` |
| 회차 없음 | 격자 대신 안내 / `아직 회차가 없습니다.` · `회차가 생기면 출석부가 보입니다.` | `CORE-ST-010-V02` | 미연결 |
| 불러오는 중 | 격자 자리 로딩 / — | `CORE-ST-010-V03` | 미연결 |
| 불러오기 실패 | 격자 자리 안내 · 다시 시도 / `출석부를 불러오지 못했습니다.` | `CORE-ST-010-V04` | 미연결 |
| 볼 수 없음 | 안내만 / `이 스터디의 일정을 볼 수 없습니다` | `CORE-ST-010-V05` | 미연결 |

### ST-011 crew-apply-presenter

[PRD](../../01-planning/stories/crew-apply-presenter/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-apply-presenter.feature)

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 예정 정규 회차의 빈 발표자 칸에 「신청」 표시 | `CORE-ST-011-S01` | `my-joined-schedule--crew` |
| 2 | 신청 즉시 저장 — 별도 저장 버튼 없음 | `CORE-ST-011-S02` | 미연결 |
| 3 | 내 이름 칩의 × 로 즉시 취소 | `CORE-ST-011-S03` | 미연결 |
| 4 | 한 회차 한 칸 — 이미 들어간 회차에는 「신청」 없음 | `CORE-ST-011-S04` | 미연결 |
| 5 | 다른 사람이 들어간 칸은 이름만 표시, 해제 불가 | `CORE-ST-011-S05` | 미연결 |
| 6 | 동시 신청 시 먼저 저장된 사람이 차지, 늦은 사람에게 안내 | `CORE-ST-011-S06` | 미연결 |
| 7 | 킥오프·시작한 회차는 신청·취소 없음 | `CORE-ST-011-S07` | 미연결 |
| 8 | 출석부의 발표 표시·발표 횟수에 즉시 반영 | `CORE-ST-011-S08` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 빈 칸에 「신청」 칩 / `신청` | `CORE-ST-011-V01` | `my-joined-schedule--crew` |
| 신청함 | 내 이름 칩 + × / — (스크린리더 `N회차 발표자1로 신청했습니다.`) | `CORE-ST-011-V02` | 미연결 |
| 처리중 | 누른 칩 잠김 / — | `CORE-ST-011-V03` | 미연결 |
| 신청 밀림 | 표 위 경고 · 표 다시 그림 / `방금 다른 크루가 N회차 발표자1로 신청했습니다.` | `CORE-ST-011-V04` | 미연결 |
| 이미 시작함 | 표 다시 그림 · 칩 사라짐 / `이미 시작한 회차라 바꿀 수 없습니다.` | `CORE-ST-011-V05` | 미연결 |
| 그 밖의 실패 | 표 위 경고 / `신청하지 못했습니다. 잠시 후 다시 시도해 주세요.` | `CORE-ST-011-V06` | 미연결 |

### ST-012 crew-edit-profile

[PRD](../../01-planning/stories/crew-edit-profile/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-edit-profile.feature)

**현재 코드 기준:** 기본·편집 화면만 캡처한다. 저장/취소의 데이터 보존, 중복 검사, Discord 해제 제한과 재시도는 행동 E2E가 필요하다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 마이페이지에서 닉네임·이메일·시간대·디스코드 연결 상태·마케팅 수신 조회 | `CORE-ST-012-S01` | `my--default` |
| 2 | 내 정보 수정에서 닉네임·시간대를 함께 편집하고 저장 — 마케팅 수신은 별도로 즉시 반영 | `CORE-ST-012-S02` | `my--editing` |
| 3 | 닉네임은 가입과 같은 규칙으로 검사 — 자기 현재 닉네임은 중복 아님 | `CORE-ST-012-S03` | 미연결 |
| 4 | 쓸 수 없는 값이거나 확인 중이면 닉네임 저장 차단 | `CORE-ST-012-S04` | 미연결 |
| 5 | 저장 시 즉시 반영 및 저장 표시 | `CORE-ST-012-S05` | 미연결 |
| 6 | 취소 시 닉네임·시간대 수정값을 모두 폐기 | `CORE-ST-012-S06` | 미연결 |
| 7 | 미연결 시 연결하기, 연결 후 계정 이름 및 연결 해제 표시 | `CORE-ST-012-S07` | 미연결 |
| 8 | 참여 중 스터디가 하나 이상이면 해제 차단 및 연결 유지 | `CORE-ST-012-S08` | 미연결 |
| 9 | 모든 스터디 참여 중단 후 재시도 안내와 내 스터디룸 이동 | `CORE-ST-012-S09` | 미연결 |
| 10 | 연결 실패·인증 취소 시 미연결 유지 및 재시도 | `CORE-ST-012-S10` | 미연결 |
| 11 | 이메일 수정 불가 | `CORE-ST-012-S11` | `my--default` |
| 12 | 회원 탈퇴 지면으로 이동 | `CORE-ST-012-S12` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 닉네임 · 이메일, 저장된 시간대 · 디스코드 · 마케팅 수신 줄 / — | `CORE-ST-012-V01` | `my--default` |
| 내 정보 편집 | 닉네임 입력칸 · 시간대 선택 · 취소 · 저장 / — | `CORE-ST-012-V02` | `my--editing` |
| 검증 실패 | 닉네임 상태 줄, 저장 불가 / 형식 오류 · 중복 문구 | `CORE-ST-012-V03` | 미연결 |
| 처리중 | 닉네임 확인 중, 저장 불가 / 확인 중 | `CORE-ST-012-V04` | 미연결 |
| 디스코드 미연결 | 연결하기 / `연결 안 됨` | `CORE-ST-012-V05` | 미연결 |
| 연결됨 | 계정 이름과 연결 해제 / `@jiwon_dev` (예시) | `CORE-ST-012-V06` | 미연결 |
| 해제 차단 | 연결 유지 · 내 스터디 확인하기 / `참여 중인 스터디가 있어 디스코드 연결을 해제할 수 없어요.` | `CORE-ST-012-V07` | 미연결 |
| 연결 실패·취소 | 재시도 / 연결 결과별 오류 안내 | `CORE-ST-012-V08` | 미연결 |
| 마케팅 수신 | 동의 여부를 체크 상태로. 누르면 바로 저장 / `스터디 소식과 행사 안내를 이메일로 받기` | `CORE-ST-012-V09` | 미연결 |
| 완료 | 새 값 · 줄 끝 저장 표시 / `저장됨` | `CORE-ST-012-V10` | 미연결 |

### ST-013 crew-leave

[PRD](../../01-planning/stories/crew-leave/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-leave.feature)

**현재 코드 기준:** PRD 기본 상태는 안내 세 줄, 현재 화면은 두 줄 구성이다. 현재 카피와 화면을 기준으로 캡처하며 실제 탈퇴 요청은 실행하지 않는다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 마이페이지 내 정보에서 탈퇴 지면 진입 | `CORE-ST-013-S01` | 미연결 |
| 2 | 되돌릴 수 없음·재가입해도 기록 미복구 사전 고지 | `CORE-ST-013-S02` | `my-leave--default` |
| 3 | 탈퇴 사유 선택 — 고르지 않아도 탈퇴 가능 | `CORE-ST-013-S03` | `my-leave--default` |
| 4 | 네비게이터로 맡은 진행 중 스터디 이름·수 표시 | `CORE-ST-013-S04` | 미연결 |
| 5 | 맡은 스터디 있으면 재확인 후 탈퇴, 없으면 즉시 탈퇴 | `CORE-ST-013-S05` | 미연결 |
| 6 | 탈퇴 취소 시 지면 유지 | `CORE-ST-013-S06` | 미연결 |
| 7 | 탈퇴 완료 시 로그아웃 상태로 홈 이동 | `CORE-ST-013-S07` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 안내 세 줄 · 사유 · 탈퇴 · 취소 | `CORE-ST-013-V01` | `my-leave--default` |
| 맡은 스터디 있음 | 위에 경고가 하나 더 붙는다 | `CORE-ST-013-V02` | 미연결 |
| 재확인 | 경고 안에 「그래도 탈퇴하시겠습니까?」와 버튼 둘 | `CORE-ST-013-V03` | 미연결 |
| 처리 중 | 탈퇴가 눌리지 않는다 | `CORE-ST-013-V04` | 미연결 |
| 완료 | 홈으로 보내고 로그아웃한다 | `CORE-ST-013-V05` | 미연결 |

### ST-014 crew-view-terms-privacy

[PRD](../../01-planning/stories/crew-view-terms-privacy/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-view-terms-privacy.feature)

**현재 코드 기준:** PRD 개발 범위의 /terms·/privacy 미구현 표기는 현재 코드와 다르다. 두 경로와 푸터 링크가 존재한다. 처리방침 초안값·문안 확정과 표의 실제 가로 스크롤 동작은 스크린샷만으로 완료 판정하지 않는다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 모든 화면 하단에서 약관·처리방침 열기 | `CORE-ST-014-S01` | 미연결 |
| 2 | 미로그인 열람 | `CORE-ST-014-S02` | `terms--default`, `privacy--default` |
| 3 | 처리방침 링크는 다른 링크와 구분 | `CORE-ST-014-S03` | 미연결 |
| 4 | 문서별 최종 개정일·시행일 표기 | `CORE-ST-014-S04` | `terms--default`, `privacy--default` |
| 5 | 장·조항 단위 전문 열람 | `CORE-ST-014-S05` | `terms--default`, `privacy--default` |
| 6 | 원문 강조 유지 | `CORE-ST-014-S06` | `terms--default` |
| 7 | 좁은 화면에서 표의 열 대응 유지 | `CORE-ST-014-S07` | `privacy--default` |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 제목 · 개정일 · 도입부 · 본문 / — | `CORE-ST-014-V01` | `terms--default`, `privacy--default` |
| en 로케일 | 제목만 영문, 본문 한국어 / `Terms of Service` | `CORE-ST-014-V02` | `terms--english` |

### ST-015 navigator-register-sessions

[PRD](../../01-planning/stories/navigator-register-sessions/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/navigator-register-sessions.feature)

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 내 스터디 카드·주간 칸에서 일정 탭 진입 — 참여 중단 스터디는 진입 불가 | `CORE-ST-015-S01` | 미연결 |
| 2 | 미참여 스터디 주소 진입 시 안내만 표시 | `CORE-ST-015-S02` | 미연결 |
| 3 | 내 분반 회차 일정순 조회 — 분반 시간대 기본, KST·PDT 탭 전환 | `CORE-ST-015-S03` | `my-joined-schedule--navigator` |
| 4 | 회차 추가 — 단건 또는 매일·매주 반복. 생성 결과 미리보기(날짜·건너뛰는 날·번호 밀림) | `CORE-ST-015-S04` | `my-joined-schedule--create` |
| 5 | 예정 회차 표에서 일자·시각·제목·발표자 수정, 여러 줄 일괄 저장 | `CORE-ST-015-S05` | 미연결 |
| 6 | 예정 회차를 체크박스로 골라 일괄 삭제 — 확인 모달을 거친다. 「이후 반복 모두」 삭제 없음 | `CORE-ST-015-S06` | 미연결 |
| 7 | 크루는 조회만. 예정 회차의 빈 발표자 칸만 선착순 등록·취소 (한 회차 한 칸) | `CORE-ST-015-S07` | 미연결 |
| 8 | 분반마다 킥오프(0회차) 한 건 — 삭제 불가, 발표자 없음, 출석률 제외. **캡틴이 백오피스에서 정하고, 이 화면에서는 고치지 않는다** | `CORE-ST-015-S08` | 미연결 |
| 9 | 출석부에서 출석·발표를 한 격자로 조회 — 발표 횟수 열 | `CORE-ST-015-S09` | 미연결 |
| 10 | 스터디 규칙 수정 (캡틴·네비게이터) 및 전원 열람 | `CORE-ST-015-S10` | 미연결 |
| 11 | 시작한 회차는 수정·삭제 불가 | `CORE-ST-015-S11` | 미연결 |
| 12 | 저장 직후 주간 일정·다가오는 회차·출석 칸·출석부 반영 | `CORE-ST-015-S12` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 (캡틴·네비게이터) | 정보·규칙 · 회차 개수 · 시간대 탭 · 회차 추가 · 고칠 수 있는 표 / `일정 · 전체 n · 예정 n` | `CORE-ST-015-V01` | `my-joined-schedule--navigator`, `my-joined-schedule--captain` |
| 기본 (크루) | 정보·규칙 · 회차 개수 · 시간대 탭 · 글자 표 · 신청 / `신청` | `CORE-ST-015-V02` | `my-joined-schedule--crew` |
| 볼 수 없음 | 안내만 / `이 스터디의 일정을 볼 수 없습니다` | `CORE-ST-015-V03` | 미연결 |
| 고치는 중 | 일정: 고친 줄 색 · 작업 바 「저장」 활성 / 출석: 고친 칸 상태 색 테두리 · 「저장」 활성 / `변경 취소` · `저장` | `CORE-ST-015-V04` | 미연결 |
| 검증 실패 | 막힌 칸 아래 이유 · 저장 비활성 / `발표자1과 다른 사람을 골라 주세요.` 등 | `CORE-ST-015-V05` | 미연결 |
| 삭제 확인 | 확인 모달 (기본 포커스 「취소」) / `N회차(9/23(수))를 지울까요?` · `회차 n개(3회차, 4회차…)를 지울까요?` | `CORE-ST-015-V06` | 미연결 |
| 신청 밀림 | 표 위 경고 한 줄 / `방금 다른 크루가 N회차 발표자1로 신청했습니다.` | `CORE-ST-015-V07` | 미연결 |
| 회차 없음 (일정) | 표 대신 안내 / `아직 회차가 없습니다.` (캡틴·네비게이터는 「회차 추가」로 만들라는 말을 덧붙인다) | `CORE-ST-015-V08` | 미연결 |
| 회차 없음 (출석) | 격자 대신 안내 / `아직 회차가 없습니다.` (13-1) | `CORE-ST-015-V09` | 미연결 |

### ST-016 navigator-study-notice

[PRD](../../01-planning/stories/navigator-study-notice/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/navigator-study-notice.feature)

**현재 코드 기준:** 현재 연결 근거는 캡틴의 공지 작성 화면이다. 네비게이터 권한, 실제 메일·Discord 발송, 제한 횟수·시간은 검증하지 않았다. PRD에 별도 상태별 화면 절이 없어 V 시나리오를 만들지 않는다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 캡틴·네비게이터에게만 「공지」 탭이 보인다 (반 네비게이터 · 그 스터디를 만든 캡틴) | `CORE-ST-016-S01` | `my-joined-notice--captain` |
| 2 | 제목(60자)·본문(1,500자)을 쓰고 글자 수가 보이며, 넘치면 말없이 자르지 않고 보내기를 막는다 | `CORE-ST-016-S02` | `my-joined-notice--captain` |
| 3 | 메일·디스코드 중 하나 이상을 고르고, 디스코드를 못 쓰는 이유는 보내기 전에 보인다 | `CORE-ST-016-S03` | 미연결 |
| 4 | 받는 사람은 이 반의 참여 중·쉬는 중 멤버이고, 상태로 거른 목록에서 고르고 전체 선택할 수 있다. 거르기는 이미 고른 사람을 지우지 않는다 | `CORE-ST-016-S04` | `my-joined-notice--captain` |
| 5 | 보내기 전에 받는 사람 수·채널을 적은 확인 창으로 한 번 더 묻는다 | `CORE-ST-016-S05` | 미연결 |
| 6 | 같은 반에서 1분 안 재발송과 하루 30회를 넘는 발송은 막고, 사유와 다시 보낼 수 있는 시각을 보여 준다 | `CORE-ST-016-S06` | 미연결 |
| 7 | 보낸 공지 기록에 제목·본문·보낸 사람·시각·받은 사람 수와 채널별 결과(메일 대기·완료·실패, 디스코드 완료·건너뜀·실패)가 보인다 | `CORE-ST-016-S07` | `my-joined-notice--captain` |
| 8 | 디스코드를 연동하지 않은 사람은 목록에서 알아볼 수 있고, 멘션에서 빠져도 메일은 간다 | `CORE-ST-016-S08` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 별도 상태별 화면 절 없음 | 완료 기준과 화면명세를 사용한다 | S 시나리오 참조 | — |

### ST-017 navigator-edit-attendance

[PRD](../../01-planning/stories/navigator-edit-attendance/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/navigator-edit-attendance.feature)

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 내 분반 참여자 × 회차 출석 격자 조회 | `CORE-ST-017-S01` | `my-joined-attendance--navigator` |
| 2 | 칸 클릭으로 출석·지각·결석·휴가·미체크 전환 | `CORE-ST-017-S02` | 미연결 |
| 3 | 저장으로 일괄 반영. 저장 전 변경 칸만 그 상태 색 테두리로 구분 (평소에는 테두리 없음) | `CORE-ST-017-S03` | 미연결 |
| 4 | 저장 전 변경 일괄 되돌리기 | `CORE-ST-017-S04` | 미연결 |
| 5 | 미저장 상태로 이탈 시 재확인 | `CORE-ST-017-S05` | 미연결 |
| 6 | 참여자별 출석률 실시간 재계산. 킥오프 제외 | `CORE-ST-017-S06` | 미연결 |
| 7 | 내 분반 참여자만 표시. 캡틴은 정보 카드의 「백오피스 출석부」로 이동 | `CORE-ST-017-S07` | `my-joined-attendance--captain` |
| 8 | 회차 없을 때 안내와 일정으로 가는 경로 | `CORE-ST-017-S08` | 미연결 |
| 9 | 수정 권한: 네비게이터와 담당 캡틴. 그 외에는 조회 화면 | `CORE-ST-017-S09` | 미연결 |
| 10 | 표 제목 「출석」 옆에는 전체 인원 N 만. 고른 인원은 작업 바의 「n명 선택」 | `CORE-ST-017-S10` | 미연결 |
| 11 | KST · PDT 탭으로 회차 머리의 일자를 바꿔 본다. 칸 값은 바뀌지 않는다 | `CORE-ST-017-S11` | 미연결 |
| 12 | 닉네임 · 디스코드 닉네임 · 발표 횟수(왼쪽)와 출석률(오른쪽)은 고정, 회차 열만 가로 스크롤 | `CORE-ST-017-S12` | 미연결 |
| 13 | 제목 옆 「?」 로 발표(마이크) 표시 설명을 연다 | `CORE-ST-017-S13` | `my-joined-attendance--presenter-help` |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 출석부 (캡틴은 백오피스 출석부 버튼) / — | `CORE-ST-017-V01` | `my-joined-attendance--navigator`, `my-joined-attendance--captain` |
| 고치는 중 | 바뀐 칸에 상태 색 테두리 · 작업 바 「저장」 활성 / `변경 취소` · `저장` | `CORE-ST-017-V02` | 미연결 |
| 처리중 | 저장 · 변경 취소 · 칸 잠김 / — | `CORE-ST-017-V03` | 미연결 |
| 완료 | 테두리 사라짐 · 「저장」 잠김 / - (스크린리더 `출석 n칸을 저장했습니다.`) | `CORE-ST-017-V04` | 미연결 |
| 나가기 확인 | 확인 창 / `저장하지 않은 변경이 있습니다` | `CORE-ST-017-V05` | 미연결 |
| 회차 없음 | 격자 대신 안내 / `아직 회차가 없습니다.` | `CORE-ST-017-V06` | 미연결 |
| 고칠 수 없음 | 보기 화면 (crew-view-attendance-record) / — | `CORE-ST-017-V07` | `my-joined-attendance--crew` |

### ST-018 navigator-withdraw-participant

[PRD](../../01-planning/stories/navigator-withdraw-participant/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/navigator-withdraw-participant.feature)

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 출석부의 줄 맨 왼쪽 체크박스로 사람을 고른다. 머리 칸 체크박스로 전체 선택 · 해제한다. 나 · 캡틴 · 네비게이터도 골라진다 | `CORE-ST-018-S01` | 미연결 |
| 2 | 고른 사람의 한 회차 칸을 같은 출석 상태로 한 번에 바꾼다. 「출석 상태」 드롭다운에서 마우스로 고르는 순간(키보드는 화살표로 옮긴 뒤 Enter 를 누르거나 칸을 떠날 때) 바뀐다(「출석 적용」 버튼 없음) | `CORE-ST-018-S02` | 미연결 |
| 3 | 고른 사람을 「중단 예정」으로 둔다. 바로 반영하지 않는다. 그 줄 전체가 옅은 빨강이 되고 닉네임 옆에 되돌리기 아이콘이 붙는다 | `CORE-ST-018-S03` | 미연결 |
| 4 | 「저장」 한 번에 출석 변경과 참여 중단이 함께 반영된다. 하나라도 실패하면 둘 다 반영되지 않는다 | `CORE-ST-018-S04` | 미연결 |
| 5 | 중단 예정이 있으면 저장 전에 확인 창이 뜬다. 창은 중단할 사람 이름 · 바뀐 출석 칸 수와 네 가지를 말한다: 지금까지 출석은 남는다 · 지금 뒤에 시작하는 회차는 「-」이고 출석률에서 빠진다 · 디스코드 채널 · 드라이브 링크를 볼 수 없고 앞으로 맡은 회차의 발표자에서 빠진다 · 다시 참여시킬 수 없다 | `CORE-ST-018-S05` | 미연결 |
| 6 | 반영되면 중단한 줄이 맨 아래로 내려가 「참여 중단」 칩이 붙는다. **저장한 시각 뒤에 시작하는 회차** 칸은 「-」, 출석률은 그 앞 회차로 다시 계산된다. 중단 전 출석 기록은 지워지지 않는다 | `CORE-ST-018-S06` | 미연결 |
| 7 | 반영되면 **저장한 시각 뒤에 시작하는 회차**의 발표자1 · 발표자2 칸에서 그 사람이 빠진다(빈 칸). 이미 시작한 회차의 발표 기록은 남는다 | `CORE-ST-018-S07` | 미연결 |
| 8 | 「변경 취소」는 출석 변경과 중단 예정을 모두 되돌린다 | `CORE-ST-018-S08` | 미연결 |
| 9 | 고른 사람 중 나 · 담당 캡틴 · 네비게이터가 한 명이라도 있으면 「참여 중단」이 잠기고 그 이유가 보인다. 출석 일괄 변경은 그대로 된다. 이미 중단한 줄에는 체크박스가 없다. 다시 참여시킬 수 없다 | `CORE-ST-018-S09` | 미연결 |
| 10 | 크루 화면에는 체크박스 · 작업 바가 없다 | `CORE-ST-018-S10` | `my-joined-attendance--crew` |
| 11 | 처리하지 못하면 확인 창이 남고 창 안에 오류 문구가 보인다 (프로토 미구현) | `CORE-ST-018-S11` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 기본 | 줄 왼쪽 체크박스 (나 · 운영진 포함) / — | `CORE-ST-018-V01` | `my-joined-attendance--navigator` |
| 선택 전 | 작업 바 드롭다운 · 버튼 옅은 회색(잠김) / `0명 선택` | `CORE-ST-018-V02` | `my-joined-attendance--navigator` |
| 선택 | 표 맨 위 작업 바 활성 / `n명 선택` · `출석 상태` · `참여 중단` · `선택 해제` | `CORE-ST-018-V03` | 미연결 |
| 운영진 섞임 | 「참여 중단」 잠김 + 이유 / `네비게이터는 참여 중단할 수 없습니다. 캡틴에게 문의하세요.` | `CORE-ST-018-V04` | 미연결 |
| 고치는 중 | 바뀐 칸 상태 색 테두리 · 중단 예정 줄 옅은 빨강 + 되돌리기 아이콘 · 「저장」 활성 / `중단 예정 n명` · `중단 예정 취소`(말풍선) · `변경 취소` · `저장` | `CORE-ST-018-V05` | 미연결 |
| 확인 | 확인 창 (중단 예정이 있을 때만) / `n명의 참여를 중단하고 저장할까요?` | `CORE-ST-018-V06` | 미연결 |
| 처리중 | 저장 · 변경 취소 · 칸 · 체크박스 잠김 / — | `CORE-ST-018-V07` | 미연결 |
| 완료 | 중단한 줄 맨 아래 · 「참여 중단」 칩 / — (스크린리더 `출석 n칸을 저장하고 m명의 참여를 중단했습니다.`) | `CORE-ST-018-V08` | 미연결 |
| 실패 | 확인 창 유지 · 창 안 오류 (프로토 미구현) / `저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.` | `CORE-ST-018-V09` | 미연결 |
| 크루 | 체크박스 · 작업 바 없음 / - | `CORE-ST-018-V10` | `my-joined-attendance--crew` |

### ST-034 crew-view-notices

[PRD](../../01-planning/stories/crew-view-notices/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-view-notices.feature)

**현재 코드 기준:** 현재 공지 빈 목록은 서버 API의 로컬 DB 상태에 의존한다. 빈 안내 문구 assertion을 추가했지만 독립 fixture는 아니다. 목록 있음·상세·오류·404는 아직 카탈로그에 연결하지 않았다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 사이트 헤더 「공지」에서 목록으로 진입 — 로그인 없이 | `CORE-ST-034-S01` | 미연결 |
| 2 | 목록 — 제목 · 게시일. 게시일 내림차순 고정, 10건씩. 줄을 누르면 상세 | `CORE-ST-034-S02` | 미연결 |
| 3 | 상세 — 제목 · 게시일 · 본문 | `CORE-ST-034-S03` | 미연결 |
| 4 | 본문은 평문 — 줄바꿈·공백 보존, HTML 로 해석하지 않음, 본문 속 URL 은 링크 | `CORE-ST-034-S04` | 미연결 |
| 5 | 상세 아래 이전·다음 공지 — 이동할 공지의 제목 표시, 끝에서는 비활성 | `CORE-ST-034-S05` | 미연결 |
| 6 | 상세 아래 「목록으로」 | `CORE-ST-034-S06` | 미연결 |
| 7 | 삭제된 공지는 목록·상세·이전다음 어디에도 없음 — 주소로 들어오면 404 | `CORE-ST-034-S07` | 미연결 |
| 8 | 작성자 비노출 | `CORE-ST-034-S08` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 불러오는 중 | 목록 · 본문 자리 스켈레톤 / — | `CORE-ST-034-V01` | 미연결 |
| 목록 있음 | 제목 · 게시일 줄 / — | `CORE-ST-034-V02` | 미연결 |
| 공지 없음 | 빈 카드 / `등록된 공지가 없습니다.` | `CORE-ST-034-V03` | `notice-list--empty` |
| 오류 | 안내와 다시 시도 / `공지를 불러오지 못했습니다. 다시 시도해 주세요.` · `다시 시도` | `CORE-ST-034-V04` | 미연결 |
| 404 | 삭제된 공지 · 없는 id / 사이트 공통 404 | `CORE-ST-034-V05` | 미연결 |

### ST-035 crew-submit-feedback

[PRD](../../01-planning/stories/crew-submit-feedback/PRD.md) · [시나리오](../../frontend/apps/core-front/screen-catalog/features/prd/crew-submit-feedback.feature)

**현재 코드 기준:** 현재 core-front에 내 문의 목록·작성·상세 페이지가 없다. 전체를 미연결 예정으로 둔다. 관리자 문의 화면과 혼동하지 않는다.

| 완료 기준 | PRD 원문 (하위 조건 포함) | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 1 | 프로필 드롭다운 「찜한 스터디」 아래, 구분선 위에 「문의·오류 신고」 — 누르면 내 문의 목록 | `CORE-ST-035-S01` | 미연결 |
| 2 | 내 문의 목록 — 유형 · 제목 · 접수일 · 상태. 접수일 내림차순 고정, 20건씩. 줄을 누르면 상세 | `CORE-ST-035-S02` | 미연결 |
| 3 | 상태는 둘 — 접수 · 답변 완료 (콘솔의 미확인·확인 = 접수, 완료 = 답변 완료) | `CORE-ST-035-S03` | 미연결 |
| 4 | [문의하기] → 팝업 — 유형(필수, 기본 선택 없음) · 제목(2~100자) · 내용(10~2000자, 평문) · 이미지 첨부(선택) | `CORE-ST-035-S04` | 미연결 |
| 5 | 유형이 「문의」면 디스코드 채널 안내와 링크. 전송은 그대로 허용 | `CORE-ST-035-S05` | 미연결 |
| 6 | 전송하면 팝업이 닫히고 목록 맨 위에 「접수」로 선다. 「의견을 보내주셔서 감사합니다.」 | `CORE-ST-035-S06` | 미연결 |
| 7 | 상세 — 유형 · 제목 · 접수 시각 · 상태 · 내가 쓴 내용 · 첨부 이미지 · 답변(없으면 「답변을 준비하고 있어요」) | `CORE-ST-035-S07` | 미연결 |
| 8 | 본인 것만 보인다. 남의 문의 · 없는 번호는 찾을 수 없음 | `CORE-ST-035-S08` | 미연결 |

| 상태 | PRD 화면·카피 | 시나리오 | 실행 화면 근거 |
|---|---|---|---|
| 불러오는 중 | 표 자리 스켈레톤 / — | `CORE-ST-035-V01` | 미연결 |
| 문의 없음 | 빈 표와 문의하기 / `접수한 문의가 없습니다.` · `문의하기` | `CORE-ST-035-V02` | 미연결 |
| 목록 오류 | 안내와 다시 시도 / `불러오지 못했습니다. 다시 시도해 주세요.` | `CORE-ST-035-V03` | 미연결 |
| 전송 성공 | 팝업 닫힘, 초록 알림 / `의견을 보내주셔서 감사합니다.` | `CORE-ST-035-V04` | 미연결 |
| 전송 실패 | 팝업 유지, 빨간 알림 / `의견을 보내지 못했습니다. 다시 시도해 주세요.` · `다시 시도` | `CORE-ST-035-V05` | 미연결 |
| 너무 자주 보냄 | 빨간 알림 / `잠시 후 다시 시도해 주세요.` | `CORE-ST-035-V06` | 미연결 |
| 상세 없음 | 남의 것 · 없는 번호 / `찾을 수 없는 문의입니다.` | `CORE-ST-035-V07` | 미연결 |

## 검증 범위와 남은 작업

브라우저 시각을 `2026-10-31T03:00:00Z`로 고정하고 진입 URL을 검증한다. 기존 core 카탈로그의 MSW·회원 시드를 유지한다. 공개 스터디와 공지의 서버 조회 등 일부 데이터는 로컬 API에 의존하므로 백오피스의 독립 fixture와 같은 재현성을 보장하지 않는다. `notice-list--empty`는 빈 목록 문구까지 확인한다.

이번 추가: 내 정보 편집(PC·모바일), 회차 추가 창(PC·모바일), 발표 표시 설명(PC·모바일), 영문 약관(PC·모바일), 약관·처리방침 모바일. 저장·삭제·탈퇴·발송은 실행하지 않는다.

미연결 시나리오는 `.meta.ts`의 재현 가능한 응답 fixture 또는 행동 E2E를 추가한 후 연결한다. 문의 기능(ST-035)은 사용자 화면 구현부터 필요하다. 스크린샷 비교 성공을 PRD 전체 완료로 해석하지 않는다.
