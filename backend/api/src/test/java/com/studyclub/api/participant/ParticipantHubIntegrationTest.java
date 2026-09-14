package com.studyclub.api.participant;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
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

/**
 * 참가자 허브는 이제 {@code @RequireOnboarding} 가드 대상이다 — 온보딩을 완료한 ACCOUNT가 DB에 실제로 있어야 통과한다. 예전에는 mock
 * 데이터만 보고 응답했기 때문에 임의 email로 JWT만 발급해도 충분했지만, 가드가 ACCOUNT 존재·완료 여부를 확인하므로 이 테스트가 그 계정을 먼저 시딩한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ParticipantHubIntegrationTest {

    // 목업 대상은 mock 의 MOCK_ACCOUNT_ID, 나머지는 이 테스트만 쓰는 고정 id
    private static final Long ANOTHER_ACCOUNT_ID = 1001L;
    private static final Long INCOMPLETE_ACCOUNT_ID = 1002L;

    @Autowired TestRestTemplate rest;

    @Autowired JwtService jwt;

    @Autowired AccountRepository accountRepository;

    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seedAccounts() {
        insertAccount(MockParticipantHubDataProvider.MOCK_ACCOUNT_ID, "member@example.com", true);
        insertAccount(ANOTHER_ACCOUNT_ID, "another@example.com", true);
        insertAccount(INCOMPLETE_ACCOUNT_ID, "onboarding-incomplete@example.com", false);
    }

    private void insertAccount(Long id, String email, boolean onboarded) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "hub_" + id,
                SystemRole.MEMBER.name(),
                onboarded ? "Asia/Seoul" : null,
                onboarded ? now : null,
                now,
                now);
    }

    @Test
    @DisplayName("성공 - 내 스터디 목록은 참여·신청·일정·북마크를 한 번에 준다")
    void returnsParticipantHub() {
        var response =
                rest.exchange(
                        "/api/me/studies",
                        HttpMethod.GET,
                        authenticatedRequest(MockParticipantHubDataProvider.MOCK_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsKeys(
                        "activeStudies",
                        "pastStudies",
                        "applications",
                        "upcomingMeetings",
                        "bookmarks");
    }

    @Test
    @DisplayName("성공 - 내 수강 상세는 출석률과 출석 타임라인을 같은 응답으로 준다")
    void returnsParticipantStudyDetail() {
        var response =
                rest.exchange(
                        "/api/me/study-cohorts/301",
                        HttpMethod.GET,
                        authenticatedRequest(MockParticipantHubDataProvider.MOCK_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("attendanceRate", 100);
        assertThat(response.getBody().get("attendance")).asList().hasSize(4);
    }

    @Test
    @DisplayName("성공 - 완료한 스터디의 출석률과 전체 출석 타임라인이 일치한다")
    void returnsConsistentCompletedStudyAttendance() {
        var response =
                rest.exchange(
                        "/api/me/study-cohorts/291",
                        HttpMethod.GET,
                        authenticatedRequest(MockParticipantHubDataProvider.MOCK_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("attendanceRate", 88);
        assertThat(response.getBody().get("attendance")).asList().hasSize(8);
    }

    @Test
    @DisplayName("실패 - 토큰 없이 내 스터디를 조회하면 본인 정보 보호를 위해 401을 준다")
    void rejectsUnauthenticatedRequest() {
        var response = rest.getForEntity("/api/me/studies", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 신청만 했거나 북마크한 스터디 상세는 참가자가 아니므로 403을 준다")
    void rejectsNonParticipant() {
        var response =
                rest.exchange(
                        "/api/me/study-cohorts/303",
                        HttpMethod.GET,
                        authenticatedRequest(MockParticipantHubDataProvider.MOCK_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 존재하지 않는 스터디 상세는 404를 준다")
    void rejectsUnknownStudy() {
        var response =
                rest.exchange(
                        "/api/me/study-cohorts/999",
                        HttpMethod.GET,
                        authenticatedRequest(MockParticipantHubDataProvider.MOCK_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("성공 - 목업 대상이 아닌 계정은 다른 참가자의 목록 대신 빈 목록을 받는다")
    void returnsEmptyOverviewForAnotherAccount() {
        var response =
                rest.exchange(
                        "/api/me/studies",
                        HttpMethod.GET,
                        authenticatedRequest(ANOTHER_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("activeStudies")).asList().isEmpty();
    }

    @Test
    @DisplayName("실패 - 다른 계정은 목업 참가자의 스터디 기수 상세를 볼 수 없어 403을 받는다")
    void rejectsAnotherAccountFromParticipantDetail() {
        var response =
                rest.exchange(
                        "/api/me/study-cohorts/301",
                        HttpMethod.GET,
                        authenticatedRequest(ANOTHER_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 온보딩 미완료 계정은 회원 전용 API 에서 403 ONBOARDING_REQUIRED 를 받는다")
    void rejectsAccountThatHasNotCompletedOnboarding() {
        var response =
                rest.exchange(
                        "/api/me/studies",
                        HttpMethod.GET,
                        authenticatedRequest(INCOMPLETE_ACCOUNT_ID),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "ONBOARDING_REQUIRED");
    }

    private HttpEntity<Void> authenticatedRequest(Long accountId) {

        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }
}
