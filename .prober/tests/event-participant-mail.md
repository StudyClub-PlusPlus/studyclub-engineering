# 행사 참가자 관리 · 행사 메일: 백오피스 API

대상: 백엔드 `/api/admin/events/{eventId}/registrations` · `/api/admin/events/{eventId}/mails` 와 자동 메일. 스테이지의 테스트 계정만 쓰고 ADMIN 계정으로 호출한다. 백오피스 화면 연결은 FE PR #528 이 맡아, 화면이 붙기 전에는 API 와 `알림 › 발송 이력`으로 확인한다.

스테이지는 Flyway 가 꺼져 있다. 메일 확인 전에 `V70__event_mail_templates.sql` 을 한 번 넣었는지 본다. 결과 · 캡처에 이메일 원문 · 토큰 · 실제 회원 정보를 남기지 않는다.

| ID | 절차 | 기대 결과 |
|---|---|---|
| EVENT-PART-01 | 운영진 확인 행사에 크루 둘이 신청 → 한 명은 취소 뒤 다시 신청 → 참가자 목록 | 최신 신청순, 취소 행과 새 행이 따로 보인다. 이메일은 가린 값, `pendingCount` 는 확인 대기 수 |
| EVENT-PART-02 | 목록 한 행의 이메일 보기 | 원본이 보이고 응답 `Cache-Control: no-store`. 감사 기록 `EMAIL_REVEAL` 한 줄 |
| EVENT-PART-03 | 확인 대기 신청을 참가 확정 · 다른 신청을 참가 불가 · 확정 신청을 개별 취소 | 각 응답의 `can*` 가 다시 계산돼 있다. 신청자마다 확정 · 참가 불가 · 신청 취소 메일이 한 통씩 온다 |
| EVENT-PART-04 | 같은 신청에 참가 확정을 두 번 | 두 번째는 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` |
| EVENT-PART-05 | 확인 대기가 남은 행사가 종료되기를 기다리거나(짧은 행사를 만든다) 종료 뒤 1~2분 기다림 | 남은 확인 대기가 참가 불가로 바뀌고 참가 불가 메일이 한 통씩 온다. 참가 확정은 그대로. 종료 뒤 처리 요청은 409 `EVENT_ENDED` |
| EVENT-MAIL-01 | 안내 메일 미리보기(대상 전체 · 혼합 행사, 안내 내용 비움) | 닉네임만 `{{nickname}}` 원문, 참여 안내는 온라인 먼저 두 줄, `blockedReason = NOTICE_REQUIRED` |
| EVENT-MAIL-02 | 안내 내용을 넣어 보내기 → 응답 못 받은 척 같은 `Idempotency-Key` 로 다시 보내기 | 같은 201 응답, 메일 이력은 한 건, 받는 사람마다 메일 한 통 |
| EVENT-MAIL-03 | 오프라인 대상으로 보내기 | 오프라인 참가 확정자만 받고, 본문에 온라인 링크가 없다 |
| EVENT-MAIL-04 | 행사를 취소한 뒤 취소 안내 메일 보내기 | 취소 직전 확인 대기 · 참가 확정이던 사람만 받는다. 장소 · 링크가 없다. 취소 안 된 행사면 409 `EVENT_NOT_CANCELLED` |
| EVENT-MAIL-05 | 메일 이력 목록 · 상세 | 운영자가 보낸 메일만 최신순. 상세의 받는 주소는 가린 값 |
| EVENT-MAIL-06 | 보낸 뒤 그 템플릿을 고치거나 지움 → 실패 건 재발송 | 이력과 다시 나간 메일 모두 접수 당시 문구 |
| EVENT-MAIL-07 | 참가 확정 메일이 실패한 뒤 그 크루가 본인 취소 → 발송 이력에서 재발송 | `canResend = false`, 재발송은 `skipped[].reason = STATE_CHANGED` |
| EVENT-MAIL-08 | 참가 불가 템플릿을 모두 지우고 참가 불가 처리 | 처리는 성공, 메일은 없음, 운영 장애 채널에 「행사 자동 메일 템플릿 없음」 WARN (같은 행사는 10분에 한 번) |
| EVENT-MAIL-09 | 수신자 1,000 · 5,000 · 20,000명 행사에 보내기 (M7) | 예약 저장 시간과 그동안 같은 행사 신청 · 취소의 대기 시간 · 오류를 재서 PR 에 남긴다 |

로컬 회귀 테스트는 `AdminClubEventRegistrationIntegrationTest` · `ClubEventEndSettlementIntegrationTest` · `AdminClubEventMailIntegrationTest` · `ClubEventRegistrationEmailIntegrationTest` · `AdminNotificationIntegrationTest` 에 있다.
