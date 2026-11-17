package com.studyclub.notification;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class FeedbackReplyLinkTest {
    @ParameterizedTest
    @ValueSource(strings = {"https://stage.studyclub.life", "https://stage.studyclub.life/"})
    @DisplayName("서버에 정한 환경의 내 문의 상세로 연결한다 — 끝 슬래시는 한 번만 붙인다")
    void buildsDetailLink(String origin) {
        assertThat(new FeedbackReplyLink(origin).forFeedback(42L))
                .isEqualTo("https://stage.studyclub.life/ko/my/feedbacks/42");
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "",
                "/relative",
                "javascript:alert(1)",
                "https://example.com/path",
                "https://user@example.com",
                "https://example.com?next=x",
                "https://example.com#x"
            })
    @DisplayName("사이트 주소 설정이 잘못되면 시작 때 막는다 — 잘못된 링크가 담긴 메일을 예약하지 않는다")
    void rejectsInvalidOrigin(String origin) {
        assertThatThrownBy(() -> new FeedbackReplyLink(origin))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
