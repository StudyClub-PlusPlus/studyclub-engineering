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
class MyAttendanceUpsertIntegrationTest {

    private static final Long NAVIGATOR_ACCOUNT_ID = 5001L;
    private static final Long MEMBER_ACCOUNT_ID = 5002L;
    private static final Long OUTSIDER_ACCOUNT_ID = 5003L;

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
    private StudyMeeting meeting;
    private StudyParticipant participantNavigator;
    private StudyParticipant participantMember;

    @BeforeEach
    void setUp() {
        studyAttendanceRepo.deleteAll();
        studyParticipantRepo.deleteAll();
        studyMeetingRepo.deleteAll();
        studyGroupRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();

        insertAccountIfAbsent(NAVIGATOR_ACCOUNT_ID, "네비게이터", "navigator@me-upsert-test.com");
        insertAccountIfAbsent(MEMBER_ACCOUNT_ID, "크루멤버", "member@me-upsert-test.com");
        insertAccountIfAbsent(OUTSIDER_ACCOUNT_ID, "미참여자", "outsider@me-upsert-test.com");

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder()
                                .title("네비 upsert 테스트 프로그램")
                                .studyKind(StudyKind.STUDY)
                                .build());

        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("네비 upsert 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.OPEN)
                                .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                                .build());

        group =
                studyGroupRepo.save(
                        new StudyGroup(
                                study.getId(),
                                "A반",
                                Instant.now().minus(21, ChronoUnit.DAYS),
                                "Asia/Seoul",
                                10));

        meeting =
                studyMeetingRepo.save(
                        new StudyMeeting(
                                group.getId(),
                                Instant.now().minus(7, ChronoUnit.DAYS),
                                null,
                                null));

        Instant joinedAt = Instant.now().minus(21, ChronoUnit.DAYS);
        participantNavigator =
                studyParticipantRepo.save(
                        StudyParticipant.builder()
                                .accountId(NAVIGATOR_ACCOUNT_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.LEADER)
                                .joinedAt(joinedAt)
                                .build());
        participantMember =
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
    @DisplayName("성공 - 네비게이터(LEADER)는 출석을 기록할 수 있다")
    void navigatorCanUpsertAttendance() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting.getId(),
                                        "participantId", participantMember.getId(),
                                        "status", "PRESENT")));

        var response = post(study.getId(), body, NAVIGATOR_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        List<StudyAttendance> saved = studyAttendanceRepo.findAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getStatus()).isEqualTo(AttendanceStatus.PRESENT);
    }

    @Test
    @DisplayName("실패 - 분반 MEMBER는 출석을 수정할 수 없다 — 403")
    void memberCannotUpsert() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting.getId(),
                                        "participantId", participantNavigator.getId(),
                                        "status", "PRESENT")));

        var response = post(study.getId(), body, MEMBER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("실패 - 분반 미참여자는 출석을 수정할 수 없다 — 403")
    void outsiderCannotUpsert() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting.getId(),
                                        "participantId", participantMember.getId(),
                                        "status", "PRESENT")));

        var response = post(study.getId(), body, OUTSIDER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("실패 - 비인증 요청은 401")
    void unauthenticatedRequestReturns401() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting.getId(),
                                        "participantId", participantMember.getId(),
                                        "status", "PRESENT")));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var response =
                rest.exchange(
                        "/api/me/studies/{studyId}/attendances",
                        HttpMethod.POST,
                        new HttpEntity<>(body, headers),
                        Void.class,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private <T> org.springframework.http.ResponseEntity<T> post(
            Long studyId, Object body, Long callerAccountId) {
        return rest.exchange(
                "/api/me/studies/{studyId}/attendances",
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
