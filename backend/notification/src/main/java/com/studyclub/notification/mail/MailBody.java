package com.studyclub.notification.mail;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 메일 본문 판별·텍스트 대체본 생성. 템플릿 본문이 태그({@code <})로 시작하면 HTML 이다 — 별도 컬럼 없이 본문만 보고 정한다. 렌더러(값 이스케이프)와
 * 발송기(multipart)가 같은 규칙을 쓴다.
 *
 * <p>텍스트 대체본은 HTML 에서 태그를 걷어 만든다(운영자가 두 벌을 맞출 필요가 없다). 줄바꿈 태그·블록 끝은 줄바꿈으로, 링크는 {@code 글자 (주소)} 로
 * 남긴다. ponytail: 정규식 변환이라 표 정렬·목록 기호는 살리지 않는다 — 템플릿이 복잡해지면 jsoup 같은 파서로 교체.
 */
public final class MailBody {

    private static final Pattern LINK =
            Pattern.compile(
                    "<a\\b[^>]*?href\\s*=\\s*[\"']([^\"']*)[\"'][^>]*>(.*?)</a>",
                    Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern TAG = Pattern.compile("<[^>]*>", Pattern.DOTALL);
    private static final Pattern ENTITY =
            Pattern.compile("&(nbsp|lt|gt|quot|amp|#[xX][0-9a-fA-F]{1,6}|#\\d{1,7});");

    private MailBody() {}

    public static boolean isHtml(String body) {
        return body != null && body.stripLeading().startsWith("<");
    }

    public static String toPlainText(String html) {
        String s = html.replaceAll("(?s)<!--.*?-->", "");
        s = s.replaceAll("(?is)<(head|style|script)\\b.*?</\\1>", "");
        s = replaceLinks(s);
        s = s.replaceAll("(?i)<br\\s*/?>", "\n");
        s = s.replaceAll("(?i)</(p|div|h[1-6]|li|tr|table)>", "\n");
        s = unescape(TAG.matcher(s).replaceAll(""));

        StringBuilder out = new StringBuilder();
        boolean blank = true; // 맨 앞 빈 줄도 버린다
        for (String line : s.split("\n", -1)) {
            String trimmed = line.replaceAll("\\s+", " ").strip();
            if (trimmed.isEmpty()) {
                if (!blank) out.append('\n');
                blank = true;
            } else {
                out.append(trimmed).append('\n');
                blank = false;
            }
        }
        return out.toString().strip();
    }

    private static String replaceLinks(String s) {
        // 엔티티는 아직 풀지 않는다 — 마지막에 한 번만 푼다(이스케이프된 "<" 가 태그로 지워지지 않게).
        return LINK.matcher(s)
                .replaceAll(
                        m -> {
                            String url = m.group(1).strip();
                            String label = TAG.matcher(m.group(2)).replaceAll("").strip();
                            String text =
                                    label.isEmpty()
                                            ? url
                                            : url.equals(label) || url.equals("mailto:" + label)
                                                    ? label
                                                    : label + " (" + url + ")";
                            return Matcher.quoteReplacement(text);
                        });
    }

    private static String unescape(String s) {
        return ENTITY.matcher(s)
                .replaceAll(
                        m -> {
                            String e = m.group(1);
                            String c =
                                    switch (e) {
                                        case "nbsp" -> " ";
                                        case "lt" -> "<";
                                        case "gt" -> ">";
                                        case "quot" -> "\"";
                                        case "amp" -> "&";
                                        default ->
                                                Character.toString(
                                                        e.startsWith("#x") || e.startsWith("#X")
                                                                ? Integer.parseInt(
                                                                        e.substring(2), 16)
                                                                : Integer.parseInt(e.substring(1)));
                                    };
                            return Matcher.quoteReplacement(c);
                        });
    }
}
