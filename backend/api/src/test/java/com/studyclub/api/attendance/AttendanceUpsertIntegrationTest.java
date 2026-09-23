package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.DeliveryFormat;
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
import java.util.List;
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
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AttendanceUpsertIntegrationTest {

    private static final Long LEADER_ACCOUNT_ID = 3001L;
    private static final Long MEMBER_ACCOUNT_ID = 3002L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;
    @Autowired StudyMeetingRepository studyMeetingRepo;
    @Autowired StudyParticipantRepository studyParticipantRepo;
    @Autowired StudyAttendanceRepository studyAttendanceRepo;

    private Study study;
    private StudyMeeting meeting1;
    private StudyMeeting meeting2;
    private StudyParticipant participantA;
    private StudyParticipant participantB;

    @BeforeEach
    void setUp() {
        studyAttendanceRepo.deleteAll();
        studyParticipantRepo.deleteAll();
        studyMeetingRepo.deleteAll();
        studyGroupRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();

        insertAccountIfAbsent(LEADER_ACCOUNT_ID, "리더", "leader@upsert-test.com");
        insertAccountIfAbsent(MEMBER_ACCOUNT_ID, "멤버", "member@upsert-test.com");

        var program = studyProgramRepo.save(StudyProgram.builder().title("테스트 프로그램").build());

        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .slug("upsert-test-study")
                                .title("Upsert 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.CS)
                                .studyKind(StudyKind.STUDY)
                                .description("설명")
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.OPEN)
                                .capacity(10)
                                .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                                .build());

        var group =
                studyGroupRepo.save(
                        new StudyGroup(
                                study.getId(),
                                "A반",
                                Instant.now().minus(21, ChronoUnit.DAYS),
                                "Asia/Seoul",
                                10));

        meeting1 =
                studyMeetingRepo.save(
                        new StudyMeeting(
                                group.getId(),
                                Instant.now().minus(14, ChronoUnit.DAYS),
                                null,
                                null));
        meeting2 =
                studyMeetingRepo.save(
                        new StudyMeeting(
                                group.getId(),
                                Instant.now().minus(7, ChronoUnit.DAYS),
                                null,
                                null));

        Instant joinedAt = Instant.now().minus(21, ChronoUnit.DAYS);
        participantA =
                studyParticipantRepo.save(
                        StudyParticipant.builder()
                                .accountId(LEADER_ACCOUNT_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.LEADER)
                                .joinedAt(joinedAt)
                                .build());
        participantB =
                studyParticipantRepo.save(
                        StudyParticipant.builder()
                                .accountId(MEMBER_ACCOUNT_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(joinedAt)
                                .build());
    }

    @Test
    @DisplayName("성공_새_출석_기록_INSERT된다")
    void 성공_새_출석_기록_INSERT된다() {
        var body =
                Map.of(
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting1.getId(),
                                        "participantId", participantA.getId(),
                                        "status", "PRESENT"),
                                Map.of(
                                        "meetingId", meeting1.getId(),
                                        "participantId", participantB.getId(),
                                        "status", "ABSENT")));

        var response = post(study.getId(), body, LEADER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        List<StudyAttendance> saved = studyAttendanceRepo.findAll();
        assertThat(saved).hasSize(2);
        assertThat(saved)
                .anySatisfy(
                        a -> {
                            assertThat(a.getStudyMeetingId()).isEqualTo(meeting1.getId());
                            assertThat(a.getAccountId()).isEqualTo(LEADER_ACCOUNT_ID);
                            assertThat(a.getStatus()).isEqualTo(AttendanceStatus.PRESENT);
                        });
        assertThat(saved)
                .anySatisfy(
                        a -> {
                            assertThat(a.getStudyMeetingId()).isEqualTo(meeting1.getId());
                            assertThat(a.getAccountId()).isEqualTo(MEMBER_ACCOUNT_ID);
                            assertThat(a.getStatus()).isEqualTo(AttendanceStatus.ABSENT);
                        });
    }

    @Test
    @DisplayName("성공_기존_출석_기록_UPDATE된다")
    void 성공_기존_출석_기록_UPDATE된다() {
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(LEADER_ACCOUNT_ID)
                        .studyId(study.getId())
                        .studyGroupId(participantA.getStudyGroupId())
                        .studyMeetingId(meeting1.getId())
                        .status(AttendanceStatus.PRESENT)
                        .build());

        var body =
                Map.of(
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting1.getId(),
                                        "participantId", participantA.getId(),
                                        "status", "ABSENT")));

        var response = post(study.getId(), body, LEADER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        List<StudyAttendance> saved = studyAttendanceRepo.findAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getStatus()).isEqualTo(AttendanceStatus.ABSENT);
    }

    @Test
    @DisplayName("성공_INSERT와_UPDATE_혼합_요청")
    void 성공_INSERT와_UPDATE_혼합_요청() {
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(LEADER_ACCOUNT_ID)
                        .studyId(study.getId())
                        .studyGroupId(participantA.getStudyGroupId())
                        .studyMeetingId(meeting1.getId())
                        .status(AttendanceStatus.PRESENT)
                        .build());

        var body =
                Map.of(
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting1.getId(),
                                        "participantId", participantA.getId(),
                                        "status", "LATE"), // UPDATE
                                Map.of(
                                        "meetingId", meeting2.getId(),
                                        "participantId", participantB.getId(),
                                        "status", "PRESENT"))); // INSERT

        var response = post(study.getId(), body, LEADER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        List<StudyAttendance> saved = studyAttendanceRepo.findAll();
        assertThat(saved).hasSize(2);
        assertThat(saved)
                .anySatisfy(
                        a -> {
                            assertThat(a.getStudyMeetingId()).isEqualTo(meeting1.getId());
                            assertThat(a.getAccountId()).isEqualTo(LEADER_ACCOUNT_ID);
                            assertThat(a.getStatus()).isEqualTo(AttendanceStatus.LATE);
                        });
        assertThat(saved)
                .anySatisfy(
                        a -> {
                            assertThat(a.getStudyMeetingId()).isEqualTo(meeting2.getId());
                            assertThat(a.getAccountId()).isEqualTo(MEMBER_ACCOUNT_ID);
                            assertThat(a.getStatus()).isEqualTo(AttendanceStatus.PRESENT);
                        });
    }

    @Test
    @DisplayName("MEMBER_역할은_403")
    void MEMBER_역할은_403() {
        var body =
                Map.of(
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting1.getId(),
                                        "participantId", participantA.getId(),
                                        "status", "PRESENT")));

        var response = post(study.getId(), body, MEMBER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("존재하지_않는_studyId_404")
    void 존재하지_않는_studyId_404() {
        var body =
                Map.of(
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting1.getId(),
                                        "participantId", participantA.getId(),
                                        "status", "PRESENT")));

        var response = post(999_999L, body, LEADER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private <T> org.springframework.http.ResponseEntity<T> post(
            Long studyId, Object body, Long callerAccountId) {
        return rest.exchange(
                "/api/studies/{studyId}/attendances",
                HttpMethod.POST,
                authenticatedRequest(body, callerAccountId),
                (Class<T>) Void.class,
                studyId);
    }

    private HttpEntity<Object> authenticatedRequest(Object body, Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private void insertAccountIfAbsent(Long id, String nickname, String email) {
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
                SystemRole.MEMBER.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
