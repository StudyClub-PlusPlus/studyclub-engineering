package com.studyclub.notification;

import com.studyclub.notification.mail.MailBody;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * {@code {{key}}} 플레이스홀더를 {@code payload} 값으로 치환한다. 변수가 {@code nickname} 하나뿐이라 템플릿 엔진 라이브러리 없이 문자열
 * 치환으로 충분하다 — 변수 여러 개·조건부 문구가 필요해지면 그때 라이브러리 도입을 재검토한다(specs/notification/spec.md).
 *
 * <p>템플릿이 HTML 이면({@link MailBody#isHtml}) 값을 HTML 이스케이프해서 끼운다 — 닉네임은 문자 제한이 없어 {@code <a href=…>}
 * 가 메일 안에서 링크가 될 수 있다. 템플릿 원문은 운영자가 쓴 것이라 이스케이프하지 않는다.
 */
@Component
public class NotificationTemplateRenderer {

    public String render(String template, Map<String, Object> payload) {
        boolean html = MailBody.isHtml(template);
        String rendered = template;
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            String value = String.valueOf(entry.getValue());
            rendered = rendered.replace("{{" + entry.getKey() + "}}", html ? escape(value) : value);
        }
        return rendered;
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
