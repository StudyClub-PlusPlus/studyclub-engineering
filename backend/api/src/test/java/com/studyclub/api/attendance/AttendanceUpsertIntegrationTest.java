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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
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

        insertAccountIfAbsent(LEADER_ACCOUNT_ID, "리더", "leader@upsert-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ACCOUNT_ID, "멤버", "member@upsert-test.com", SystemRole.MEMBER);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder()
                                .title("테스트 프로그램")
                                .studyKind(StudyKind.STUDY)
                                .build());

        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("Upsert 테스트 스터디")
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
                        "studyGroupId",
                        group.getId(),
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
                        "studyGroupId",
                        group.getId(),
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
                        "studyGroupId",
                        group.getId(),
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
    @DisplayName("비어드민_403")
    void 비어드민_403() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
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
    @DisplayName("존재하지_않는_분반_404")
    void 존재하지_않는_분반_404() {
        var body =
                Map.of(
                        "studyGroupId",
                        999_999L,
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId", meeting1.getId(),
                                        "participantId", participantA.getId(),
                                        "status", "PRESENT")));

        var response = post(study.getId(), body, LEADER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("출석·중단을 함께 저장한다 — 과거 발표와 재요청 시각을 보존한다")
    void savesAttendanceAndWithdrawalAtomically() {
        meeting1.assignPresenters(participantB.getId(), null);
        studyMeetingRepo.save(meeting1);
        var future =
                StudyMeeting.schedule(group.getId(), Instant.now().plus(2, ChronoUnit.DAYS), "미래");
        future.assignPresenters(participantB.getId(), participantA.getId());
        future = studyMeetingRepo.save(future);
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId",
                                        meeting1.getId(),
                                        "participantId",
                                        participantB.getId(),
                                        "status",
                                        "PRESENT")),
                        "withdrawals",
                        List.of(participantB.getId()));

        var response = withdraw("me", body, LEADER_ACCOUNT_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        var saved = studyParticipantRepo.findById(participantB.getId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(ParticipantStatus.WITHDRAWN);
        assertThat(saved.getLeftAt()).isNotNull();
        assertThat(studyAttendanceRepo.findAll())
                .singleElement()
                .satisfies(a -> assertThat(a.getStatus()).isEqualTo(AttendanceStatus.PRESENT));
        assertThat(
                        studyMeetingRepo
                                .findById(meeting1.getId())
                                .orElseThrow()
                                .getPresenter1ParticipantId())
                .isEqualTo(participantB.getId());
        var updated = studyMeetingRepo.findById(future.getId()).orElseThrow();
        assertThat(updated.getPresenter1ParticipantId()).isNull();
        assertThat(updated.getPresenter2ParticipantId()).isEqualTo(participantA.getId());
        assertThat(withdraw("me", body, LEADER_ACCOUNT_ID).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyParticipantRepo.findById(participantB.getId()).orElseThrow().getLeftAt())
                .isEqualTo(saved.getLeftAt());
    }

    @ParameterizedTest
    @ValueSource(strings = {"me", "admin"})
    @DisplayName("출석 변경 없이 중단만 저장한다 — 사용자·관리자 요청 계약이 같다")
    void savesWithdrawalWithoutAttendance(String path) {
        var response =
                withdraw(
                        path,
                        Map.of(
                                "studyGroupId",
                                group.getId(),
                                "withdrawals",
                                List.of(participantB.getId())),
                        LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyParticipantRepo.findById(participantB.getId()).orElseThrow().getStatus())
                .isEqualTo(ParticipantStatus.WITHDRAWN);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "{\"updates\":[],\"withdrawals\":[]}",
                "{\"updates\":null,\"withdrawals\":null}",
                "{\"withdrawals\":[null]}",
                "{\"updates\":[null]}",
                "{\"withdrawals\":[1,1]}",
                "{\"withdrawals\":[999999]}"
            })
    @DisplayName("잘못된 요청은 400 — 입력 오류가 저장으로 이어지지 않는다")
    void rejectsInvalidWithdrawalRequest(String fields) {
        String body =
                "{\"studyGroupId\":"
                        + group.getId()
                        + (fields.length() > 2 ? "," + fields.substring(1) : "}");
        var response = withdraw("me", body, LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("INVALID_INPUT");
        assertThat(studyParticipantRepo.findById(participantB.getId()).orElseThrow().getStatus())
                .isEqualTo(ParticipantStatus.ACTIVE);
    }

    @Test
    @DisplayName("자기 제명은 400 — 본인 하차와 운영진 제명을 구분한다")
    void rejectsSelfWithdrawal() {
        var response = withdraw("me", withdrawalBody(participantA.getId()), LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("CANNOT_WITHDRAW_SELF");
    }

    @Test
    @DisplayName("탈퇴 명부는 409 — 종료 상태를 제명으로 덮어쓰지 않는다")
    void rejectsDeletedParticipant() {
        jdbcTemplate.update(
                "UPDATE STUDY_PARTICIPANT SET STATUS = ? WHERE ID = ?",
                ParticipantStatus.DELETED.name(),
                participantB.getId());
        var response = withdraw("me", withdrawalBody(participantB.getId()), LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).contains("PARTICIPANT_NOT_ACTIVE");
    }

    @Test
    @DisplayName("끝난 스터디는 409 — 종료 이력을 고치지 않는다")
    void rejectsClosedStudy() {
        jdbcTemplate.update(
                "UPDATE STUDY SET STATUS = ? WHERE ID = ?",
                StudyStatus.CLOSED.name(),
                study.getId());
        var response = withdraw("me", withdrawalBody(participantB.getId()), LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).contains("STUDY_ENDED");
    }

    @Test
    @DisplayName("담당이 아닌 캡틴은 사용자 경로에서 중단할 수 없다")
    void rejectsUnassignedCaptain() {
        jdbcTemplate.update(
                "UPDATE STUDY SET CREATED_BY = ? WHERE ID = ?", MEMBER_ACCOUNT_ID, study.getId());
        jdbcTemplate.update(
                "UPDATE STUDY_PARTICIPANT SET PARTICIPANT_ROLE = 'MEMBER' WHERE ID = ?",
                participantA.getId());
        var response = withdraw("me", withdrawalBody(participantB.getId()), LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("활성 네비게이터만 중단할 수 있다")
    void rejectsWithdrawnNavigator() {
        jdbcTemplate.update(
                "UPDATE STUDY SET CREATED_BY = ? WHERE ID = ?", MEMBER_ACCOUNT_ID, study.getId());
        jdbcTemplate.update(
                "UPDATE STUDY_PARTICIPANT SET STATUS = 'WITHDRAWN' WHERE ID = ?",
                participantA.getId());
        var response = withdraw("me", withdrawalBody(participantB.getId()), LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @ParameterizedTest
    @ValueSource(strings = {"me", "admin"})
    @DisplayName("다른 분반 대상이 섞이면 전체 저장을 거절한다")
    void rejectsMixedGroupsWithoutSaving(String path) {
        var other =
                studyGroupRepo.save(
                        new StudyGroup(study.getId(), "B반", Instant.now(), "Asia/Seoul", 10));
        jdbcTemplate.update(
                "UPDATE STUDY_PARTICIPANT SET STUDY_GROUP_ID = ? WHERE ID = ?",
                other.getId(),
                participantB.getId());
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId",
                                        meeting1.getId(),
                                        "participantId",
                                        participantA.getId(),
                                        "status",
                                        "PRESENT")),
                        "withdrawals",
                        List.of(participantB.getId()));
        var response = withdraw(path, body, LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(studyAttendanceRepo.findAll()).isEmpty();
        assertThat(studyParticipantRepo.findById(participantB.getId()).orElseThrow().getStatus())
                .isEqualTo(ParticipantStatus.ACTIVE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"leader", "captain"})
    @DisplayName("운영진을 중단하면 출석도 저장하지 않는다")
    void rejectsStaffWithoutSavingAttendance(String role) {
        if (role.equals("leader")) {
            jdbcTemplate.update(
                    "UPDATE STUDY_PARTICIPANT SET PARTICIPANT_ROLE = 'LEADER' WHERE ID = ?",
                    participantB.getId());
        } else {
            jdbcTemplate.update(
                    "UPDATE STUDY SET CREATED_BY = ? WHERE ID = ?",
                    MEMBER_ACCOUNT_ID,
                    study.getId());
        }
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "updates",
                        List.of(
                                Map.of(
                                        "meetingId",
                                        meeting1.getId(),
                                        "participantId",
                                        participantA.getId(),
                                        "status",
                                        "PRESENT")),
                        "withdrawals",
                        List.of(participantB.getId()));
        var response = withdraw("me", body, LEADER_ACCOUNT_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(studyAttendanceRepo.findAll()).isEmpty();
    }

    @Test
    @DisplayName("크루는 중단할 수 없다")
    void rejectsMember() {
        assertThat(
                        withdraw("me", withdrawalBody(participantA.getId()), MEMBER_ACCOUNT_ID)
                                .getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @ParameterizedTest
    @EnumSource(
            value = ParticipantStatus.class,
            names = {"ACTIVE", "PAUSED"})
    @DisplayName("활성·휴식 네비게이터는 중단할 수 있다 — ADMIN 우회 없이 분반 역할로 허용한다")
    void allowsActiveNavigator(ParticipantStatus status) {
        jdbcTemplate.update("UPDATE STUDY SET CREATED_BY = 999999 WHERE ID = ?", study.getId());
        jdbcTemplate.update(
                "UPDATE STUDY_PARTICIPANT SET STATUS = ? WHERE ID = ?",
                status.name(),
                participantA.getId());
        assertThat(
                        withdraw("me", withdrawalBody(participantB.getId()), LEADER_ACCOUNT_ID)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    @DisplayName("명부에 없는 담당 캡틴도 중단할 수 있다")
    void allowsCaptainWithoutRoster() {
        jdbcTemplate.update(
                "UPDATE STUDY SET CREATED_BY = ? WHERE ID = ?", LEADER_ACCOUNT_ID, study.getId());
        studyParticipantRepo.deleteById(participantA.getId());
        assertThat(
                        withdraw("me", withdrawalBody(participantB.getId()), LEADER_ACCOUNT_ID)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    @DisplayName("미인증 요청은 401과 UNAUTHORIZED — 필터도 오류 계약을 지킨다")
    void rejectsUnauthenticatedWithdrawal() {
        var response =
                rest.postForEntity(
                        "/api/me/studies/{studyId}/attendances",
                        withdrawalBody(participantB.getId()),
                        String.class,
                        study.getId());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).contains("UNAUTHORIZED");
    }

    private Map<String, Object> withdrawalBody(Long participantId) {
        return Map.of(
                "studyGroupId",
                group.getId(),
                "updates",
                List.of(),
                "withdrawals",
                List.of(participantId));
    }

    private ResponseEntity<String> withdraw(String path, Object body, Long accountId) {
        return rest.exchange(
                "/api/" + path + "/studies/{studyId}/attendances",
                HttpMethod.POST,
                authenticatedRequest(body, accountId),
                String.class,
                study.getId());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private <T> ResponseEntity<T> post(Long studyId, Object body, Long callerAccountId) {
        return rest.exchange(
                "/api/admin/studies/{studyId}/attendances",
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
