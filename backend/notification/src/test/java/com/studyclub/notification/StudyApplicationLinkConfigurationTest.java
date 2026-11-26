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

class StudyApplicationLinkConfigurationTest {

    @ParameterizedTest
    @CsvSource({
        "http://localhost:4701",
        "https://back-office-stage.studyclub.life",
        "https://back-office.studyclub.life",
        "https://preview.example.com",
    })
    @DisplayName("NOTIFICATION_BACK_OFFICE_BASE_URL 을 그대로 쓴다 — APP_ENV 무관")
    void usesSiteBaseUrlDirectly(String siteBaseUrl) throws IOException {
        var link =
                new StudyApplicationLink(
                        resolve(Map.of("NOTIFICATION_BACK_OFFICE_BASE_URL", siteBaseUrl)));
        assertThat(link.forStudy(42L)).isEqualTo(siteBaseUrl + "/studies/42?tab=crew");
    }

    @Test
    @DisplayName("별도 메일 주소가 없으면 기존 로그인용 백오피스 주소를 재사용한다")
    void reusesBackOfficeLoginOrigin() throws IOException {
        var link =
                new StudyApplicationLink(
                        resolve(
                                Map.of(
                                        "auth.back-office-origins",
                                        "https://back-office-stage.studyclub.life")));
        assertThat(link.forStudy(42L))
                .isEqualTo("https://back-office-stage.studyclub.life/studies/42?tab=crew");
    }

    @Test
    @DisplayName("로그인용 주소가 여러 개면 메일용으로 명시한 대표 주소를 사용한다")
    void explicitMailOriginOverridesMultipleLoginOrigins() throws IOException {
        var link =
                new StudyApplicationLink(
                        resolve(
                                Map.of(
                                        "auth.back-office-origins",
                                                "https://one.example.com,https://two.example.com",
                                        "NOTIFICATION_BACK_OFFICE_BASE_URL",
                                                "https://one.example.com")));
        assertThat(link.forStudy(42L)).startsWith("https://one.example.com/");
    }

    @Test
    @DisplayName("메일 주소와 기존 로그인용 주소가 모두 없으면 프로퍼티 해석 실패")
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
        return environment.getRequiredProperty("notification.back-office-base-url");
    }
}
