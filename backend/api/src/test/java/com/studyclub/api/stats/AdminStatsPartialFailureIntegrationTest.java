package com.studyclub.api.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.studyclub.api.auth.JwtService;
import com.studyclub.api.stats.AdminStatsResponses.AttendanceComparison;
import com.studyclub.api.stats.DashboardSummaryAggregateService.AttendanceResult;
import com.studyclub.api.stats.DashboardSummaryAggregateService.ParticipationResult;
import com.studyclub.domain.account.AccountRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.UnexpectedRollbackException;

/** summary의 부분 성공 계약과 null/필드 생략 구분. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStatsPartialFailureIntegrationTest {

    private static final Long ADMIN_ID = 9721L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @MockitoBean DashboardSummaryAggregateService summaryAggregateService;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", ADMIN_ID);
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, 'ADMIN', 'UTC', ?, ?, ?)",
                ADMIN_ID,
                "admin-summary-partial@example.com",
                "summary_partial",
                now,
                now,
                now);

        when(summaryAggregateService.participation())
                .thenReturn(new ParticipationResult(0, 0, null));
        when(summaryAggregateService.communityMembers()).thenReturn(1L);
        when(summaryAggregateService.attendance(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(
                        new AttendanceResult(
                                null,
                                new AttendanceComparison(
                                        "2026-10-19", "2026-10-12", null, null, null)));
    }

    @Test
    @DisplayName("성공 - 대상 없음의 null은 필드로 반환한다")
    void successfulEmptyAggregateKeepsNullFields() {
        var response = getSummary();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body)
                .containsEntry("activeCrew", 0)
                .containsEntry("activeEnrollments", 0)
                .containsEntry("studiesPerCrew", null)
                .containsEntry("attendanceRate", null)
                .containsKey("attendanceComparison");
        assertThat(((Map<?, ?>) body.get("errors"))).isEmpty();
    }

    @Test
    @DisplayName("성공 - 출석 트랜잭션 rollback 실패에도 다른 묶음은 200으로 반환한다")
    void attendanceRollbackDoesNotDiscardSuccessfulAggregates() {
        when(summaryAggregateService.attendance(
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenThrow(new UnexpectedRollbackException("attendance rollback-only"));

        var response = getSummary();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body)
                .containsEntry("activeCrew", 0)
                .containsEntry("activeEnrollments", 0)
                .containsEntry("studiesPerCrew", null)
                .containsEntry("communityMembers", 1)
                .doesNotContainKeys("attendanceRate", "attendanceComparison");
        @SuppressWarnings("unchecked")
        Map<String, Object> errors = (Map<String, Object>) body.get("errors");
        assertThat(errors).containsKey("attendance");
    }

    private org.springframework.http.ResponseEntity<Map> getSummary() {
        return rest.exchange(
                "/api/admin/stats/summary?timeZone=UTC",
                HttpMethod.GET,
                authenticatedRequest(),
                Map.class);
    }

    private HttpEntity<Void> authenticatedRequest() {
        String email = accountRepository.findById(ADMIN_ID).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(ADMIN_ID), email));
        return new HttpEntity<>(headers);
    }
}
