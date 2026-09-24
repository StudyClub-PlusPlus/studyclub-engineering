package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyCreateIntegrationTest {

    private static final Long ADMIN_ID = 8001L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyRecruitmentRepository recruitmentRepository;
    @Autowired StudyProgramRepository studyProgramRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        Timestamp now = Timestamp.from(Instant.now());
        insertAccountIfAbsent(ADMIN_ID, "admin-create-study@example.test", SystemRole.ADMIN, now);
    }

    @Test
    @DisplayName("성공 - ADMIN 이 필수 항목만 채우면 201 + STUDY·STUDY_RECRUITMENT 행이 생성된다")
    void adminCreatesStudy() {
        Map<String, Object> body =
                Map.of(
                        "title", "AI 논문 스터디",
                        "oneLineSummary", "AI 논문을 함께 읽고 토론합니다.",
                        "category", "AI_ML");

        var response =
                rest.postForEntity("/api/studies", authenticated(ADMIN_ID, body), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation()).isNotNull();
        String path = response.getHeaders().getLocation().getPath();
        assertThat(path).startsWith("/api/studies/");

        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        var study = studyRepository.findById(studyId);
        assertThat(study).isPresent();
        assertThat(study.get().getTitle()).isEqualTo("AI 논문 스터디");
        assertThat(study.get().getCategory().name()).isEqualTo("AI_ML");
        assertThat(study.get().getStatus().name()).isEqualTo("DRAFT");
        assertThat(study.get().isHidden()).isFalse();

        var recruitment = recruitmentRepository.findFirstByStudyIdOrderByIdDesc(studyId);
        assertThat(recruitment).isPresent();
        assertThat(recruitment.get().getRecruitDeadlineAt()).isNull();
    }

    @Test
    @DisplayName("성공 - recruitDeadline 을 포함하면 STUDY_RECRUITMENT 에 저장된다")
    void adminCreatesStudyWithDeadline() {
        String futureDeadline = Instant.now().plusSeconds(86400).toString();
        Map<String, Object> body =
                Map.of(
                        "title", "백엔드 스터디",
                        "oneLineSummary", "백엔드 심화 학습",
                        "category", "SOFTWARE",
                        "recruitDeadline", futureDeadline);

        var response =
                rest.postForEntity("/api/studies", authenticated(ADMIN_ID, body), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        var recruitment = recruitmentRepository.findFirstByStudyIdOrderByIdDesc(studyId);
        assertThat(recruitment).isPresent();
        assertThat(recruitment.get().getRecruitDeadlineAt()).isNotNull();
    }

    @Test
    @DisplayName("성공 - recruitDeadline 없으면 STUDY_RECRUITMENT 행의 deadline 이 null 이다 (상시 모집)")
    void adminCreatesStudyWithoutDeadline() {
        Map<String, Object> body =
                Map.of(
                        "title", "오픈 스터디",
                        "oneLineSummary", "상시 모집 스터디",
                        "category", "ALGORITHM");

        var response =
                rest.postForEntity("/api/studies", authenticated(ADMIN_ID, body), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        var recruitment = recruitmentRepository.findFirstByStudyIdOrderByIdDesc(studyId);
        assertThat(recruitment).isPresent();
        assertThat(recruitment.get().getRecruitDeadlineAt()).isNull();
    }

    @Test
    @DisplayName("성공 - studyProgramId 를 지정하면 기존 프로그램 아래 스터디가 생성된다")
    void adminCreatesStudyUnderExistingProgram() {
        StudyProgram program =
                studyProgramRepository.save(StudyProgram.builder().title("클럽 시리즈").build());
        Map<String, Object> body =
                Map.of(
                        "studyProgramId", program.getId(),
                        "title", "클럽 3기",
                        "oneLineSummary", "3기 모집",
                        "category", "SOFTWARE");

        var response =
                rest.postForEntity("/api/studies", authenticated(ADMIN_ID, body), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        assertThat(studyRepository.findById(studyId))
                .isPresent()
                .hasValueSatisfying(s -> assertThat(s.getProgramId()).isEqualTo(program.getId()));
    }

    private HttpEntity<Map<String, Object>> authenticated(
            Long accountId, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(tokenFor(accountId));
        return new HttpEntity<>(body, headers);
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
                "create_study_" + id,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
