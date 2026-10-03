package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
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
import org.springframework.http.ResponseEntity;
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
                rest.postForEntity("/api/admin/studies", authenticated(ADMIN_ID, body), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation()).isNotNull();
        String path = response.getHeaders().getLocation().getPath();
        assertThat(path).startsWith("/api/admin/studies/");

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
                rest.postForEntity("/api/admin/studies", authenticated(ADMIN_ID, body), Void.class);

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
                rest.postForEntity("/api/admin/studies", authenticated(ADMIN_ID, body), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        var recruitment = recruitmentRepository.findFirstByStudyIdOrderByIdDesc(studyId);
        assertThat(recruitment).isPresent();
        assertThat(recruitment.get().getRecruitDeadlineAt()).isNull();
    }

    @Test
    @DisplayName("성공 - studyProgramId 를 지정하면 그 클럽 아래 새 기수가 생성된다")
    void adminCreatesStudyUnderExistingProgram() {
        StudyProgram program = saveProgram("클럽 시리즈", StudyKind.CLUB);
        Map<String, Object> body =
                Map.of(
                        "studyProgramId", program.getId(),
                        "title", "클럽 3기",
                        "oneLineSummary", "3기 모집",
                        "category", "SOFTWARE");

        var response =
                rest.postForEntity("/api/admin/studies", authenticated(ADMIN_ID, body), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        Long studyId = Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
        assertThat(studyRepository.findById(studyId))
                .isPresent()
                .hasValueSatisfying(s -> assertThat(s.getProgramId()).isEqualTo(program.getId()));
    }

    @Test
    @DisplayName("성공 - studyKind 를 주면 그 종류로 새 프로그램이 만들어진다 (기본은 STUDY)")
    void adminCreatesNewProgramWithKind() {
        Long clubStudyId = createdStudyId(bodyWith("studyKind", "CLUB", "클럽으로 등록"));
        Long defaultStudyId = createdStudyId(body("기본 종류"));

        assertThat(programOf(clubStudyId).getStudyKind()).isEqualTo(StudyKind.CLUB);
        // 종류를 안 보내면 STUDY 다 — 대부분의 프로그램이 이쪽이다
        assertThat(programOf(defaultStudyId).getStudyKind()).isEqualTo(StudyKind.STUDY);
    }

    @Test
    @DisplayName("실패 - 스터디 프로그램에는 새 기수를 붙일 수 없다 (기수가 1개다)")
    void rejectsNewCohortOnStudyProgram() {
        StudyProgram program = saveProgram("한 번 하는 스터디", StudyKind.STUDY);

        var response = createForError(bodyWith("studyProgramId", program.getId(), "2기"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat((String) response.getBody().get("errorMessage")).contains("studyProgramId");
    }

    @Test
    @DisplayName("실패 - 기존 프로그램에 종류를 함께 보내면 400 — 종류는 한 번 정하면 못 바꾼다")
    void rejectsKindWithExistingProgram() {
        StudyProgram program = saveProgram("클럽", StudyKind.CLUB);
        Map<String, Object> body = new HashMap<>(body("3기"));
        body.put("studyProgramId", program.getId());
        body.put("studyKind", "STUDY");

        var response = createForError(body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((String) response.getBody().get("errorMessage")).contains("studyKind");
    }

    @Test
    @DisplayName("실패 - 없는 프로그램이면 400")
    void rejectsMissingProgram() {
        var response = createForError(bodyWith("studyProgramId", 999_999L, "유령 기수"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat((String) response.getBody().get("errorMessage")).contains("studyProgramId");
    }

    // ── fixtures ─────────────────────────────────────────────────────────

    private StudyProgram saveProgram(String title, StudyKind kind) {
        return studyProgramRepository.save(
                StudyProgram.builder().title(title).studyKind(kind).build());
    }

    private StudyProgram programOf(Long studyId) {
        Long programId = studyRepository.findById(studyId).orElseThrow().getProgramId();
        return studyProgramRepository.findById(programId).orElseThrow();
    }

    private Map<String, Object> body(String title) {
        return Map.of("title", title, "oneLineSummary", "한 줄 소개", "category", "SOFTWARE");
    }

    private Map<String, Object> bodyWith(String key, Object value, String title) {
        Map<String, Object> body = new HashMap<>(body(title));
        body.put(key, value);
        return body;
    }

    private Long createdStudyId(Map<String, Object> body) {
        var response =
                rest.postForEntity("/api/admin/studies", authenticated(ADMIN_ID, body), Void.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String path = response.getHeaders().getLocation().getPath();
        return Long.parseLong(path.substring(path.lastIndexOf('/') + 1));
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> createForError(Map<String, Object> body) {
        return (ResponseEntity<Map<String, Object>>)
                (ResponseEntity<?>)
                        rest.postForEntity(
                                "/api/admin/studies", authenticated(ADMIN_ID, body), Map.class);
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
