package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

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
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AttendanceGetIntegrationTest {

    private static final Long ACCOUNT_A_ID = 2001L;
    private static final Long ACCOUNT_B_ID = 2002L;

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
    private StudyGroup group;
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

        insertAccountIfAbsent(ACCOUNT_A_ID, "수아", "sua@att-test.com");
        insertAccountIfAbsent(ACCOUNT_B_ID, "지원", "jiwon@att-test.com");

        var program = studyProgramRepo.save(StudyProgram.builder().title("시스템 디자인 프로그램").build());

        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .slug("system-design-study")
                                .title("시스템 디자인 스터디")
                                .oneLineSummary("시스템 디자인 심화")
                                .category(StudyCategory.ALGORITHM)
                                .studyKind(StudyKind.STUDY)
                                .description("시스템 디자인 스터디 설명")
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.OPEN)
                                .capacity(10)
                                .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                                .build());

        group =
                studyGroupRepo.save(
                        new StudyGroup(
                                study.getId(),
                                "월요반",
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
                                .accountId(ACCOUNT_A_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(joinedAt)
                                .build());
        participantB =
                studyParticipantRepo.save(
                        StudyParticipant.builder()
                                .accountId(ACCOUNT_B_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(joinedAt)
                                .build());

        // A: PRESENT(M1) + LATE(M2)  → rate = 1.5/2 = 0.75
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(ACCOUNT_A_ID)
                        .studyId(study.getId())
                        .studyGroupId(group.getId())
                        .studyMeetingId(meeting1.getId())
                        .status(AttendanceStatus.PRESENT)
                        .build());
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(ACCOUNT_A_ID)
                        .studyId(study.getId())
                        .studyGroupId(group.getId())
                        .studyMeetingId(meeting2.getId())
                        .status(AttendanceStatus.LATE)
                        .build());

        // B: PRESENT(M1) + ABSENT(M2)  → rate = 1.0/2 = 0.5
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(ACCOUNT_B_ID)
                        .studyId(study.getId())
                        .studyGroupId(group.getId())
                        .studyMeetingId(meeting1.getId())
                        .status(AttendanceStatus.PRESENT)
                        .build());
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(ACCOUNT_B_ID)
                        .studyId(study.getId())
                        .studyGroupId(group.getId())
                        .studyMeetingId(meeting2.getId())
                        .status(AttendanceStatus.ABSENT)
                        .build());
    }

    @Test
    @DisplayName("성공 - 그룹 전체 명부를 올바른 출석률과 함께 반환한다")
    void returnsAttendanceWithCorrectRates() {
        var response =
                rest.exchange(
                        "/api/studies/{studyId}/attendances?studyGroupId={groupId}",
                        HttpMethod.GET,
                        authenticatedRequest(ACCOUNT_A_ID),
                        Map.class,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        Map<?, ?> body = response.getBody();

        // study 요약
        Map<?, ?> studySummary = (Map<?, ?>) body.get("study");
        assertThat(studySummary.get("id")).isEqualTo(study.getId().intValue());
        assertThat(studySummary.get("title")).isEqualTo("시스템 디자인 스터디");
        assertThat(studySummary.get("participantCount")).isEqualTo(2);
        assertThat(studySummary.get("totalMeetings")).isEqualTo(2);
        assertThat((Double) studySummary.get("avgAttendanceRate")).isCloseTo(0.625, within(0.001));

        // meetings
        List<?> meetings = (List<?>) body.get("meetings");
        assertThat(meetings).hasSize(2);
        assertThat(((Map<?, ?>) meetings.get(0)).get("id")).isEqualTo(meeting1.getId().intValue());
        assertThat(((Map<?, ?>) meetings.get(1)).get("id")).isEqualTo(meeting2.getId().intValue());

        // participants
        List<?> participants = (List<?>) body.get("participants");
        assertThat(participants).hasSize(2);

        Map<?, ?> pA = findParticipant(participants, participantA.getId());
        assertThat((Double) pA.get("attendanceRate")).isCloseTo(0.75, within(0.001));
        List<?> attendancesA = (List<?>) pA.get("attendances");
        assertThat(attendancesA).hasSize(2);
        assertThat(((Map<?, ?>) attendancesA.get(0)).get("status")).isEqualTo("PRESENT");
        assertThat(((Map<?, ?>) attendancesA.get(1)).get("status")).isEqualTo("LATE");

        Map<?, ?> pB = findParticipant(participants, participantB.getId());
        assertThat((Double) pB.get("attendanceRate")).isCloseTo(0.5, within(0.001));
        List<?> attendancesB = (List<?>) pB.get("attendances");
        assertThat(attendancesB).hasSize(2);
        assertThat(((Map<?, ?>) attendancesB.get(0)).get("status")).isEqualTo("PRESENT");
        assertThat(((Map<?, ?>) attendancesB.get(1)).get("status")).isEqualTo("ABSENT");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Map<?, ?> findParticipant(List<?> participants, Long participantId) {
        return participants.stream()
                .map(p -> (Map<?, ?>) p)
                .filter(p -> participantId.intValue() == (int) p.get("participantId"))
                .findFirst()
                .orElseThrow(
                        () ->
                                new AssertionError(
                                        "participant not found: participantId=" + participantId));
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

    private HttpEntity<Void> authenticatedRequest(Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        return new HttpEntity<>(headers);
    }
}
