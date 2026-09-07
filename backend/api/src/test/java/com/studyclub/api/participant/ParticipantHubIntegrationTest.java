package com.studyclub.api.participant;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import java.util.Map;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ParticipantHubIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JwtService jwt;

    @Test
    @DisplayName("성공 - 내 스터디 목록은 참여·신청·일정·북마크를 한 번에 준다")
    void returnsParticipantHub() {
        var response = rest.exchange("/api/me/studies", HttpMethod.GET, authenticatedRequest(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsKeys(
                "activeStudies", "pastStudies", "applications", "upcomingMeetings", "bookmarks");
    }

    @Test
    @DisplayName("성공 - 내 수강 상세는 출석률과 출석 타임라인을 같은 응답으로 준다")
    void returnsParticipantStudyDetail() {
        var response = rest.exchange("/api/me/study-cohorts/301", HttpMethod.GET, authenticatedRequest(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("attendanceRate", 100);
        assertThat(response.getBody().get("attendance")).asList().hasSize(4);
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
        var response = rest.exchange("/api/me/study-cohorts/303", HttpMethod.GET, authenticatedRequest(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 존재하지 않는 스터디 상세는 404를 준다")
    void rejectsUnknownStudy() {
        var response = rest.exchange("/api/me/study-cohorts/999", HttpMethod.GET, authenticatedRequest(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    private HttpEntity<Void> authenticatedRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess("1", "member@example.com"));
        return new HttpEntity<>(headers);
    }
}
