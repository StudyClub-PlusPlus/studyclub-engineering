package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.notification.mail.MailProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.TestConfiguration;

class NotificationConfigurationTest {

    @TempDir Path directory;

    @Test
    @DisplayName("API가 모듈 설정을 가져오고 외부 local YAML이 덮어쓴다 — 실제 자격증명 주입 경로 보존")
    void importsModuleDefaultsAndOverridesWithLocalConfig() throws IOException {
        Path local = directory.resolve("application-local.yml");
        Files.writeString(
                local,
                """
                mail:
                  notify:
                    region: test-region
                    configuration-set-name: local-notify
                    from-address: gildong@example.com
                notification:
                  polling:
                    batch-size: 1
                """);

        try (var context =
                new SpringApplicationBuilder(PropertiesConfiguration.class)
                        .web(WebApplicationType.NONE)
                        .run(
                                "--spring.config.location=file:src/main/resources/application.yml",
                                "--spring.config.additional-location=" + local.toUri(),
                                "--spring.profiles.active=local",
                                "--spring.main.banner-mode=off")) {
            assertThat(
                            context.getEnvironment().getPropertySources().stream()
                                    .anyMatch(
                                            source ->
                                                    source.getName().contains("notification.yml")))
                    .isTrue();
            MailProperties.MailAccount account =
                    context.getBean(MailProperties.class).notifyAccount();
            assertThat(account.region()).isEqualTo("test-region");
            assertThat(account.configurationSetName()).isEqualTo("local-notify");
            assertThat(account.fromAddress()).isEqualTo("gildong@example.com");
            assertThat(context.getEnvironment().getProperty("notification.polling.batch-size"))
                    .isEqualTo("1");
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableConfigurationProperties(MailProperties.class)
    static class PropertiesConfiguration {}
}
