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
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 담당 캡틴 바꾸기 ({@code PATCH /api/admin/studies/{studyId}/owner-captain}) · 참여 명단의 {@code
 * ownerCaptain} · 캡틴 권한 해제의 {@code OWNS_STUDY} — specs/study-group/spec.md ·
 * specs/admin-users/spec.md
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyOwnerCaptainIntegrationTest {

    // auto_increment 충돌 방지 — Long.MAX_VALUE 근처의 값은 실제 시퀀스가 도달하지 않는다.
    private static final Long OWNER_ID = Long.MAX_VALUE - 1200;
    private static final Long OTHER_ADMIN_ID = Long.MAX_VALUE - 1201;
    private static final Long CREW_ID = Long.MAX_VALUE - 1202;
    private static final long MISSING_ID = 999_999_981L;
    private static final String URL = "/api/admin/studies/{studyId}/owner-captain";

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
    private Study endedStudy;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccount(OWNER_ID, "담당캡틴", "owner@owner-test.com", SystemRole.ADMIN);
        insertAccount(OTHER_ADMIN_ID, "다른캡틴", "other@owner-test.com", SystemRole.ADMIN);
        insertAccount(CREW_ID, "크루", "crew@owner-test.com", SystemRole.MEMBER);

        program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("담당 프로그램").studyKind(StudyKind.STUDY).build());
        study = studyRepo.save(study(StudyStatus.ONGOING));
        endedStudy = studyRepo.save(study(StudyStatus.ENDED));
        // 다른 캡틴은 크루로 참여했다 — 명부에 있어도 담당 캡틴은 아니다
        StudyGroup group = studyGroupRepo.save(StudyGroup.create(study.getId(), "가반"));
        studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(OTHER_ADMIN_ID)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now())
                        .build());
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update(
                "DELETE FROM ADMIN_AUDIT_LOG WHERE ACTOR_ACCOUNT_ID IN (?, ?)",
                OWNER_ID,
                OTHER_ADMIN_ID);
        for (Study s : List.of(study, endedStudy)) {
            jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID = ?", s.getId());
            jdbcTemplate.update("DELETE FROM STUDY_GROUP WHERE STUDY_ID = ?", s.getId());
            jdbcTemplate.update("DELETE FROM STUDY WHERE ID = ?", s.getId());
        }
        studyProgramRepo.delete(program);
        jdbcTemplate.update(
                "DELETE FROM ACCOUNT WHERE ID IN (?, ?, ?)", OWNER_ID, OTHER_ADMIN_ID, CREW_ID);
    }

    @Test
    @DisplayName("성공 - 다른 캡틴으로 바꾸면 명단의 ownerCaptain · captain 이 따라오고 감사 로그 OWNER_CAPTAIN 을 남긴다")
    @SuppressWarnings("unchecked")
    void changesOwner() {
        ResponseEntity<Map<String, Object>> response =
                patch(OTHER_ADMIN_ID, study.getId(), OTHER_ADMIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> owner = (Map<String, Object>) response.getBody().get("ownerCaptain");
        assertThat(((Number) owner.get("accountId")).longValue()).isEqualTo(OTHER_ADMIN_ID);
        assertThat(studyRepo.findById(study.getId()).orElseThrow().getOwnerCaptainId())
                .isEqualTo(OTHER_ADMIN_ID);
        // 등록자 기록은 그대로
        assertThat(studyRepo.findById(study.getId()).orElseThrow().getCreatedBy())
                .isEqualTo(OWNER_ID);

        Map<String, Object> list = list(OWNER_ID, study.getId());
        assertThat(
                        ((Number) ((Map<String, Object>) list.get("ownerCaptain")).get("accountId"))
                                .longValue())
                .isEqualTo(OTHER_ADMIN_ID);
        assertThat((List<Map<String, Object>>) list.get("participants"))
                .filteredOn(p -> Boolean.TRUE.equals(p.get("captain")))
                .extracting(p -> ((Number) p.get("accountId")).longValue())
                .containsExactly(OTHER_ADMIN_ID);

        Map<String, Object> audit =
                jdbcTemplate.queryForMap(
                        "SELECT TARGET_ACCOUNT_ID, BEFORE_VALUE, AFTER_VALUE FROM ADMIN_AUDIT_LOG"
                                + " WHERE ACTION = 'OWNER_CAPTAIN' AND ACTOR_ACCOUNT_ID = ?",
                        OTHER_ADMIN_ID);
        assertThat(((Number) audit.get("TARGET_ACCOUNT_ID")).longValue()).isEqualTo(OTHER_ADMIN_ID);
        assertThat(audit.get("BEFORE_VALUE")).isEqualTo(String.valueOf(OWNER_ID));
        assertThat(audit.get("AFTER_VALUE")).isEqualTo(String.valueOf(study.getId()));
    }

    @Test
    @DisplayName("성공 - 같은 사람이면 200 이고 감사 로그를 남기지 않는다")
    void sameOwnerIsNoop() {
        assertThat(patch(OWNER_ID, study.getId(), OWNER_ID).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(auditCount()).isZero();
    }

    @Test
    @DisplayName("실패 - 크루 계정은 담당 캡틴이 될 수 없다 (409 OWNER_CAPTAIN_NOT_ADMIN)")
    void rejectsCrew() {
        ResponseEntity<Map<String, Object>> response = patch(OWNER_ID, study.getId(), CREW_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("errorCode")).isEqualTo("OWNER_CAPTAIN_NOT_ADMIN");
        assertThat(studyRepo.findById(study.getId()).orElseThrow().getOwnerCaptainId())
                .isEqualTo(OWNER_ID);
    }

    @Test
    @DisplayName("실패 - 없는 스터디 · 없는 계정 404, accountId 누락 400, 크루 요청자 403")
    void errors() {
        assertThat(patch(OWNER_ID, MISSING_ID, OTHER_ADMIN_ID).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(patch(OWNER_ID, study.getId(), MISSING_ID).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(patch(OWNER_ID, study.getId(), null).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(patch(CREW_ID, study.getId(), OTHER_ADMIN_ID).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("권한 해제 - 진행 중인 스터디의 담당 캡틴은 크루로 내릴 수 없다 (409 OWNS_STUDY, 제목 포함)")
    void ownerOfOngoingStudyCannotBeDemoted() {
        ResponseEntity<Map<String, Object>> response = demote(OTHER_ADMIN_ID, OWNER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("errorCode")).isEqualTo("OWNS_STUDY");
        assertThat((String) response.getBody().get("errorMessage")).contains("담당 테스트 스터디");
        assertThat(accountRepository.findById(OWNER_ID).orElseThrow().getSystemRole())
                .isEqualTo(SystemRole.ADMIN);
    }

    @Test
    @DisplayName("권한 해제 - 담당을 넘기면 내릴 수 있고, 끝난 스터디의 담당 칸은 비워진다")
    void demoteAfterHandover() {
        patch(OWNER_ID, study.getId(), OTHER_ADMIN_ID);

        assertThat(demote(OTHER_ADMIN_ID, OWNER_ID).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accountRepository.findById(OWNER_ID).orElseThrow().getSystemRole())
                .isEqualTo(SystemRole.MEMBER);
        assertThat(studyRepo.findById(endedStudy.getId()).orElseThrow().getOwnerCaptainId())
                .isNull();
        assertThat(studyRepo.findById(study.getId()).orElseThrow().getOwnerCaptainId())
                .isEqualTo(OTHER_ADMIN_ID);
    }

    // ── 헬퍼 ─────────────────────────────────────────────────────────────────

    private Study study(StudyStatus status) {
        return Study.builder()
                .programId(program.getId())
                .title("담당 테스트 스터디 " + status.name())
                .oneLineSummary("테스트용")
                .category(StudyCategory.ALGORITHM)
                .description("설명")
                .status(status)
                .createdBy(OWNER_ID)
                .ownerCaptainId(OWNER_ID)
                .build();
    }

    private long auditCount() {
        Long count =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM ADMIN_AUDIT_LOG WHERE ACTION = 'OWNER_CAPTAIN'"
                                + " AND ACTOR_ACCOUNT_ID IN (?, ?)",
                        Long.class,
                        OWNER_ID,
                        OTHER_ADMIN_ID);
        return count == null ? 0 : count;
    }

    private HttpHeaders auth(Long accountId) {
        HttpHeaders headers = new HttpHeaders();
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        return headers;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ResponseEntity<Map<String, Object>> patch(
            Long actorId, Object studyId, Long accountId) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("accountId", accountId);
        ResponseEntity<Map> response =
                rest.exchange(
                        URL,
                        HttpMethod.PATCH,
                        new HttpEntity<>(body, auth(actorId)),
                        Map.class,
                        studyId);
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) response;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private Map<String, Object> list(Long actorId, Long studyId) {
        ResponseEntity<Map> response =
                rest.exchange(
                        "/api/admin/studies/{studyId}/participants",
                        HttpMethod.GET,
                        new HttpEntity<>(auth(actorId)),
                        Map.class,
                        studyId);
        return response.getBody();
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ResponseEntity<Map<String, Object>> demote(Long actorId, Long targetId) {
        ResponseEntity<Map> response =
                rest.exchange(
                        "/api/admin/users/{accountId}/system-role",
                        HttpMethod.PATCH,
                        new HttpEntity<>(Map.of("systemRole", "MEMBER"), auth(actorId)),
                        Map.class,
                        targetId);
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) response;
    }

    private void insertAccount(Long id, String nickname, String email, SystemRole role) {
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", id);
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
