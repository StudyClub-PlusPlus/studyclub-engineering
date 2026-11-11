package com.studyclub.notification;

import static org.assertj.core.api.Assertions.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

class FeedbackReplyLinkConfigurationTest {

    @ParameterizedTest
    @CsvSource({
        "http://localhost:4700",
        "https://stage.studyclub.life",
        "https://studyclub.life",
        "https://preview.example.com",
    })
    @DisplayName("NOTIFICATION_SITE_BASE_URL 을 그대로 쓴다 — APP_ENV 무관")
    void usesSiteBaseUrlDirectly(String siteBaseUrl) throws IOException {
        var link =
                new FeedbackReplyLink(resolve(Map.of("NOTIFICATION_SITE_BASE_URL", siteBaseUrl)));
        assertThat(link.forFeedback(42L)).isEqualTo(siteBaseUrl + "/ko/my/feedbacks/42");
    }

    @Test
    @DisplayName("NOTIFICATION_SITE_BASE_URL 미설정이면 프로퍼티 해석 실패")
    void failsWhenNotSet() throws IOException {
        assertThatThrownBy(() -> resolve(Map.of())).isInstanceOf(Exception.class);
    }

    private String resolve(Map<String, Object> overrides) throws IOException {
        var environment = new StandardEnvironment();
        var sources = environment.getPropertySources();
        sources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        sources.remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        sources.addFirst(new MapPropertySource("test-overrides", new HashMap<>(overrides)));
        for (var source :
                new YamlPropertySourceLoader()
                        .load("notification", new ClassPathResource("notification.yml"))) {
            sources.addLast(source);
        }
        return environment.getRequiredProperty("notification.site-base-url");
    }
}
