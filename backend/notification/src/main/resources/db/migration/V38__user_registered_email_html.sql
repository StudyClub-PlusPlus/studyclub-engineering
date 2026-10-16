-- V38 — 웰컴메일(USER_REGISTERED · EMAIL) 본문을 HTML 시안으로 바꾼다 (docs/mail-templates/user-registered-email.html).
--   * 발송기는 본문이 태그로 시작하면 text/html + 태그를 걷은 text/plain 대체본을 함께 보낸다(SesMailClient · MailBody).
--   * {{nickname}} 은 렌더러가 HTML 이스케이프해서 끼운다(NotificationTemplateRenderer).
--   * 제목도 바꾼다 — 메일 제목 규칙 「[StudyClub++] 무엇」(docs/mail-templates/README.md §제목 규칙). 본문 약 5KB — TEXT(64KB) 안이다.
--   * stage 는 Flyway 가 꺼져 있어 이 파일이 돌지 않는다. 같은 내용을 손으로 한 번 넣는다(PR 본문의 stage SQL).
UPDATE NOTIFICATION_TEMPLATE
   SET BODY = '<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>[StudyClub++] 회원가입을 환영합니다</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F7FF;">
<!-- 미리보기 문구: 받은편지함 목록에서 제목 옆에 보인다 -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7FF;">{{nickname}}님, StudyClub++ 회원가입이 완료되었습니다.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F7FF;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <!-- 워드마크 (이미지 차단 메일함에서도 보이도록 글자로) -->
        <tr>
          <td style="padding:0 8px 16px 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:18px;line-height:24px;font-weight:700;color:#282A43;letter-spacing:-0.2px;">
            StudyClub<span style="color:#5267D8;">++</span>
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
                  <p style="margin:0 0 8px 0;font-size:13px;line-height:20px;font-weight:600;color:#5267D8;">회원가입 완료</p>
                  <h1 style="margin:0 0 20px 0;font-size:24px;line-height:34px;font-weight:700;color:#282A43;letter-spacing:-0.4px;">안녕하세요, {{nickname}}님.<br>가입을 환영합니다!</h1>
                  <p style="margin:0 0 28px 0;font-size:16px;line-height:26px;color:#626476;">StudyClub++ 회원가입이 완료되었습니다.</p>
                </td>
              </tr>
              <!-- 버튼: 표 셀에 배경을 칠해 이미지 없이도 버튼 모양이 유지된다 -->
              <tr>
                <td style="padding:0 40px 36px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="#5267D8" style="border-radius:8px;background-color:#5267D8;">
                        <a href="https://studyclub-plusplus.com" target="_blank" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:16px;line-height:20px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:8px;">StudyClub++ 바로가기</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 40px;"><div style="height:1px;line-height:1px;font-size:0;background-color:#E2E1E9;">&nbsp;</div></td>
              </tr>
              <tr>
                <td style="padding:24px 40px 32px 40px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:14px;line-height:22px;color:#626476;">
                  <p style="margin:0 0 12px 0;">직접 가입하지 않으셨거나 계정 관련 문의가 있다면 <a href="mailto:support@studyclub-plusplus.com" style="color:#5267D8;text-decoration:underline;">support@studyclub-plusplus.com</a>으로 연락해 주세요.</p>
                  <p style="margin:0;color:#282A43;">감사합니다.<br>StudyClub++ 드림</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- 법적 고지: 왜 이 메일을 받았는지 -->
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,''Apple SD Gothic Neo'',''Malgun Gothic'',''맑은 고딕'',''Noto Sans KR'',sans-serif;font-size:12px;line-height:18px;color:#6C6D7F;">
            이 메일은 회원님의 가입 요청에 따라 가입 완료 사실을 안내하기 위해 발송되었습니다.<br>
            © StudyClub++ · <a href="https://studyclub-plusplus.com" target="_blank" style="color:#6C6D7F;text-decoration:underline;">studyclub-plusplus.com</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>',
       SUBJECT = '[StudyClub++] 회원가입을 환영합니다',
       UPDATED_AT = UTC_TIMESTAMP(6)
 WHERE EVENT_TYPE = 'USER_REGISTERED'
   AND CHANNEL = 'EMAIL';
