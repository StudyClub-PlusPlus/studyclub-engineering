/**
 * 메일 템플릿 미리보기 — 서버 렌더러(`NotificationTemplateRenderer`)와 **같은 규칙**으로 채운다.
 *
 * 서버는 payload 의 키마다 `{{key}}` 를 값(String.valueOf)으로 바꾸고, 모르는 플레이스홀더는 그대로 둔다.
 * HTML 템플릿이면 값을 HTML 이스케이프해서 끼운다(`& < > " '`). 텍스트 템플릿(제목 포함)은 그대로.
 * iframe 은 그래도 sandbox 로 스크립트를 막는다.
 */

export function renderTemplate(template: string, payload: Record<string, unknown>): string {
  const html = isHtml(template);
  let rendered = template;
  for (const [key, value] of Object.entries(payload)) {
    rendered = rendered.replaceAll(`{{${key}}}`, html ? escapeHtml(String(value)) : String(value));
  }
  return rendered;
}

/** 태그로 시작하면 HTML 본문이다(서버 `MailBody.isHtml` 과 같은 규칙) — text/html + 텍스트 대체본으로 나간다. */
export const isHtml = (body: string) => /^\s*</.test(body);

const escapeHtml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** iframe srcdoc 으로 넣을 문서. 텍스트 본문은 메일함처럼 줄바꿈만 지켜 보여 준다. */
export function toPreviewDocument(body: string): string {
  if (isHtml(body)) return body;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"></head><body style="margin:24px;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(body)}</body></html>`;
}
