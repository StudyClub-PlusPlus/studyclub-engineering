const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** 표시 전용 문서. 저장할 본문은 건드리지 않는다. HTML 판별은 MailBody.isHtml과 같은 규칙이다. */
export function toPreviewDocument(body: string): string {
  if (/^\s*</.test(body)) return body;
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"></head><body style="margin:24px;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(body)}</body></html>`;
}
