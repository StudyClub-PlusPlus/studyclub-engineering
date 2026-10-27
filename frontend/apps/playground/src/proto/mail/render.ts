/** 태그로 시작하면 HTML 본문이다(서버 `MailBody.isHtml` 과 같은 규칙) — text/html + 텍스트 대체본으로 나간다. */
export const isHtml = (body: string) => /^\s*</.test(body);

const escapeHtml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** 알림 템플릿 팝업의 iframe 문서. 치환 변수는 원문 그대로 두고, 일반 텍스트의 줄바꿈을 유지한다. */
export function toPreviewDocument(body: string): string {
  if (isHtml(body)) return body;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"></head><body style="margin:24px;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(body)}</body></html>`;
}
