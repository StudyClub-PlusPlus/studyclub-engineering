package com.studyclub.notification;

import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * {@code {{key}}} 플레이스홀더를 {@code payload} 값으로 치환한다. 변수가 {@code nickname} 하나뿐이라 템플릿 엔진 라이브러리 없이 문자열
 * 치환으로 충분하다 — 변수 여러 개·조건부 문구가 필요해지면 그때 라이브러리 도입을 재검토한다(specs/notification/spec.md).
 */
@Component
public class NotificationTemplateRenderer {

    public String render(String template, Map<String, Object> payload) {
        String rendered = template;
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            rendered =
                    rendered.replace(
                            "{{" + entry.getKey() + "}}", String.valueOf(entry.getValue()));
        }
        return rendered;
    }
}
