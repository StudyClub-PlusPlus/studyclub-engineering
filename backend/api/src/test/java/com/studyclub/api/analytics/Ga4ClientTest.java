package com.studyclub.api.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 실제 GA4 로는 보내지 않는다 — 페이로드만 단언한다. */
class Ga4ClientTest {

    @Test
    @DisplayName(
            "브라우저 client_id 와 회원 번호 user_id, engagement_time_msec 를 싣는다. 모양이 틀린 client_id 는 합성으로")
    void 페이로드() {
        Map<String, Object> body =
                Ga4Client.payload("sign_up", 42L, "123.456", Map.of("method", "google"));

        assertThat(body).containsEntry("client_id", "123.456").containsEntry("user_id", "42");
        @SuppressWarnings("unchecked")
        Map<String, Object> event = ((List<Map<String, Object>>) body.get("events")).get(0);
        assertThat(event).containsEntry("name", "sign_up");
        assertThat(event.get("params"))
                .isEqualTo(Map.of("method", "google", "engagement_time_msec", 1));

        assertThat(Ga4Client.payload("activated", 7L, null, Map.of()))
                .containsEntry("client_id", "srv.7");
        assertThat(Ga4Client.payload("sign_up", 7L, "GA1.1.x\"}", Map.of()))
                .containsEntry("client_id", "srv.7");
    }

    @Test
    @DisplayName("측정 ID·API 시크릿 중 하나라도 비면 보내지 않고, 엔드포인트가 죽어 있어도 던지지 않는다")
    void env가_비면_no_op() {
        assertThat(new Ga4Client("G-TEST", "", "http://127.0.0.1:1/x").enabled()).isFalse();
        assertThat(new Ga4Client("", "s", "http://127.0.0.1:1/x").enabled()).isFalse();
        assertThatCode(
                        () ->
                                new Ga4Client("G-TEST", "s", "http://127.0.0.1:1/x")
                                        .send("sign_up", 1L, null, Map.of()))
                .doesNotThrowAnyException();
    }
}
