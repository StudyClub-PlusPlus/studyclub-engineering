package com.studyclub.notification.mail;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MailBodyTest {

    @Test
    @DisplayName("태그로 시작하면(앞 공백 무시) HTML 이다")
    void isHtml() {
        assertThat(MailBody.isHtml("  \n<!DOCTYPE html>")).isTrue();
        assertThat(MailBody.isHtml("안녕하세요 <b>")).isFalse();
        assertThat(MailBody.isHtml(null)).isFalse();
    }

    @Test
    @DisplayName("텍스트 대체본 — 줄바꿈을 지키고(빈 줄은 하나로) head·주석을 버리고 링크 주소를 남기고 엔티티를 푼다")
    void toPlainText() {
        String html =
                """
                <!DOCTYPE html><html><head><title>제목</title><style>p{}</style></head>
                <body><!-- 주석 -->
                <h1>안녕하세요, &lt;a href=x&gt;hi&lt;/a&gt;님.<br>환영합니다!</h1>
                <p>A&nbsp;&amp;&nbsp;B &#39;q&quot; &#x2764;</p>
                <a href="https://example.com" style="x">바로가기</a>
                <p>문의 <a href="mailto:help@example.com">help@example.com</a>으로</p>
                <td>&nbsp;</td>
                </body></html>
                """;

        assertThat(MailBody.toPlainText(html))
                .isEqualTo(
                        """
                        안녕하세요, <a href=x>hi</a>님.
                        환영합니다!

                        A & B 'q" ❤

                        바로가기 (https://example.com)
                        문의 help@example.com으로""");
    }

    @Test
    @DisplayName("실제 웰컴메일 시안의 대체본에 핵심 문구와 링크가 남는다")
    void welcomeTemplate() throws Exception {
        Path file =
                Path.of(
                        "../../frontend/apps/playground/src/proto/mail/templates/user-registered-email.html");
        String text = MailBody.toPlainText(Files.readString(file));

        assertThat(text)
                .contains("안녕하세요, {{nickname}}님.\n가입을 환영합니다!")
                .contains("StudyClub++ 바로가기 (https://studyclub-plusplus.com)")
                .contains("support@studyclub-plusplus.com으로 연락해 주세요.")
                .doesNotContain("<", "&nbsp;", "[StudyClub++] 회원가입을 환영합니다");
    }
}
