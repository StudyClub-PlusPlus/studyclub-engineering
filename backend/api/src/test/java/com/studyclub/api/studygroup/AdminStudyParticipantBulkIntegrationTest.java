package com.studyclub.api.studygroup;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
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
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
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
 * 역할 일괄 변경 ({@code PATCH /api/admin/studies/{studyId}/participants}) — specs/study-group/spec.md
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyParticipantBulkIntegrationTest {

    private static final Long ADMIN_ID = 8640L;
    private static final Long MEMBER_ID = 8641L;
    private static final Long CREW1_ID = 8642L;
    private static final Long CREW2_ID = 8643L;
    private static final Long WITHDRAWN_ID = 8644L;
    private static final long MISSING_ID = 999_999_994L;
    private static final String URL = "/api/admin/studies/{studyId}/participants";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;
    @Autowired StudyParticipantRepository studyParticipantRepo;

    private StudyProgram program;
    private Study study;
    private StudyGroup group;
    private StudyParticipant crew1;
    private StudyParticipant crew2;
    private StudyParticipant withdrawnCrew;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccountIfAbsent(ADMIN_ID, "벌크캡틴", "admin@bulk-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ID, "벌크비캡틴", "member@bulk-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW1_ID, "벌크크루1", "crew1@bulk-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW2_ID, "벌크크루2", "crew2@bulk-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(WITHDRAWN_ID, "벌크하차크루", "withdrawn@bulk-test.com", SystemRole.MEMBER);

        program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("벌크 프로그램").studyKind(StudyKind.STUDY).build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("벌크 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.ONGOING)
                                .createdBy(ADMIN_ID)
                                .build());
        group = studyGroupRepo.save(StudyGroup.create(study.getId(), "벌크반"));

        crew1 =
                studyParticipantRepo.save(
                        StudyParticipant.builder()
                                .accountId(CREW1_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(Instant.now())
                                .build());
        crew2 =
                studyParticipantRepo.save(
                        StudyParticipant.builder()
                                .accountId(CREW2_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(Instant.now())
                                .build());
        withdrawnCrew =
                studyParticipantRepo.save(
                        StudyParticipant.builder()
                                .accountId(WITHDRAWN_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.WITHDRAWN)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(Instant.now())
                                .build());
    }

    @AfterEach
    void tearDown() {
        studyParticipantRepo.deleteAll(List.of(crew1, crew2, withdrawnCrew));
        studyGroupRepo.delete(group);
        studyRepo.delete(study);
        studyProgramRepo.delete(program);
    }

    @Test
    @DisplayName("성공 - 단일 역할 변경")
    void singleRoleChange() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "participantRole",
                                                "LEADER"))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyParticipantRepo.findById(crew1.getId()).orElseThrow().getParticipantRole())
                .isEqualTo(ParticipantRole.LEADER);
    }

    @Test
    @DisplayName("성공 - 여러 참여자 동시 변경")
    void bulkRoleChange() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "participantRole",
                                                "LEADER"),
                                        Map.of(
                                                "participantId",
                                                crew2.getId(),
                                                "participantRole",
                                                "LEADER"))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyParticipantRepo.findById(crew1.getId()).orElseThrow().getParticipantRole())
                .isEqualTo(ParticipantRole.LEADER);
        assertThat(studyParticipantRepo.findById(crew2.getId()).orElseThrow().getParticipantRole())
                .isEqualTo(ParticipantRole.LEADER);
    }

    @Test
    @DisplayName("성공 - 같은 역할이면 200 그대로 (멱등)")
    void idempotent() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "participantRole",
                                                "MEMBER"))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyParticipantRepo.findById(crew1.getId()).orElseThrow().getParticipantRole())
                .isEqualTo(ParticipantRole.MEMBER);
    }

    @Test
    @DisplayName("실패 - WITHDRAWN 크루 → 409 PARTICIPANT_NOT_ACTIVE")
    void withdrawnParticipant() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                withdrawnCrew.getId(),
                                                "participantRole",
                                                "LEADER"))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "PARTICIPANT_NOT_ACTIVE");
    }

    @Test
    @DisplayName("실패 - 중복 participantId → 400 INVALID_INPUT")
    void duplicateParticipantId() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "participantRole",
                                                "LEADER"),
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "participantRole",
                                                "MEMBER"))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패 - changes 빈 배열 → 400 INVALID_INPUT")
    void emptyChanges() {
        var response = patch(Map.of("changes", List.of()), ADMIN_ID, study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패 - 없는 명부 행 → 404 NOT_FOUND")
    void missingParticipant() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                MISSING_ID,
                                                "participantRole",
                                                "LEADER"))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 없는 스터디 → 404 NOT_FOUND")
    void missingStudy() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "participantRole",
                                                "LEADER"))),
                        ADMIN_ID,
                        MISSING_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403, 토큰 없으면 401")
    void permission() {
        var body =
                Map.of(
                        "changes",
                        List.of(
                                Map.of(
                                        "participantId",
                                        crew1.getId(),
                                        "participantRole",
                                        "LEADER")));

        assertThat(patch(body, MEMBER_ID, study.getId()).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(patch(body, null, study.getId()).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> patch(Object body, Long accountId, Object studyId) {
        HttpHeaders headers = new HttpHeaders();
        if (accountId != null) {
            String email = accountRepository.findById(accountId).orElseThrow().getEmail();
            headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                URL, HttpMethod.PATCH, new HttpEntity<>(body, headers), Map.class, studyId);
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
