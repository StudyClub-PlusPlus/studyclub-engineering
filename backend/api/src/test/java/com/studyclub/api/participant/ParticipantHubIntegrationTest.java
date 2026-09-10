package com.studyclub.api.participant;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
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

/**
 * 참가자 허브는 이제 {@code @RequireOnboarding} 가드 대상이다 — 온보딩을 완료한 ACCOUNT가
 * DB에 실제로 있어야 통과한다. 예전에는 mock 데이터만 보고 응답했기 때문에 임의 email로
 * JWT만 발급해도 충분했지만, 가드가 ACCOUNT 존재·완료 여부를 확인하므로 이 테스트가 그 계정을
 * 먼저 시딩한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ParticipantHubIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JwtService jwt;

    @Autowired
    AccountRepository accountRepository;

    @BeforeEach
    void seedOnboardedAccounts() {
        onboardedAccount("member@example.com");
        onboardedAccount("another@example.com");
    }

    private void onboardedAccount(String email) {
        accountRepository.findByEmail(email).orElseGet(() -> {
            String nickname = uniqueNickname();
            Account account = new Account(email, nickname, null, SystemRole.MEMBER);
            account.completeOnboarding(nickname, "Asia/Seoul", Instant.now());
            return accountRepository.save(account);
        });
    }

    private String uniqueNickname() {
        return "hub_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    @Test
    @DisplayName("성공 - 내 스터디 목록은 참여·신청·일정·북마크를 한 번에 준다")
    void returnsParticipantHub() {
        var response = rest.exchange(
                "/api/me/studies", HttpMethod.GET, authenticatedRequest("member@example.com"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsKeys(
                "activeStudies", "pastStudies", "applications", "upcomingMeetings", "bookmarks");
    }

    @Test
    @DisplayName("성공 - 내 수강 상세는 출석률과 출석 타임라인을 같은 응답으로 준다")
    void returnsParticipantStudyDetail() {
        var response = rest.exchange(
                "/api/me/study-cohorts/301", HttpMethod.GET,
                authenticatedRequest("member@example.com"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("attendanceRate", 100);
        assertThat(response.getBody().get("attendance")).asList().hasSize(4);
    }

    @Test
    @DisplayName("성공 - 완료한 스터디의 출석률과 전체 출석 타임라인이 일치한다")
    void returnsConsistentCompletedStudyAttendance() {
        var response = rest.exchange(
                "/api/me/study-cohorts/291", HttpMethod.GET,
                authenticatedRequest("member@example.com"), Map.class);

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
        var response = rest.exchange(
                "/api/me/study-cohorts/303", HttpMethod.GET,
                authenticatedRequest("member@example.com"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 존재하지 않는 스터디 상세는 404를 준다")
    void rejectsUnknownStudy() {
        var response = rest.exchange(
                "/api/me/study-cohorts/999", HttpMethod.GET,
                authenticatedRequest("member@example.com"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("성공 - 목업 대상이 아닌 계정은 다른 참가자의 목록 대신 빈 목록을 받는다")
    void returnsEmptyOverviewForAnotherAccount() {
        var response = rest.exchange(
                "/api/me/studies", HttpMethod.GET, authenticatedRequest("another@example.com"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("activeStudies")).asList().isEmpty();
    }

    @Test
    @DisplayName("실패 - 다른 계정은 목업 참가자의 스터디 기수 상세를 볼 수 없어 403을 받는다")
    void rejectsAnotherAccountFromParticipantDetail() {
        var response = rest.exchange(
                "/api/me/study-cohorts/301", HttpMethod.GET,
                authenticatedRequest("another@example.com"), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 온보딩 미완료 계정은 회원 전용 API 에서 403 ONBOARDING_REQUIRED 를 받는다")
    void rejectsAccountThatHasNotCompletedOnboarding() {
        String email = "onboarding-incomplete@example.com";
        accountRepository.findByEmail(email).orElseGet(() ->
                accountRepository.save(new Account(email, uniqueNickname(), null, SystemRole.MEMBER)));

        var response = rest.exchange(
                "/api/me/studies", HttpMethod.GET, authenticatedRequest(email), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "ONBOARDING_REQUIRED");
    }

    private HttpEntity<Void> authenticatedRequest(String email) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess("1", email));
        return new HttpEntity<>(headers);
    }
}
