package com.studyclub.api.participant;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
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

/** 출석 저장 + 참여 중단 (specs/study-participant/spec.md 「테스트」). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ParticipantWithdrawalIntegrationTest {

    private static final Long OWNER_ID = 3101L; // 담당 캡틴 (STUDY.CREATED_BY)
    private static final Long OTHER_CAPTAIN_ID = 3102L; // 크루로 참여한 다른 캡틴
    private static final Long NAV_A_ID = 3103L;
    private static final Long CREW_1_ID = 3104L;
    private static final Long CREW_2_ID = 3105L;
    private static final Long CREW_B_ID = 3106L;
    private static final Long NAV_B_ID = 3107L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired WithdrawnEvents events;

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
    private StudyMeeting pastMeeting;
    private StudyMeeting futureMeeting;
    private StudyParticipant navA;
    private StudyParticipant crew1;
    private StudyParticipant crew2;
    private StudyParticipant otherCaptain;
    private StudyParticipant ownerRow;
    private StudyParticipant crewB;

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

        insertAccountIfAbsent(OWNER_ID, "담당캡틴", "owner@withdraw-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(
                OTHER_CAPTAIN_ID, "다른캡틴", "other@withdraw-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(NAV_A_ID, "네비A", "nav-a@withdraw-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_1_ID, "크루1", "crew1@withdraw-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_2_ID, "크루2", "crew2@withdraw-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_B_ID, "크루B", "crew-b@withdraw-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(NAV_B_ID, "네비B", "nav-b@withdraw-test.com", SystemRole.MEMBER);

        programId =
                studyProgramRepo
                        .save(
                                StudyProgram.builder()
                                        .title("중단 테스트 프로그램")
                                        .studyKind(StudyKind.STUDY)
                                        .build())
                        .getId();
        study = saveStudy(StudyStatus.ONGOING);

        groupA =
                studyGroupRepo.save(
                        new StudyGroup(study.getId(), "A반", Instant.now(), "Asia/Seoul", 10));
        groupB =
                studyGroupRepo.save(
                        new StudyGroup(study.getId(), "B반", Instant.now(), "Asia/Seoul", 10));

        navA = saveParticipant(NAV_A_ID, groupA, ParticipantRole.LEADER, ParticipantStatus.ACTIVE);
        crew1 =
                saveParticipant(
                        CREW_1_ID, groupA, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);
        crew2 =
                saveParticipant(
                        CREW_2_ID, groupA, ParticipantRole.MEMBER, ParticipantStatus.PAUSED);
        otherCaptain =
                saveParticipant(
                        OTHER_CAPTAIN_ID, groupA, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);
        ownerRow =
                saveParticipant(OWNER_ID, groupA, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);
        crewB =
                saveParticipant(
                        CREW_B_ID, groupB, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);
        saveParticipant(NAV_B_ID, groupB, ParticipantRole.LEADER, ParticipantStatus.ACTIVE);

        pastMeeting =
                new StudyMeeting(
                        groupA.getId(), Instant.now().minus(7, ChronoUnit.DAYS), null, null);
        pastMeeting.assignPresenters(crew1.getId(), null);
        pastMeeting = studyMeetingRepo.save(pastMeeting);
        futureMeeting =
                new StudyMeeting(
                        groupA.getId(), Instant.now().plus(7, ChronoUnit.DAYS), null, null);
        futureMeeting.assignPresenters(crew1.getId(), crew2.getId());
        futureMeeting = studyMeetingRepo.save(futureMeeting);
    }

    // ── 성공 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("같은 분반 네비게이터 — 출석 1건 + 중단 2건이 한 번에 반영되고 감사 로그 · 이벤트 · 발표자 정리가 된다")
    void navigatorSavesAttendanceAndWithdraws() {
        var response =
                post(
                        body(
                                groupA,
                                List.of(update(pastMeeting, crew1, "PRESENT")),
                                List.of(crew1.getId(), crew2.getId())),
                        NAV_A_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyAttendanceRepo.findAll()).hasSize(1);
        for (StudyParticipant p : List.of(crew1, crew2)) {
            StudyParticipant reloaded = studyParticipantRepo.findById(p.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(ParticipantStatus.WITHDRAWN);
            assertThat(reloaded.getLeftAt()).isNotNull();
        }

        List<AdminAuditLog> logs = auditLogRepo.findAll();
        assertThat(logs).hasSize(2);
        assertThat(logs)
                .allSatisfy(
                        log -> {
                            assertThat(log.getAction()).isEqualTo(AdminAuditAction.WITHDRAW);
                            assertThat(log.getActorAccountId()).isEqualTo(NAV_A_ID);
                        });
        assertThat(logs)
                .anySatisfy(
                        log -> {
                            assertThat(log.getTargetAccountId()).isEqualTo(CREW_2_ID);
                            assertThat(log.getBeforeValue()).isEqualTo("PAUSED");
                            assertThat(log.getAfterValue())
                                    .isEqualTo(String.valueOf(crew2.getId()));
                        });

        List<StudyParticipantWithdrawn> published = List.copyOf(events.received);
        assertThat(published).hasSize(2);
        assertThat(published)
                .allSatisfy(
                        e -> {
                            assertThat(e.studyId()).isEqualTo(study.getId());
                            assertThat(e.actorId()).isEqualTo(String.valueOf(NAV_A_ID));
                            assertThat(e.participantRole()).isEqualTo(ParticipantRole.MEMBER);
                        });

        StudyMeeting future = studyMeetingRepo.findById(futureMeeting.getId()).orElseThrow();
        assertThat(future.getPresenter1ParticipantId()).isNull();
        assertThat(future.getPresenter2ParticipantId()).isNull();
        StudyMeeting past = studyMeetingRepo.findById(pastMeeting.getId()).orElseThrow();
        assertThat(past.getPresenter1ParticipantId()).isEqualTo(crew1.getId());
    }

    @Test
    @DisplayName("담당 캡틴 — updates 없이 withdrawals 만, 다른 분반 행도 중단할 수 있다")
    void ownerCaptainWithdrawsOnly() {
        var response = post(body(groupA, List.of(), List.of(crewB.getId())), OWNER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(statusOf(crewB)).isEqualTo(ParticipantStatus.WITHDRAWN);
        assertThat(studyAttendanceRepo.findAll()).isEmpty();
    }

    @Test
    @DisplayName("withdrawals 를 보내지 않는 기존 호출 — 출석만 반영되고 명부는 그대로")
    void updatesOnlyKeepsRoster() {
        var response =
                post(body(groupA, List.of(update(pastMeeting, crew1, "LATE")), null), NAV_A_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(statusOf(crew1)).isEqualTo(ParticipantStatus.ACTIVE);
        assertThat(events.received).isEmpty();
    }

    @Test
    @DisplayName("멱등 — 이미 WITHDRAWN 인 행은 LEFT_AT 을 덮어쓰지 않고 감사 로그 · 이벤트도 남기지 않는다")
    void alreadyWithdrawnIsIdempotent() {
        Instant leftAt = Instant.now().minus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        crew1.markWithdrawn(leftAt);
        studyParticipantRepo.save(crew1);

        var response = post(body(groupA, List.of(), List.of(crew1.getId())), NAV_A_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyParticipantRepo.findById(crew1.getId()).orElseThrow().getLeftAt())
                .isEqualTo(leftAt);
        assertThat(auditLogRepo.findAll()).isEmpty();
        assertThat(events.received).isEmpty();
    }

    @Test
    @DisplayName("원자성 — 중단 한 건이 403 이면 같은 요청의 출석도 반영되지 않는다")
    void rejectedWithdrawalRollsBackAttendance() {
        var response =
                post(
                        body(
                                groupA,
                                List.of(update(pastMeeting, crew1, "PRESENT")),
                                List.of(crew2.getId(), navA.getId())),
                        OWNER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(studyAttendanceRepo.findAll()).isEmpty();
        assertThat(statusOf(crew2)).isEqualTo(ParticipantStatus.PAUSED);
    }

    // ── 실패 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("로그인 안 함 → 401")
    void unauthenticated() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var response =
                rest.exchange(
                        "/api/me/studies/{studyId}/attendances",
                        HttpMethod.POST,
                        new HttpEntity<>(body(groupA, List.of(), List.of(crew1.getId())), headers),
                        Map.class,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("updates · withdrawals 모두 비었음 → 400")
    void bothEmpty() {
        assertError(
                post(body(groupA, List.of(), List.of()), NAV_A_ID),
                HttpStatus.BAD_REQUEST,
                "INVALID_INPUT");
    }

    @Test
    @DisplayName("withdrawals 중복 → 400")
    void duplicateWithdrawals() {
        assertError(
                post(body(groupA, List.of(), List.of(crew1.getId(), crew1.getId())), NAV_A_ID),
                HttpStatus.BAD_REQUEST,
                "INVALID_INPUT");
    }

    @Test
    @DisplayName("나 자신 → 400 CANNOT_WITHDRAW_SELF")
    void cannotWithdrawSelf() {
        assertError(
                post(body(groupA, List.of(), List.of(navA.getId())), NAV_A_ID),
                HttpStatus.BAD_REQUEST,
                "CANNOT_WITHDRAW_SELF");
    }

    @Test
    @DisplayName("다른 분반 네비게이터 → 403")
    void otherGroupNavigator() {
        assertError(
                post(body(groupA, List.of(), List.of(crew1.getId())), NAV_B_ID),
                HttpStatus.FORBIDDEN,
                "FORBIDDEN");
    }

    @Test
    @DisplayName("네비게이터가 다른 분반의 행을 고름 → 403")
    void navigatorTargetsOtherGroupRow() {
        assertError(
                post(body(groupA, List.of(), List.of(crewB.getId())), NAV_A_ID),
                HttpStatus.FORBIDDEN,
                "FORBIDDEN");
    }

    @Test
    @DisplayName("크루로 참여한 다른 캡틴 → 403")
    void otherCaptainIsForbidden() {
        assertError(
                post(body(groupA, List.of(), List.of(crew1.getId())), OTHER_CAPTAIN_ID),
                HttpStatus.FORBIDDEN,
                "FORBIDDEN");
    }

    @Test
    @DisplayName("대상이 네비게이터 · 담당 캡틴의 명부 행 → 403")
    void targetIsStaff() {
        assertError(
                post(body(groupA, List.of(), List.of(ownerRow.getId())), NAV_A_ID),
                HttpStatus.FORBIDDEN,
                "FORBIDDEN");
    }

    @Test
    @DisplayName("다른 스터디의 명부 행 → 400")
    void rowOfAnotherStudy() {
        Study other = saveStudy(StudyStatus.ONGOING);
        StudyGroup otherGroup =
                studyGroupRepo.save(
                        new StudyGroup(other.getId(), "다른반", Instant.now(), "Asia/Seoul", 10));
        StudyParticipant stranger =
                saveParticipant(
                        CREW_1_ID, otherGroup, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);

        assertError(
                post(body(groupA, List.of(), List.of(stranger.getId())), NAV_A_ID),
                HttpStatus.BAD_REQUEST,
                "INVALID_INPUT");
    }

    @Test
    @DisplayName("탈퇴한 행 → 409 PARTICIPANT_NOT_ACTIVE")
    void deletedRow() {
        crew1.markDeletedDueToAccountDeletion(Instant.now());
        studyParticipantRepo.save(crew1);

        assertError(
                post(body(groupA, List.of(), List.of(crew1.getId())), NAV_A_ID),
                HttpStatus.CONFLICT,
                "PARTICIPANT_NOT_ACTIVE");
    }

    @Test
    @DisplayName("끝난 스터디 → 409 STUDY_ENDED")
    void endedStudy() {
        jdbcTemplate.update("UPDATE STUDY SET STATUS = 'ENDED' WHERE ID = ?", study.getId());

        assertError(
                post(body(groupA, List.of(), List.of(crew1.getId())), NAV_A_ID),
                HttpStatus.CONFLICT,
                "STUDY_ENDED");
    }

    /**
     * 요청은 서버 스레드에서 처리되므로 {@code @RecordApplicationEvents} 로는 못 잡는다. 커밋 뒤 구독자 하나를 붙여 실제 구독자와 같은 시점에
     * 받는다.
     */
    @TestConfiguration
    static class EventCapture {
        @Bean
        WithdrawnEvents withdrawnEvents() {
            return new WithdrawnEvents();
        }
    }

    static class WithdrawnEvents {
        final List<StudyParticipantWithdrawn> received = new CopyOnWriteArrayList<>();

        @TransactionalEventListener
        void on(StudyParticipantWithdrawn event) {
            received.add(event);
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Study saveStudy(StudyStatus status) {
        return studyRepo.save(
                Study.builder()
                        .programId(programId)
                        .title("중단 테스트 스터디")
                        .oneLineSummary("테스트용")
                        .category(StudyCategory.ALGORITHM)
                        .description("설명")
                        .status(status)
                        .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                        .createdBy(OWNER_ID)
                        .build());
    }

    private StudyParticipant saveParticipant(
            Long accountId, StudyGroup group, ParticipantRole role, ParticipantStatus status) {
        return studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(accountId)
                        .studyGroupId(group.getId())
                        .studyId(group.getStudyId())
                        .status(status)
                        .participantRole(role)
                        .joinedAt(Instant.now().minus(21, ChronoUnit.DAYS))
                        .build());
    }

    private ParticipantStatus statusOf(StudyParticipant participant) {
        return studyParticipantRepo.findById(participant.getId()).orElseThrow().getStatus();
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
    private ResponseEntity<Map> post(Object body, Long callerAccountId) {
        return rest.exchange(
                "/api/me/studies/{studyId}/attendances",
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
