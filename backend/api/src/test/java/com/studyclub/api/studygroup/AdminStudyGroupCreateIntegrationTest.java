package com.studyclub.api.studygroup;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
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
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/** 반 만들기 ({@code POST /api/admin/studies/{studyId}/groups}) — specs/study-group/spec.md */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyGroupCreateIntegrationTest {

    private static final Long ADMIN_ID = 8601L;
    private static final Long MEMBER_ID = 8602L;
    private static final long MISSING_STUDY_ID = 999_999_997L;
    private static final String URL = "/api/admin/studies/{studyId}/groups";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;
    @Autowired StudyMeetingRepository studyMeetingRepo;

    private Study study;

    @BeforeEach
    void setUp() {
        // 바디 있는 요청에 4xx 가 오면 레거시 클라이언트는 응답을 못 읽는다
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccountIfAbsent(ADMIN_ID, "반캡틴", "admin@group-create-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ID, "반크루", "member@group-create-test.com", SystemRole.MEMBER);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("반 프로그램").studyKind(StudyKind.STUDY).build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("반 만들기 테스트")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.DRAFT)
                                .createdBy(ADMIN_ID)
                                .build());
    }

    @Test
    @DisplayName("성공 - 제목만으로 반을 만든다. 201 + 저장된 이름, 스터디 시간은 비고 회차는 생기지 않는다")
    void createsGroupWithNameOnly() {
        var response = post(Map.of("name", "  미국 금요일반 "), ADMIN_ID, study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("name", "미국 금요일반");
        Long groupId = ((Number) response.getBody().get("groupId")).longValue();
        StudyGroup saved = studyGroupRepo.findById(groupId).orElseThrow();
        assertThat(saved.getStudyId()).isEqualTo(study.getId());
        assertThat(saved.getName()).isEqualTo("미국 금요일반");
        assertThat(saved.getStartAt()).isNull();
        assertThat(saved.getTimezone()).isNull();
        assertThat(studyMeetingRepo.findByStudyGroupIdOrderByScheduledAt(groupId)).isEmpty();
    }

    @Test
    @DisplayName("실패 - 이름이 공백뿐이거나 21자면 400 INVALID_INPUT")
    void invalidName() {
        var blank = post(Map.of("name", "   "), ADMIN_ID, study.getId());
        assertThat(blank.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(blank.getBody()).containsEntry("errorCode", "INVALID_INPUT");

        var tooLong = post(Map.of("name", "가".repeat(21)), ADMIN_ID, study.getId());
        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooLong.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(studyGroupRepo.findByStudyId(study.getId())).isEmpty();
    }

    @Test
    @DisplayName("실패 - 같은 스터디에 같은 이름(대소문자 무시)의 반이 있으면 409 CONFLICT")
    void duplicateName() {
        assertThat(post(Map.of("name", "A반"), ADMIN_ID, study.getId()).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);

        var response = post(Map.of("name", "a반"), ADMIN_ID, study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
        assertThat(studyGroupRepo.findByStudyId(study.getId())).hasSize(1);
    }

    @Test
    @DisplayName("실패 - 없는 스터디 → 404 NOT_FOUND")
    void missingStudy() {
        var response = post(Map.of("name", "A반"), ADMIN_ID, MISSING_STUDY_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403, 토큰이 없으면 401")
    void permission() {
        var member = post(Map.of("name", "A반"), MEMBER_ID, study.getId());
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(member.getBody()).containsEntry("errorCode", "FORBIDDEN");

        var anonymous = post(Map.of("name", "A반"), null, study.getId());
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(anonymous.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        assertThat(studyGroupRepo.findByStudyId(study.getId())).isEmpty();
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> post(Object body, Long accountId, Object studyId) {
        HttpHeaders headers = new HttpHeaders();
        if (accountId != null) {
            String email = accountRepository.findById(accountId).orElseThrow().getEmail();
            headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                URL, HttpMethod.POST, new HttpEntity<>(body, headers), Map.class, studyId);
    }

    private void insertAccountIfAbsent(Long id, String nickname, String email, SystemRole role) {
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
                nickname,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
