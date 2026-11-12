package com.studyclub.notification;

import com.studyclub.notification.mail.MailBody;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * {@code {{key}}} 플레이스홀더를 {@code payload} 값으로 치환한다. 변수 몇 개를 한 번 훑어 바꾸는 것뿐이라(웰컴메일 {@code nickname},
 * 반 공지 5개) 템플릿 엔진 라이브러리 없이 문자열 치환으로 충분하다 — 조건부 문구가 필요해지면 그때 라이브러리 도입을
 * 재검토한다(specs/notification/spec.md).
 *
 * <p>템플릿이 HTML 이면({@link MailBody#isHtml}) 값을 HTML 이스케이프해서 끼운다 — 닉네임은 문자 제한이 없어 {@code <a href=…>}
 * 가 메일 안에서 링크가 될 수 있다. 템플릿 원문은 운영자가 쓴 것이라 이스케이프하지 않는다.
 */
@Component
public class NotificationTemplateRenderer {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");

    /**
     * 템플릿을 <b>한 번만</b> 훑어 치환한다. 치환한 값 안에 {@code {{title}}} 같은 글이 들어 있어도 다시 치환하지 않는다 — 스터디 공지처럼 보내는
     * 사람이 쓴 글이 값으로 들어오면 순서대로 바꾸는 방식은 본문이 다른 자리를 덮어쓸 수 있다.
     */
    public String render(String template, Map<String, Object> payload) {
        boolean html = MailBody.isHtml(template);
        return PLACEHOLDER
                .matcher(template)
                .replaceAll(
                        match -> {
                            String key = match.group(1);
                            if (!payload.containsKey(key)) {
                                return Matcher.quoteReplacement(match.group());
                            }
                            String value = String.valueOf(payload.get(key));
                            return Matcher.quoteReplacement(html ? escape(value) : value);
                        });
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
