package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.*;

import java.nio.file.Path;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** CI 전용 MySQL DB에서 실행한다. 평소 H2 테스트는 외부 DB 없이 그대로 돈다. */
@EnabledIfEnvironmentVariable(named = "MIGRATION_UPGRADE_DB_URL", matches = ".+")
class NotificationMigrationUpgradeIntegrationTest {
    @Test
    @DisplayName("운영 main의 DB에서 업데이트된다 — 기존 이력·문구를 보존하고 문의·복수 템플릿을 추가한다")
    void upgradesReleasedSchemaWithoutRewritingHistory() {
        var dataSource =
                new DriverManagerDataSource(
                        requiredEnv("MIGRATION_UPGRADE_DB_URL"),
                        requiredEnv("MIGRATION_UPGRADE_DB_USERNAME"),
                        requiredEnv("MIGRATION_UPGRADE_DB_PASSWORD"));
        Path baseline = Path.of(requiredEnv("MIGRATION_BASELINE_DIR"));
        Flyway released =
                Flyway.configure()
                        .dataSource(dataSource)
                        .locations(
                                "filesystem:"
                                        + baseline.resolve(
                                                "backend/domain/src/main/resources/db/migration"),
                                "filesystem:"
                                        + baseline.resolve(
                                                "backend/notification/src/main/resources/db/migration"))
                        .load();
        released.migrate();
        var jdbc = new JdbcTemplate(dataSource);
        var previousHistory =
                jdbc.queryForList(
                        "SELECT version, script, checksum FROM flyway_schema_history ORDER BY installed_rank");
        assertThat(previousHistory).isNotEmpty();
        String customSubject = "운영자가 수정한 환영 메일";
        assertThat(
                        jdbc.update(
                                "UPDATE NOTIFICATION_TEMPLATE SET SUBJECT = ? WHERE EVENT_TYPE = 'USER_REGISTERED'",
                                customSubject))
                .isPositive();

        // outOfOrder/ignoreMigrationPatterns로 검증을 우회하지 않는다. 운영과 같은 기본값이다.
        Flyway current =
                Flyway.configure()
                        .dataSource(dataSource)
                        .locations("classpath:db/migration")
                        .load();
        current.migrate();
        current.validate();
        assertThat(
                        jdbc.queryForList(
                                "SELECT version, script, checksum FROM flyway_schema_history ORDER BY installed_rank"))
                .containsAll(previousHistory);
        assertThat(
                        jdbc.queryForList(
                                "SELECT SUBJECT FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'USER_REGISTERED'",
                                String.class))
                .containsOnly(customSubject);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('FEEDBACK', 'FEEDBACK_IMAGE')",
                                Integer.class))
                .isEqualTo(2);

        // 기존 유일 제약이 실제로 사라져 같은 조건의 템플릿을 더 저장할 수 있어야 한다.
        jdbc.update(
                "INSERT INTO NOTIFICATION_TEMPLATE (EVENT_TYPE, CHANNEL, SUBJECT, BODY, CREATED_AT, UPDATED_AT) VALUES ('USER_REGISTERED', 'EMAIL', '추가 안내', '본문', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'FEEDBACK_REPLIED'",
                                Integer.class))
                .isEqualTo(1);
        jdbc.update(
                "UPDATE NOTIFICATION_TEMPLATE SET SUBJECT = ? WHERE EVENT_TYPE = 'FEEDBACK_REPLIED'",
                "운영자가 수정한 회신 메일");
        assertThat(current.migrate().migrationsExecuted).isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT SUBJECT FROM NOTIFICATION_TEMPLATE WHERE EVENT_TYPE = 'FEEDBACK_REPLIED'",
                                String.class))
                .isEqualTo("운영자가 수정한 회신 메일");
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required for the migration upgrade test");
        }
        return value;
    }
}
