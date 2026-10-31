package com.studyclub.notification;

import static org.assertj.core.api.Assertions.*;

import java.io.IOException;
import java.util.HashMap;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

class FeedbackReplyLinkConfigurationTest {
    @ParameterizedTest
    @CsvSource({
        ", , http://localhost:4700",
        "local, , http://localhost:4700",
        "stage, , https://stage.studyclub.life",
        "production, , https://studyclub.life",
        "stage, https://preview.example.com, https://preview.example.com",
        "preview, https://preview.example.com, https://preview.example.com"
    })
    @DisplayName("실제 YAML 설정은 환경별 사이트를 선택하고 명시한 주소를 우선한다")
    void resolvesSiteOrigin(String appEnv, String override, String expected) throws IOException {
        var environment = new StandardEnvironment();
        var sources = environment.getPropertySources();
        sources.remove(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME);
        sources.remove(StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME);
        var overrides = new HashMap<String, Object>();
        if (appEnv != null) {
            overrides.put("APP_ENV", appEnv);
        }
        if (override != null) {
            overrides.put("NOTIFICATION_SITE_BASE_URL", override);
        }
        sources.addFirst(new MapPropertySource("test-overrides", overrides));
        for (var source :
                new YamlPropertySourceLoader()
                        .load("notification", new ClassPathResource("notification.yml"))) {
            sources.addLast(source);
        }
        var link =
                new FeedbackReplyLink(
                        environment.getRequiredProperty("notification.site-base-url"));
        assertThat(link.forFeedback(42L)).isEqualTo(expected + "/ko/my/feedbacks/42");
    }
}
