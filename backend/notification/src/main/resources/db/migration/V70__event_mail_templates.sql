-- V70: 행사 메일 여섯 조건의 첫 템플릿 (specs/event-mail/spec.md 「시드」).
--   * 본문은 frontend/apps/playground/src/proto/mail/templates/ 의 HTML 시안과 같다. 제목은 스펙 「시드」 표.
--   * 행사 조건은 ID 가 가장 작은 EMAIL 템플릿 한 건만 쓴다. 같은 조건 템플릿이 이미 있으면 넣지 않고 덮어쓰지 않는다.
--   * stage 는 Flyway off 이므로 코드 배포 뒤 이 SQL 을 한 번 실행한다. 다시 실행해도 중복되지 않는다.

INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, UPDATED_BY_ADMIN_ID, CREATED_AT, UPDATED_AT)
SELECT 'EVENT_ANNOUNCEMENT', 'EMAIL', '[StudyClub] {{eventTitle}} 안내',
'<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>[StudyClub] {{eventTitle}} 안내</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FF;">
<!-- 미리보기 문구: 받은편지함 목록에서 제목 옆에 보인다 -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7FF;">{{eventTitle}} 참가자를 위한 운영 안내입니다.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FF;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <!-- 워드마크 (이미지 차단 메일함에서도 보이도록 글자로) -->
        <tr>
          <td style="padding:0 8px 16px 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#282A43;letter-spacing:-0.2px;">
            StudyClub
          </td>
        </tr>
        <!-- 본문 카드 -->
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E2E1E9;border-radius:12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:4px;line-height:4px;font-size:0;background-color:#5267D8;border-radius:12px 12px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;font-weight:600;color:#5267D8;">행사 안내</p>
                  <h1 style="margin:0 0 20px 0;font-size:24px;line-height:34px;font-weight:700;color:#282A43;letter-spacing:-0.4px;">{{eventTitle}}</h1>
                  <p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#626476;">안녕하세요, {{nickname}}님.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px 28px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;color:#626476;overflow-wrap:anywhere;word-break:break-word;">
                  <!-- 행사별 내용은 안내 메일 보내기에서 입력한다. HTML을 직접 작성하지 않는다. -->
                  <div style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#282A43;">{{notice}}</div>
                  <p style="margin:0 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">참여 안내</p>
                  <div style="padding:18px;background-color:#F5F7FF;border-radius:8px;">
                    <p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">{{participation}}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1E9;">&nbsp;</div></td>
              </tr>
              <tr>
                <td style="padding:24px 40px 32px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:14px;line-height:22px;color:#626476;">
                  <p style="margin:0 0 12px 0;">행사와 관련해 궁금한 점이 있다면 운영진에게 문의해 주세요.</p>
                  <p style="margin:0;color:#282A43;">감사합니다.<br>StudyClub 드림</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 법적 고지: 왜 이 메일을 받았는지 -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:12px;line-height:18px;color:#6C6D7F;">
            이 메일은 참가가 확정된 {{eventTitle}} 행사의 운영 안내를 위해 발송되었습니다.<br>
            © StudyClub · <a href="https://studyclub.life" target="_blank" style="color:#6C6D7F;text-decoration:underline;">studyclub.life</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
',
NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'EVENT_ANNOUNCEMENT' AND CHANNEL = 'EMAIL');

INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, UPDATED_BY_ADMIN_ID, CREATED_AT, UPDATED_AT)
SELECT 'EVENT_CANCELLATION', 'EMAIL', '[StudyClub] {{eventTitle}} 행사 취소 안내',
'<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>[StudyClub] {{eventTitle}} 행사 취소 안내</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FF;">
<!-- 미리보기 문구: 받은편지함 목록에서 제목 옆에 보인다 -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7FF;">{{eventTitle}} 행사가 취소되어 안내드립니다.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FF;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <!-- 워드마크 (이미지 차단 메일함에서도 보이도록 글자로) -->
        <tr>
          <td style="padding:0 8px 16px 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#282A43;letter-spacing:-0.2px;">
            StudyClub
          </td>
        </tr>
        <!-- 본문 카드 -->
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E2E1E9;border-radius:12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:4px;line-height:4px;font-size:0;background-color:#5267D8;border-radius:12px 12px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;font-weight:600;color:#5267D8;">행사 취소 안내</p>
                  <h1 style="margin:0 0 20px 0;font-size:24px;line-height:34px;font-weight:700;color:#282A43;letter-spacing:-0.4px;">{{eventTitle}}</h1>
                  <p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#626476;">안녕하세요, {{nickname}}님.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px 28px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;color:#626476;overflow-wrap:anywhere;word-break:break-word;">
                  <!-- 취소 안내 내용은 취소 안내 메일 보내기에서 입력한다. 일정·장소·참여 링크는 넣지 않는다. -->
                  <div style="margin:0;font-size:16px;line-height:26px;color:#282A43;">{{notice}}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1E9;">&nbsp;</div></td>
              </tr>
              <tr>
                <td style="padding:24px 40px 32px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:14px;line-height:22px;color:#626476;">
                  <p style="margin:0 0 12px 0;">행사와 관련해 궁금한 점이 있다면 운영진에게 문의해 주세요.</p>
                  <p style="margin:0;color:#282A43;">감사합니다.<br>StudyClub 드림</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 법적 고지: 왜 이 메일을 받았는지 -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:12px;line-height:18px;color:#6C6D7F;">
            이 메일은 회원님이 신청하신 {{eventTitle}} 행사의 취소를 안내하기 위해 발송되었습니다.<br>
            © StudyClub · <a href="https://studyclub.life" target="_blank" style="color:#6C6D7F;text-decoration:underline;">studyclub.life</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>',
NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'EVENT_CANCELLATION' AND CHANNEL = 'EMAIL');

INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, UPDATED_BY_ADMIN_ID, CREATED_AT, UPDATED_AT)
SELECT 'EVENT_REGISTRATION_PENDING', 'EMAIL', '[StudyClub] {{eventTitle}} 신청이 확인 대기 중입니다',
'<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>[StudyClub] {{eventTitle}} 신청이 확인 대기 중입니다</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FF;">
<!-- 미리보기 문구: 받은편지함 목록에서 제목 옆에 보인다 -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7FF;">{{eventTitle}} 신청이 접수되어 운영진이 확인하고 있습니다.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FF;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <!-- 워드마크 (이미지 차단 메일함에서도 보이도록 글자로) -->
        <tr>
          <td style="padding:0 8px 16px 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#282A43;letter-spacing:-0.2px;">
            StudyClub
          </td>
        </tr>
        <!-- 본문 카드 -->
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E2E1E9;border-radius:12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:4px;line-height:4px;font-size:0;background-color:#5267D8;border-radius:12px 12px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;font-weight:600;color:#5267D8;">확인 대기</p>
                  <h1 style="margin:0 0 20px 0;font-size:24px;line-height:34px;font-weight:700;color:#282A43;letter-spacing:-0.4px;">{{eventTitle}}</h1>
                  <p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#626476;">안녕하세요, {{nickname}}님.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px 28px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;color:#626476;overflow-wrap:anywhere;word-break:break-word;">
                  <div style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#282A43;"><strong>{{eventTitle}}</strong> 행사 신청이 정상적으로 접수되었습니다.<br>현재 운영진이 신청 내용을 확인하고 있습니다. 참가 여부가 결정되면 이메일로 다시 안내해 드립니다.</div>
                  <p style="margin:0 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">신청 정보</p>
                  <div style="padding:18px;background-color:#F5F7FF;border-radius:8px;">
                    <p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">참여 방식: {{channel}}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1E9;">&nbsp;</div></td>
              </tr>
              <tr>
                <td style="padding:24px 40px 32px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:14px;line-height:22px;color:#626476;">
                  <p style="margin:0 0 12px 0;">행사와 관련해 궁금한 점이 있다면 운영진에게 문의해 주세요.</p>
                  <p style="margin:0;color:#282A43;">감사합니다.<br>StudyClub 드림</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 법적 고지: 왜 이 메일을 받았는지 -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:12px;line-height:18px;color:#6C6D7F;">
            이 메일은 회원님이 신청하신 {{eventTitle}} 행사의 신청 접수를 안내하기 위해 발송되었습니다.<br>
            © StudyClub · <a href="https://studyclub.life" target="_blank" style="color:#6C6D7F;text-decoration:underline;">studyclub.life</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>',
NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'EVENT_REGISTRATION_PENDING' AND CHANNEL = 'EMAIL');

INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, UPDATED_BY_ADMIN_ID, CREATED_AT, UPDATED_AT)
SELECT 'EVENT_REGISTRATION_CONFIRMED', 'EMAIL', '[StudyClub] {{eventTitle}} 참가가 확정되었습니다',
'<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>[StudyClub] {{eventTitle}} 참가가 확정되었습니다</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FF;">
<!-- 미리보기 문구: 받은편지함 목록에서 제목 옆에 보인다 -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7FF;">{{eventTitle}} 행사 참가가 확정되었습니다. 일정과 참여 방법을 확인해 주세요.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FF;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <!-- 워드마크 (이미지 차단 메일함에서도 보이도록 글자로) -->
        <tr>
          <td style="padding:0 8px 16px 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#282A43;letter-spacing:-0.2px;">
            StudyClub
          </td>
        </tr>
        <!-- 본문 카드 -->
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E2E1E9;border-radius:12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:4px;line-height:4px;font-size:0;background-color:#5267D8;border-radius:12px 12px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;font-weight:600;color:#5267D8;">참가 확정</p>
                  <h1 style="margin:0 0 20px 0;font-size:24px;line-height:34px;font-weight:700;color:#282A43;letter-spacing:-0.4px;">{{eventTitle}}</h1>
                  <p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#626476;">안녕하세요, {{nickname}}님.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px 28px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;color:#626476;overflow-wrap:anywhere;word-break:break-word;">
                  <div style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#282A43;"><strong>{{eventTitle}}</strong> 행사 참가가 확정되었습니다.</div>
                  <p style="margin:0 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">참여 안내</p>
                  <div style="padding:18px;background-color:#F5F7FF;border-radius:8px;">
                    <p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">참여 방식: {{channel}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">{{participation}}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1E9;">&nbsp;</div></td>
              </tr>
              <tr>
                <td style="padding:24px 40px 32px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:14px;line-height:22px;color:#626476;">
                  <p style="margin:0 0 12px 0;">행사와 관련해 궁금한 점이 있다면 운영진에게 문의해 주세요.</p>
                  <p style="margin:0;color:#282A43;">감사합니다.<br>StudyClub 드림</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 법적 고지: 왜 이 메일을 받았는지 -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:12px;line-height:18px;color:#6C6D7F;">
            이 메일은 회원님이 신청하신 {{eventTitle}} 행사의 참가 확정을 안내하기 위해 발송되었습니다.<br>
            © StudyClub · <a href="https://studyclub.life" target="_blank" style="color:#6C6D7F;text-decoration:underline;">studyclub.life</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>',
NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'EVENT_REGISTRATION_CONFIRMED' AND CHANNEL = 'EMAIL');

INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, UPDATED_BY_ADMIN_ID, CREATED_AT, UPDATED_AT)
SELECT 'EVENT_REGISTRATION_DECLINED', 'EMAIL', '[StudyClub] {{eventTitle}} 참가 결과를 안내드립니다',
'<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>[StudyClub] {{eventTitle}} 참가 결과를 안내드립니다</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FF;">
<!-- 미리보기 문구: 받은편지함 목록에서 제목 옆에 보인다 -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7FF;">{{eventTitle}} 행사 신청 결과를 안내드립니다.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FF;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <!-- 워드마크 (이미지 차단 메일함에서도 보이도록 글자로) -->
        <tr>
          <td style="padding:0 8px 16px 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#282A43;letter-spacing:-0.2px;">
            StudyClub
          </td>
        </tr>
        <!-- 본문 카드 -->
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E2E1E9;border-radius:12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:4px;line-height:4px;font-size:0;background-color:#5267D8;border-radius:12px 12px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;font-weight:600;color:#5267D8;">참가 불가</p>
                  <h1 style="margin:0 0 20px 0;font-size:24px;line-height:34px;font-weight:700;color:#282A43;letter-spacing:-0.4px;">{{eventTitle}}</h1>
                  <p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#626476;">안녕하세요, {{nickname}}님.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px 28px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;color:#626476;overflow-wrap:anywhere;word-break:break-word;">
                  <div style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#282A43;">아쉽게도 이번 행사에는 함께하기 어렵게 되었습니다.<br>관심을 가지고 신청해 주셔서 감사드리며, 다음 행사에서 다시 만나 뵐 수 있기를 바랍니다.</div>
                  <p style="margin:0 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">신청 정보</p>
                  <div style="padding:18px;background-color:#F5F7FF;border-radius:8px;">
                    <p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">참여 방식: {{channel}}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1E9;">&nbsp;</div></td>
              </tr>
              <tr>
                <td style="padding:24px 40px 32px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:14px;line-height:22px;color:#626476;">
                  <p style="margin:0 0 12px 0;">행사와 관련해 궁금한 점이 있다면 운영진에게 문의해 주세요.</p>
                  <p style="margin:0;color:#282A43;">감사합니다.<br>StudyClub 드림</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 법적 고지: 왜 이 메일을 받았는지 -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:12px;line-height:18px;color:#6C6D7F;">
            이 메일은 회원님이 신청하신 {{eventTitle}} 행사의 참가 결과를 안내하기 위해 발송되었습니다.<br>
            © StudyClub · <a href="https://studyclub.life" target="_blank" style="color:#6C6D7F;text-decoration:underline;">studyclub.life</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>',
NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'EVENT_REGISTRATION_DECLINED' AND CHANNEL = 'EMAIL');

INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, UPDATED_BY_ADMIN_ID, CREATED_AT, UPDATED_AT)
SELECT 'EVENT_REGISTRATION_CANCELLED', 'EMAIL', '[StudyClub] {{eventTitle}} 신청이 취소되었습니다',
'<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>[StudyClub] {{eventTitle}} 신청이 취소되었습니다</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FF;">
<!-- 미리보기 문구: 받은편지함 목록에서 제목 옆에 보인다 -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7FF;">{{eventTitle}} 행사 신청이 취소되었습니다.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FF;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <!-- 워드마크 (이미지 차단 메일함에서도 보이도록 글자로) -->
        <tr>
          <td style="padding:0 8px 16px 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#282A43;letter-spacing:-0.2px;">
            StudyClub
          </td>
        </tr>
        <!-- 본문 카드 -->
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E2E1E9;border-radius:12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="height:4px;line-height:4px;font-size:0;background-color:#5267D8;border-radius:12px 12px 0 0;">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;">
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;font-weight:600;color:#5267D8;">신청 취소</p>
                  <h1 style="margin:0 0 20px 0;font-size:24px;line-height:34px;font-weight:700;color:#282A43;letter-spacing:-0.4px;">{{eventTitle}}</h1>
                  <p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#626476;">안녕하세요, {{nickname}}님.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px 28px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;color:#626476;overflow-wrap:anywhere;word-break:break-word;">
                  <div style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#282A43;"><strong>{{eventTitle}}</strong> 행사 신청이 취소되었습니다.<br>행사가 아직 모집 중이라면 행사 페이지에서 다시 신청할 수 있습니다.</div>
                  <p style="margin:0 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">취소된 신청 정보</p>
                  <div style="padding:18px;background-color:#F5F7FF;border-radius:8px;">
                    <p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">참여 방식: {{channel}}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1E9;">&nbsp;</div></td>
              </tr>
              <tr>
                <td style="padding:24px 40px 32px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:14px;line-height:22px;color:#626476;">
                  <p style="margin:0 0 12px 0;">행사와 관련해 궁금한 점이 있다면 운영진에게 문의해 주세요.</p>
                  <p style="margin:0;color:#282A43;">감사합니다.<br>StudyClub 드림</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 법적 고지: 왜 이 메일을 받았는지 -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:12px;line-height:18px;color:#6C6D7F;">
            이 메일은 회원님이 신청하신 {{eventTitle}} 행사의 신청 취소를 안내하기 위해 발송되었습니다.<br>
            © StudyClub · <a href="https://studyclub.life" target="_blank" style="color:#6C6D7F;text-decoration:underline;">studyclub.life</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>',
NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'EVENT_REGISTRATION_CANCELLED' AND CHANNEL = 'EMAIL');
