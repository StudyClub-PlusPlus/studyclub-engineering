package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
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
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyDeleteIntegrationTest {

    private static final Long ADMIN_ID = 8020L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyRecruitmentRepository recruitmentRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-delete-study@example.test", SystemRole.ADMIN, now);
    }

    @Test
    @DisplayName("성공 - ADMIN 이 삭제하면 204 + STUDY 행이 사라진다")
    void adminDeletesStudy() {
        Long studyId = createStudy("삭제될 스터디", "소개", "CS");
        assertThat(studyRepository.existsById(studyId)).isTrue();

        var response =
                rest.exchange(
                        "/api/studies/" + studyId,
                        HttpMethod.DELETE,
                        authenticatedNoBody(ADMIN_ID),
                        Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyRepository.existsById(studyId)).isFalse();
    }

    @Test
    @DisplayName("성공 - 삭제 시 STUDY_RECRUITMENT 행도 함께 삭제된다")
    void deleteCascadesToRecruitment() {
        Long studyId = createStudy("케스케이드 스터디", "소개", "BACKEND");
        assertThat(recruitmentRepository.findByStudyId(studyId)).isNotEmpty();

        rest.exchange(
                "/api/studies/" + studyId,
                HttpMethod.DELETE,
                authenticatedNoBody(ADMIN_ID),
                Void.class);

        assertThat(recruitmentRepository.findByStudyId(studyId)).isEmpty();
    }

    private Long createStudy(String title, String oneLineSummary, String category) {
        Map<String, Object> body =
                Map.of("title", title, "oneLineSummary", oneLineSummary, "category", category);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(tokenFor(ADMIN_ID));
        var response =
                rest.postForEntity("/api/studies", new HttpEntity<>(body, headers), Void.class);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
    }

    private HttpEntity<Void> authenticatedNoBody(Long accountId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(tokenFor(accountId));
        return new HttpEntity<>(headers);
    }

    private String tokenFor(Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        return jwtService.issueAccess(String.valueOf(accountId), email);
    }

    private void insertAccountIfAbsent(Long id, String email, SystemRole role, Timestamp now) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                "delete_study_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
