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

/**
 * 반 이름 바꾸기 ({@code PATCH /api/admin/studies/{studyId}/groups/{groupId}}) —
 * specs/study-group/spec.md
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyGroupUpdateIntegrationTest {

    private static final Long ADMIN_ID = 8605L;
    private static final Long MEMBER_ID = 8606L;
    private static final long MISSING_ID = 999_999_995L;
    private static final String URL = "/api/admin/studies/{studyId}/groups/{groupId}";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;

    private Study study;
    private StudyGroup group;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccountIfAbsent(ADMIN_ID, "수정캡틴", "admin@group-update-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ID, "수정크루", "member@group-update-test.com", SystemRole.MEMBER);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("수정 프로그램").studyKind(StudyKind.STUDY).build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("반 수정 테스트")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.DRAFT)
                                .createdBy(ADMIN_ID)
                                .build());
        group = studyGroupRepo.save(StudyGroup.create(study.getId(), "원래반"));
    }

    @Test
    @DisplayName("성공 - 이름을 바꾼다. 앞뒤 공백을 잘라 저장한다")
    void updatesName() {
        var response = patch(Map.of("name", "  새이름  "), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("groupId", group.getId().intValue())
                .containsEntry("name", "새이름");
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("새이름");
    }

    @Test
    @DisplayName("성공 - 같은 이름(대소문자 포함)으로 보내면 중복 검사 없이 그대로 200")
    void sameNameIsAllowed() {
        var response = patch(Map.of("name", "원래반"), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("원래반");
    }

    @Test
    @DisplayName("실패 - 같은 스터디의 다른 반과 이름이 겹치면 409 CONFLICT")
    void duplicateNameWithOtherGroup() {
        studyGroupRepo.save(StudyGroup.create(study.getId(), "B반"));

        var response = patch(Map.of("name", "B반"), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("원래반");
    }

    @Test
    @DisplayName("실패 - 이름이 공백뿐이거나 21자면 400 INVALID_INPUT")
    void invalidName() {
        var blank = patch(Map.of("name", "   "), ADMIN_ID, study.getId(), group.getId());
        assertThat(blank.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(blank.getBody()).containsEntry("errorCode", "INVALID_INPUT");

        var tooLong = patch(Map.of("name", "가".repeat(21)), ADMIN_ID, study.getId(), group.getId());
        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooLong.getBody()).containsEntry("errorCode", "INVALID_INPUT");

        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("원래반");
    }

    @Test
    @DisplayName("실패 - 없는 반 → 404 NOT_FOUND")
    void missingGroup() {
        var response = patch(Map.of("name", "새이름"), ADMIN_ID, study.getId(), MISSING_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403, 토큰이 없으면 401")
    void permission() {
        var member = patch(Map.of("name", "새이름"), MEMBER_ID, study.getId(), group.getId());
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(member.getBody()).containsEntry("errorCode", "FORBIDDEN");

        var anonymous = patch(Map.of("name", "새이름"), null, study.getId(), group.getId());
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(anonymous.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> patch(Object body, Long accountId, Object studyId, Object groupId) {
        HttpHeaders headers = new HttpHeaders();
        if (accountId != null) {
            String email = accountRepository.findById(accountId).orElseThrow().getEmail();
            headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                URL,
                HttpMethod.PATCH,
                new HttpEntity<>(body, headers),
                Map.class,
                studyId,
                groupId);
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
