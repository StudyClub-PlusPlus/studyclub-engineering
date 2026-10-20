package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class NotificationTemplateRendererTest {

    private final NotificationTemplateRenderer renderer = new NotificationTemplateRenderer();

    @Test
    @DisplayName("{{nickname}} 을 payload 값으로 치환한다")
    void render_replacesPlaceholder() {
        String result = renderer.render("안녕하세요, {{nickname}}님.", Map.of("nickname", "gildong"));

        assertThat(result).isEqualTo("안녕하세요, gildong님.");
    }

    @Test
    @DisplayName("payload 에 없는 플레이스홀더는 그대로 남는다")
    void render_leavesUnknownPlaceholderUntouched() {
        String result = renderer.render("{{unknown}} 안녕하세요", Map.of("nickname", "gildong"));

        assertThat(result).isEqualTo("{{unknown}} 안녕하세요");
    }

    @Test
    @DisplayName("payload 가 비어 있으면 원문 그대로")
    void render_emptyPayload_returnsOriginal() {
        String result = renderer.render("안녕하세요, {{nickname}}님.", Map.of());

        assertThat(result).isEqualTo("안녕하세요, {{nickname}}님.");
    }

    @Test
    @DisplayName("HTML 템플릿이면 값을 이스케이프한다 — 닉네임이 메일 안에서 태그·링크가 되지 않는다")
    void render_htmlTemplate_escapesValues() {
        String result =
                renderer.render(
                        "<p>안녕하세요, {{nickname}}님.</p>",
                        Map.of("nickname", "<a href=x>hi</a> & 'q\""));

        assertThat(result)
                .isEqualTo("<p>안녕하세요, &lt;a href=x&gt;hi&lt;/a&gt; &amp; &#39;q&quot;님.</p>");
    }

    @Test
    @DisplayName("텍스트 템플릿(제목 포함)은 값을 그대로 끼운다")
    void render_textTemplate_keepsValuesRaw() {
        String result = renderer.render("{{nickname}}님 환영", Map.of("nickname", "<b>&"));

        assertThat(result).isEqualTo("<b>&님 환영");
    }
}
