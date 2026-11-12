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

    @Test
    @DisplayName("값 안에 들어 있는 {{키}} 는 다시 치환하지 않는다 — 공지 본문이 제목 자리를 덮어쓰지 못한다")
    void render_doesNotExpandPlaceholdersInsideValues() {
        String result =
                renderer.render(
                        "<h1>{{title}}</h1><p>{{body}}</p>",
                        Map.of("title", "안내", "body", "{{title}} 를 쓰면 안 된다"));

        assertThat(result).isEqualTo("<h1>안내</h1><p>{{title}} 를 쓰면 안 된다</p>");
    }

    @Test
    @DisplayName("값에 $ · 역슬래시가 있어도 그대로 들어간다")
    void render_valueWithRegexSpecialCharacters() {
        String result = renderer.render("{{body}}", Map.of("body", "가격 $1 \\ 끝"));

        assertThat(result).isEqualTo("가격 $1 \\ 끝");
    }

    @Test
    @DisplayName("공지 본문의 줄바꿈은 HTML 이스케이프 뒤에도 그대로 남는다 (시안의 white-space:pre-line 이 살린다)")
    void render_htmlTemplate_keepsNewlinesAndEscapesTags() {
        String result = renderer.render("<p>{{body}}</p>", Map.of("body", "첫 줄\n<b>둘째</b>"));

        assertThat(result).isEqualTo("<p>첫 줄\n&lt;b&gt;둘째&lt;/b&gt;</p>");
    }
}
