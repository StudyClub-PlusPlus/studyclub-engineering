package com.studyclub.notification.webpush;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WebPushSubscriptionTest {

    @ParameterizedTest
    @ValueSource(
            strings = {
                "https://fcm.googleapis.com/fcm/send/abc",
                "https://updates.push.services.mozilla.com/wpush/v2/abc",
                "https://web.push.apple.com/abc",
                "https://wns2-par02p.notify.windows.com/w/?token=abc"
            })
    @DisplayName("브라우저 회사 푸시 서버 주소는 받는다")
    void acceptsKnownPushServices(String endpoint) {
        assertThat(WebPushSubscription.register(1L, endpoint, "k", "a").getEndpointHash())
                .hasSize(64);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "http://fcm.googleapis.com/x",
                "https://fcm.googleapis.com:8443/x",
                "https://evilfcm.googleapis.com.example.com/x",
                "https://localhost/x",
                "https://10.0.0.1/x",
                "not a url"
            })
    @DisplayName("그 밖의 주소는 거절한다 — 서버가 내부망으로 요청하지 않게")
    void rejectsOthers(String endpoint) {
        assertThatThrownBy(() -> WebPushSubscription.register(1L, endpoint, "k", "a"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
