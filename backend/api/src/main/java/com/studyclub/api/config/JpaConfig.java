package com.studyclub.api.config;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * {@code BaseEntity} 의 {@code @CreatedDate}/{@code @LastModifiedDate} 를 실제로 채우는 스위치.
 *
 * <p>이 한 줄이 없으면 <b>어노테이션은 그대로인데 값만 null 로 들어간다</b> — 컴파일도 통과하고 테스트도 엔티티만 보면 통과해서 배포 후에야 발견된다. 그래서
 * 슬라이스 테스트로 값이 채워지는지까지 검증한다 ({@code UserAuditingTest}).
 */
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "databaseDateTimeProvider")
public class JpaConfig {
    /** DATETIME(6)과 같은 정밀도로 기록하여 DB 반올림으로 기준일과 만료일이 어긋나지 않게 한다. */
    @Bean
    DateTimeProvider databaseDateTimeProvider() {
        return () -> Optional.of(Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
}
