package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.audit.AdminAuditAction;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.participant.StudyParticipantWithdrawn;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 백오피스 출석부 — {@code /api/admin/studies/{studyId}/attendances} 조회와 저장의 참여 중단
 * (specs/attendance/spec.md · specs/study-participant/spec.md 「백오피스 경로」, 2026-10-23 기획 결정).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminAttendanceIntegrationTest {

    private static final Long OWNER_ID = 3201L; // 담당 캡틴 (STUDY.CREATED_BY)
    private static final Long OTHER_CAPTAIN_ID = 3202L; // 담당이 아닌 캡틴
    private static final Long NAV_A_ID = 3203L;
    private static final Long CREW_1_ID = 3204L;
    private static final Long CREW_B_ID = 3205L;
    private static final Long NAV_B_ID = 3206L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired AdminWithdrawnEvents events;

    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;
    @Autowired StudyMeetingRepository studyMeetingRepo;
    @Autowired StudyParticipantRepository studyParticipantRepo;
    @Autowired StudyAttendanceRepository studyAttendanceRepo;
    @Autowired AdminAuditLogRepository auditLogRepo;

    private Long programId;
    private Study study;
    private StudyGroup groupA;
    private StudyGroup groupB;
    private StudyMeeting meeting;
    private StudyParticipant navA;
    private StudyParticipant crew1;
    private StudyParticipant crewB;
    private StudyParticipant navB;

    @BeforeEach
    void setUp() {
        events.received.clear();
        auditLogRepo.deleteAll();
        studyAttendanceRepo.deleteAll();
        studyParticipantRepo.deleteAll();
        studyMeetingRepo.deleteAll();
        studyGroupRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();

        insertAccountIfAbsent(OWNER_ID, "담당캡틴", "owner@admin-att-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(
                OTHER_CAPTAIN_ID, "다른캡틴", "other@admin-att-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(NAV_A_ID, "네비A", "nav-a@admin-att-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_1_ID, "크루1", "crew1@admin-att-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_B_ID, "크루B", "crew-b@admin-att-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(NAV_B_ID, "네비B", "nav-b@admin-att-test.com", SystemRole.MEMBER);

        programId =
                studyProgramRepo
                        .save(
                                StudyProgram.builder()
                                        .title("백오피스 출석 테스트 프로그램")
                                        .studyKind(StudyKind.STUDY)
                                        .build())
                        .getId();
        study = saveStudy();

        groupA =
                studyGroupRepo.save(
                        new StudyGroup(study.getId(), "A반", Instant.now(), "Asia/Seoul", 10));
        groupB =
                studyGroupRepo.save(
                        new StudyGroup(study.getId(), "B반", Instant.now(), "Asia/Seoul", 10));

        navA = saveParticipant(NAV_A_ID, groupA, ParticipantRole.LEADER);
        crew1 = saveParticipant(CREW_1_ID, groupA, ParticipantRole.MEMBER);
        crewB = saveParticipant(CREW_B_ID, groupB, ParticipantRole.MEMBER);
        navB = saveParticipant(NAV_B_ID, groupB, ParticipantRole.LEADER);

        meeting =
                studyMeetingRepo.save(
                        new StudyMeeting(
                                groupA.getId(),
                                Instant.now().minus(7, ChronoUnit.DAYS),
                                null,
                                null));
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(CREW_1_ID)
                        .studyId(study.getId())
                        .studyGroupId(groupA.getId())
                        .studyMeetingId(meeting.getId())
                        .status(AttendanceStatus.PRESENT)
                        .build());
    }

    // ── 조회 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("조회 성공 - 캡틴은 참여하지 않은 분반의 명부도 본다")
    void captainGetsRoster() {
        var response = get(groupA.getId(), OTHER_CAPTAIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> summary = (Map<?, ?>) response.getBody().get("study");
        assertThat(summary.get("participantCount")).isEqualTo(2);
        assertThat(summary.get("totalMeetings")).isEqualTo(1);
        List<?> participants = (List<?>) response.getBody().get("participants");
        assertThat(participants).hasSize(2);
        Map<?, ?> row = findParticipant(participants, crew1.getId());
        assertThat(row.get("participantRole")).isEqualTo("MEMBER");
        assertThat(((Map<?, ?>) ((List<?>) row.get("attendances")).get(0)).get("status"))
                .isEqualTo("PRESENT");
    }

    @Test
    @DisplayName("조회 실패 - 로그인 안 함 → 401")
    void getUnauthenticated() {
        var response =
                rest.exchange(
                        "/api/admin/studies/{studyId}/attendances?studyGroupId={groupId}",
                        HttpMethod.GET,
                        HttpEntity.EMPTY,
                        Map.class,
                        study.getId(),
                        groupA.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("조회 실패 - 캡틴이 아니면 그 분반 네비게이터도 403")
    void getNavigatorForbidden() {
        assertError(get(groupA.getId(), NAV_A_ID), HttpStatus.FORBIDDEN, "FORBIDDEN");
    }

    @Test
    @DisplayName("조회 실패 - 없는 분반 → 404")
    void getUnknownGroup() {
        assertError(get(999_999L, OWNER_ID), HttpStatus.NOT_FOUND, "NOT_FOUND");
    }

    @Test
    @DisplayName("조회 실패 - 다른 스터디의 분반 → 400")
    void getGroupOfAnotherStudy() {
        Study other = saveStudy();
        StudyGroup otherGroup =
                studyGroupRepo.save(
                        new StudyGroup(other.getId(), "다른반", Instant.now(), "Asia/Seoul", 10));

        assertError(get(otherGroup.getId(), OWNER_ID), HttpStatus.BAD_REQUEST, "INVALID_INPUT");
    }

    // ── 저장 + 참여 중단 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("담당 캡틴 - 크루 · 네비게이터를 한 번에 중단하고, 다른 분반 행도 된다. 감사 로그 · 이벤트가 남는다")
    void ownerWithdrawsCrewAndNavigator() {
        var response =
                post(
                        body(
                                groupA,
                                List.of(update(meeting, crew1, "LATE")),
                                List.of(crew1.getId(), navA.getId(), navB.getId())),
                        OWNER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyAttendanceRepo.findAll())
                .singleElement()
                .satisfies(a -> assertThat(a.getStatus()).isEqualTo(AttendanceStatus.LATE));
        for (StudyParticipant p : List.of(crew1, navA, navB)) {
            StudyParticipant reloaded = studyParticipantRepo.findById(p.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(ParticipantStatus.WITHDRAWN);
            assertThat(reloaded.getLeftAt()).isNotNull();
        }

        List<AdminAuditLog> logs = auditLogRepo.findAll();
        assertThat(logs).hasSize(3);
        assertThat(logs)
                .allSatisfy(
                        log -> {
                            assertThat(log.getAction()).isEqualTo(AdminAuditAction.WITHDRAW);
                            assertThat(log.getActorAccountId()).isEqualTo(OWNER_ID);
                        });

        List<StudyParticipantWithdrawn> published = List.copyOf(events.received);
        assertThat(published).hasSize(3);
        assertThat(published)
                .filteredOn(e -> e.participantRole() == ParticipantRole.LEADER)
                .hasSize(2);
    }

    @Test
    @DisplayName("STUDY.CREATED_BY 가 NULL 이면 캡틴 누구나 담당 — 네비게이터를 중단한다")
    void anyCaptainWhenCreatedByNull() {
        jdbcTemplate.update("UPDATE STUDY SET CREATED_BY = NULL WHERE ID = ?", study.getId());

        var response = post(body(groupA, List.of(), List.of(navA.getId())), OTHER_CAPTAIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(statusOf(navA)).isEqualTo(ParticipantStatus.WITHDRAWN);
    }

    @Test
    @DisplayName("담당이 아닌 캡틴 - 출석만이면 204")
    void otherCaptainUpdatesOnly() {
        var response =
                post(
                        body(groupA, List.of(update(meeting, crew1, "ABSENT")), null),
                        OTHER_CAPTAIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyAttendanceRepo.findAll().get(0).getStatus())
                .isEqualTo(AttendanceStatus.ABSENT);
        assertThat(statusOf(crew1)).isEqualTo(ParticipantStatus.ACTIVE);
    }

    @Test
    @DisplayName("담당이 아닌 캡틴 - 중단이 있으면 403 이고 같은 요청의 출석도 반영되지 않는다")
    void otherCaptainWithdrawalForbidden() {
        var response =
                post(
                        body(
                                groupA,
                                List.of(update(meeting, crew1, "ABSENT")),
                                List.of(crew1.getId())),
                        OTHER_CAPTAIN_ID);

        assertError(response, HttpStatus.FORBIDDEN, "FORBIDDEN");
        assertThat(studyAttendanceRepo.findAll().get(0).getStatus())
                .isEqualTo(AttendanceStatus.PRESENT);
        assertThat(statusOf(crew1)).isEqualTo(ParticipantStatus.ACTIVE);
        assertThat(auditLogRepo.findAll()).isEmpty();
    }

    @Test
    @DisplayName("담당 캡틴 - 자기 명부 행 → 400 CANNOT_WITHDRAW_SELF")
    void ownerCannotWithdrawSelf() {
        StudyParticipant ownerRow = saveParticipant(OWNER_ID, groupA, ParticipantRole.MEMBER);

        assertError(
                post(body(groupA, List.of(), List.of(ownerRow.getId())), OWNER_ID),
                HttpStatus.BAD_REQUEST,
                "CANNOT_WITHDRAW_SELF");
    }

    @Test
    @DisplayName("탈퇴한 행 → 409 PARTICIPANT_NOT_ACTIVE")
    void deletedRow() {
        navA.markDeletedDueToAccountDeletion(Instant.now());
        studyParticipantRepo.save(navA);

        assertError(
                post(body(groupA, List.of(), List.of(navA.getId())), OWNER_ID),
                HttpStatus.CONFLICT,
                "PARTICIPANT_NOT_ACTIVE");
    }

    @Test
    @DisplayName("끝난 스터디 → 409 STUDY_ENDED")
    void endedStudy() {
        jdbcTemplate.update("UPDATE STUDY SET STATUS = 'ENDED' WHERE ID = ?", study.getId());

        assertError(
                post(body(groupA, List.of(), List.of(crew1.getId())), OWNER_ID),
                HttpStatus.CONFLICT,
                "STUDY_ENDED");
    }

    @Test
    @DisplayName("다른 스터디의 명부 행 → 400")
    void rowOfAnotherStudy() {
        Study other = saveStudy();
        StudyGroup otherGroup =
                studyGroupRepo.save(
                        new StudyGroup(other.getId(), "다른반", Instant.now(), "Asia/Seoul", 10));
        StudyParticipant stranger = saveParticipant(CREW_1_ID, otherGroup, ParticipantRole.MEMBER);

        assertError(
                post(body(groupA, List.of(), List.of(stranger.getId())), OWNER_ID),
                HttpStatus.BAD_REQUEST,
                "INVALID_INPUT");
    }

    @Test
    @DisplayName("사용자 사이트 경로는 그대로 - 담당 캡틴도 네비게이터는 중단하지 못한다 → 403")
    void sitePathStillForbidsNavigatorTarget() {
        var response =
                rest.exchange(
                        "/api/me/studies/{studyId}/attendances",
                        HttpMethod.POST,
                        authenticatedRequest(
                                body(groupA, List.of(), List.of(navA.getId())), OWNER_ID),
                        Map.class,
                        study.getId());

        assertError(response, HttpStatus.FORBIDDEN, "FORBIDDEN");
        assertThat(statusOf(navA)).isEqualTo(ParticipantStatus.ACTIVE);
    }

    /** 요청은 서버 스레드에서 처리되므로 커밋 뒤 구독자 하나를 붙여 실제 구독자와 같은 시점에 받는다. */
    @TestConfiguration
    static class EventCapture {
        @Bean
        AdminWithdrawnEvents adminWithdrawnEvents() {
            return new AdminWithdrawnEvents();
        }
    }

    static class AdminWithdrawnEvents {
        final List<StudyParticipantWithdrawn> received = new CopyOnWriteArrayList<>();

        @TransactionalEventListener
        void on(StudyParticipantWithdrawn event) {
            received.add(event);
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Study saveStudy() {
        return studyRepo.save(
                Study.builder()
                        .programId(programId)
                        .title("백오피스 출석 테스트 스터디")
                        .oneLineSummary("테스트용")
                        .category(StudyCategory.ALGORITHM)
                        .description("설명")
                        .status(StudyStatus.ONGOING)
                        .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                        .createdBy(OWNER_ID)
                        .build());
    }

    private StudyParticipant saveParticipant(
            Long accountId, StudyGroup group, ParticipantRole role) {
        return studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(accountId)
                        .studyGroupId(group.getId())
                        .studyId(group.getStudyId())
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(role)
                        .joinedAt(Instant.now().minus(21, ChronoUnit.DAYS))
                        .build());
    }

    private ParticipantStatus statusOf(StudyParticipant participant) {
        return studyParticipantRepo.findById(participant.getId()).orElseThrow().getStatus();
    }

    private static Map<?, ?> findParticipant(List<?> participants, Long participantId) {
        return participants.stream()
                .map(p -> (Map<?, ?>) p)
                .filter(
                        p ->
                                participantId.intValue()
                                        == ((Number) p.get("participantId")).intValue())
                .findFirst()
                .orElseThrow();
    }

    private static Map<String, Object> update(
            StudyMeeting meeting, StudyParticipant p, String status) {
        return Map.of("meetingId", meeting.getId(), "participantId", p.getId(), "status", status);
    }

    private static Map<String, Object> body(
            StudyGroup group, List<Map<String, Object>> updates, List<Long> withdrawals) {
        Map<String, Object> body = new HashMap<>();
        body.put("studyGroupId", group.getId());
        body.put("updates", updates);
        if (withdrawals != null) {
            body.put("withdrawals", withdrawals);
        }
        return body;
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> get(Long groupId, Long callerAccountId) {
        return rest.exchange(
                "/api/admin/studies/{studyId}/attendances?studyGroupId={groupId}",
                HttpMethod.GET,
                authenticatedRequest(null, callerAccountId),
                Map.class,
                study.getId(),
                groupId);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> post(Object body, Long callerAccountId) {
        return rest.exchange(
                "/api/admin/studies/{studyId}/attendances",
                HttpMethod.POST,
                authenticatedRequest(body, callerAccountId),
                Map.class,
                study.getId());
    }

    @SuppressWarnings("rawtypes")
    private static void assertError(
            ResponseEntity<Map> response, HttpStatus status, String errorCode) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody()).containsEntry("errorCode", errorCode);
    }

    private HttpEntity<Object> authenticatedRequest(Object body, Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
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
