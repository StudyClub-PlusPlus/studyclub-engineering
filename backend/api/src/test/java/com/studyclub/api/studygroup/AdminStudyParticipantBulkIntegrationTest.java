package com.studyclub.api.studygroup;

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
import com.studyclub.domain.participant.StudyParticipantRoleChanged;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 역할·반 일괄 변경 ({@code PATCH /api/admin/studies/{studyId}/participants}) — specs/study-group/spec.md
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyParticipantBulkIntegrationTest {

    // auto_increment 충돌 방지 — Long.MAX_VALUE 근처의 값은 실제 시퀀스가 도달하지 않는다.
    private static final Long ADMIN_ID = Long.MAX_VALUE - 100;
    private static final Long MEMBER_ID = Long.MAX_VALUE - 101;
    private static final Long CREW1_ID = Long.MAX_VALUE - 102;
    private static final Long CREW2_ID = Long.MAX_VALUE - 103;
    private static final Long WITHDRAWN_ID = Long.MAX_VALUE - 104;
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
    @Autowired StudyMeetingRepository studyMeetingRepo;
    @Autowired StudyAttendanceRepository studyAttendanceRepo;
    @Autowired RoleChangedEvents roleChangedEvents;

    private StudyProgram program;
    private Study study;
    private StudyGroup group;
    private StudyGroup group2;
    private StudyParticipant crew1;
    private StudyParticipant crew2;
    private StudyParticipant withdrawnCrew;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        roleChangedEvents.received.clear();
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
        group = studyGroupRepo.save(StudyGroup.create(study.getId(), "벌크A반"));
        group2 = studyGroupRepo.save(StudyGroup.create(study.getId(), "벌크B반"));

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
        // 파생 삭제(derived delete)는 직접 트랜잭션이 없으면 실패하므로 JDBC로 정리한다.
        jdbcTemplate.update("DELETE FROM STUDY_ATTENDANCE WHERE STUDY_ID = ?", study.getId());
        jdbcTemplate.update(
                "DELETE FROM ADMIN_AUDIT_LOG WHERE TARGET_ACCOUNT_ID IN (?, ?)",
                CREW1_ID,
                CREW2_ID);
        // STUDY_GROUP_ID 직접 지정 대신 서브쿼리로 — 이 study 에 속한 모든 반의 회차를 커버한다.
        jdbcTemplate.update(
                "DELETE FROM STUDY_MEETING WHERE STUDY_GROUP_ID IN"
                        + " (SELECT ID FROM STUDY_GROUP WHERE STUDY_ID = ?)",
                study.getId());
        studyParticipantRepo.deleteAll(List.of(crew1, crew2, withdrawnCrew));
        studyGroupRepo.deleteAll(List.of(group, group2));
        studyRepo.delete(study);
        studyProgramRepo.delete(program);
    }

    // ── 역할 변경 ─────────────────────────────────────────────────────────────

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
    @DisplayName("성공 - 여러 참여자 동시 역할 변경")
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
    void roleChangeIdempotent() {
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

    // ── 반 이동 ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공 - 반 이동")
    void groupChange() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "groupId",
                                                group2.getId()))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyParticipantRepo.findById(crew1.getId()).orElseThrow().getStudyGroupId())
                .isEqualTo(group2.getId());
    }

    @Test
    @DisplayName("성공 - 반 이동 시 새 반의 예정 회차에 ABSENT 생성")
    void groupChangeCreatesAbsentAttendance() {
        StudyMeeting upcomingMeeting =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group2.getId(), Instant.now().plusSeconds(3600), "예정 회차"));

        patch(
                Map.of(
                        "changes",
                        List.of(Map.of("participantId", crew1.getId(), "groupId", group2.getId()))),
                ADMIN_ID,
                study.getId());

        var attendance =
                studyAttendanceRepo.findByStudyMeetingIdAndAccountId(
                        upcomingMeeting.getId(), CREW1_ID);
        assertThat(attendance).isPresent();
        assertThat(attendance.get().getStatus()).isEqualTo(AttendanceStatus.ABSENT);
    }

    @Test
    @DisplayName("성공 - 반 이동 시 옛 반 예정 회차의 발표자 칸 비움")
    void groupChangeReleasesPresenterSlot() {
        StudyMeeting meeting =
                StudyMeeting.schedule(group.getId(), Instant.now().plusSeconds(3600), "발표 회차");
        meeting.assignPresenters(crew1.getId(), null);
        studyMeetingRepo.save(meeting);

        patch(
                Map.of(
                        "changes",
                        List.of(Map.of("participantId", crew1.getId(), "groupId", group2.getId()))),
                ADMIN_ID,
                study.getId());

        assertThat(
                        studyMeetingRepo
                                .findById(meeting.getId())
                                .orElseThrow()
                                .getPresenter1ParticipantId())
                .isNull();
    }

    @Test
    @DisplayName("성공 - 역할과 반을 동시에 변경")
    void roleAndGroupChangeTogether() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "participantRole",
                                                "LEADER",
                                                "groupId",
                                                group2.getId()))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        StudyParticipant updated = studyParticipantRepo.findById(crew1.getId()).orElseThrow();
        assertThat(updated.getParticipantRole()).isEqualTo(ParticipantRole.LEADER);
        assertThat(updated.getStudyGroupId()).isEqualTo(group2.getId());
    }

    @Test
    @DisplayName("성공 - 같은 반이면 200 그대로 (멱등)")
    void groupChangeIdempotent() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "groupId",
                                                group.getId()))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyParticipantRepo.findById(crew1.getId()).orElseThrow().getStudyGroupId())
                .isEqualTo(group.getId());
    }

    // ── 에러 케이스 ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패 - participantRole·groupId 둘 다 없으면 400 INVALID_INPUT")
    void bothFieldsNull() {
        var response =
                patch(
                        Map.of("changes", List.of(Map.of("participantId", crew1.getId()))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
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
    @DisplayName("실패 - 없는 반으로 이동 → 404 NOT_FOUND")
    void missingGroup() {
        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "groupId",
                                                MISSING_ID))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 다른 스터디의 반으로 이동 → 400 INVALID_INPUT")
    void groupFromDifferentStudy() {
        StudyProgram otherProgram =
                studyProgramRepo.save(
                        StudyProgram.builder().title("다른 프로그램").studyKind(StudyKind.STUDY).build());
        Study otherStudy =
                studyRepo.save(
                        Study.builder()
                                .programId(otherProgram.getId())
                                .title("다른 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.ONGOING)
                                .createdBy(ADMIN_ID)
                                .build());
        StudyGroup otherGroup = studyGroupRepo.save(StudyGroup.create(otherStudy.getId(), "다른반"));
        try {
            var response =
                    patch(
                            Map.of(
                                    "changes",
                                    List.of(
                                            Map.of(
                                                    "participantId",
                                                    crew1.getId(),
                                                    "groupId",
                                                    otherGroup.getId()))),
                            ADMIN_ID,
                            study.getId());

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        } finally {
            studyGroupRepo.delete(otherGroup);
            studyRepo.delete(otherStudy);
            studyProgramRepo.delete(otherProgram);
        }
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

    // ── 리뷰 반영: 출석 정리 · 메시지 · 감사 로그 · 이벤트 ─────────────────────────

    @Test
    @DisplayName("성공 - 반 이동 시 옛 반 예정 회차 출석은 상태와 상관없이 지우고, 지난 회차 출석은 남긴다")
    void groupChangeClearsOldGroupUpcomingAttendance() {
        StudyMeeting past =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().minusSeconds(3600), "지난 회차"));
        StudyMeeting upcomingAbsent =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().plusSeconds(3600), "예정 회차 1"));
        StudyMeeting upcomingExcused =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().plusSeconds(7200), "예정 회차 2"));
        saveAttendance(past, CREW1_ID, AttendanceStatus.PRESENT);
        saveAttendance(upcomingAbsent, CREW1_ID, AttendanceStatus.ABSENT);
        saveAttendance(upcomingExcused, CREW1_ID, AttendanceStatus.EXCUSED);
        saveAttendance(upcomingAbsent, CREW2_ID, AttendanceStatus.ABSENT);

        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "groupId",
                                                group2.getId()))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyAttendanceRepo.findByStudyMeetingIdAndAccountId(past.getId(), CREW1_ID))
                .isPresent();
        assertThat(
                        studyAttendanceRepo.findByStudyMeetingIdAndAccountId(
                                upcomingAbsent.getId(), CREW1_ID))
                .isEmpty();
        assertThat(
                        studyAttendanceRepo.findByStudyMeetingIdAndAccountId(
                                upcomingExcused.getId(), CREW1_ID))
                .isEmpty();
        // 남는 사람의 출석은 건드리지 않는다
        assertThat(
                        studyAttendanceRepo.findByStudyMeetingIdAndAccountId(
                                upcomingAbsent.getId(), CREW2_ID))
                .isPresent();
    }

    @Test
    @DisplayName("성공 - 여러 명을 예정 회차 여럿인 반으로 옮기면 사람 × 회차마다 ABSENT 하나, 이미 있던 행은 그대로")
    void groupChangeCreatesAbsentForEveryArrivalOnce() {
        StudyMeeting m1 =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group2.getId(), Instant.now().plusSeconds(3600), "B반 예정 1"));
        StudyMeeting m2 =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group2.getId(), Instant.now().plusSeconds(7200), "B반 예정 2"));
        // 예전에 B반에 있다가 돌아오는 경우 — 사전 휴가가 남아 있다
        saveAttendance(m1, CREW1_ID, AttendanceStatus.EXCUSED);

        var response =
                patch(
                        Map.of(
                                "changes",
                                List.of(
                                        Map.of(
                                                "participantId",
                                                crew1.getId(),
                                                "groupId",
                                                group2.getId()),
                                        Map.of(
                                                "participantId",
                                                crew2.getId(),
                                                "groupId",
                                                group2.getId()))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(attendanceStatus(m1, CREW1_ID)).isEqualTo(AttendanceStatus.EXCUSED);
        assertThat(attendanceStatus(m2, CREW1_ID)).isEqualTo(AttendanceStatus.ABSENT);
        assertThat(attendanceStatus(m1, CREW2_ID)).isEqualTo(AttendanceStatus.ABSENT);
        assertThat(attendanceStatus(m2, CREW2_ID)).isEqualTo(AttendanceStatus.ABSENT);
    }

    @Test
    @DisplayName("성공 - 옮긴 뒤 빈 옛 반은 예정 회차 출석이 정리돼 지울 수 있다")
    void emptiedGroupIsDeletableAfterMove() {
        StudyGroup group3 = studyGroupRepo.save(StudyGroup.create(study.getId(), "벌크C반"));
        try {
            patch(
                    Map.of(
                            "changes",
                            List.of(
                                    Map.of(
                                            "participantId",
                                            crew1.getId(),
                                            "groupId",
                                            group3.getId()))),
                    ADMIN_ID,
                    study.getId());
            StudyMeeting upcoming =
                    studyMeetingRepo.save(
                            StudyMeeting.schedule(
                                    group3.getId(), Instant.now().plusSeconds(3600), "C반 예정"));
            saveAttendance(upcoming, CREW1_ID, AttendanceStatus.ABSENT);

            patch(
                    Map.of(
                            "changes",
                            List.of(
                                    Map.of(
                                            "participantId",
                                            crew1.getId(),
                                            "groupId",
                                            group2.getId()))),
                    ADMIN_ID,
                    study.getId());

            assertThat(
                            adminExchange(
                                            "/api/admin/studies/{studyId}/groups/{groupId}",
                                            HttpMethod.DELETE,
                                            study.getId(),
                                            group3.getId())
                                    .getStatusCode())
                    .isEqualTo(HttpStatus.NO_CONTENT);
        } finally {
            jdbcTemplate.update(
                    "DELETE FROM STUDY_MEETING WHERE STUDY_GROUP_ID = ?", group3.getId());
            jdbcTemplate.update("DELETE FROM STUDY_GROUP WHERE ID = ?", group3.getId());
        }
    }

    @Test
    @DisplayName("실패 - 거절된 participantId 를 errorMessage 에 적고, 아무것도 바꾸지 않는다")
    void errorMessageNamesParticipant() {
        var notActive =
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
                                                withdrawnCrew.getId(),
                                                "participantRole",
                                                "LEADER"))),
                        ADMIN_ID,
                        study.getId());
        var missing =
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

        assertThat(notActive.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat((String) notActive.getBody().get("errorMessage"))
                .contains(String.valueOf(withdrawnCrew.getId()));
        assertThat(studyParticipantRepo.findById(crew1.getId()).orElseThrow().getParticipantRole())
                .isEqualTo(ParticipantRole.MEMBER);
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat((String) missing.getBody().get("errorMessage"))
                .contains(String.valueOf(MISSING_ID));
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM ADMIN_AUDIT_LOG WHERE TARGET_ACCOUNT_ID = ?",
                                Long.class,
                                CREW1_ID))
                .isZero();
        assertThat(roleChangedEvents.received).isEmpty();
    }

    @Test
    @DisplayName("성공 - 역할이 바뀐 행만 감사 로그 한 줄과 role_changed 하나")
    void roleChangeWritesAuditLogAndEvent() {
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
                                        // 같은 역할로 보내며 반만 바꾸는 줄은 남기지 않는다
                                        Map.of(
                                                "participantId",
                                                crew2.getId(),
                                                "participantRole",
                                                "MEMBER",
                                                "groupId",
                                                group2.getId()))),
                        ADMIN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> logs =
                jdbcTemplate.queryForList(
                        "SELECT ACTOR_ACCOUNT_ID, ACTION, TARGET_ACCOUNT_ID, BEFORE_VALUE, AFTER_VALUE"
                                + " FROM ADMIN_AUDIT_LOG WHERE TARGET_ACCOUNT_ID IN (?, ?)",
                        CREW1_ID,
                        CREW2_ID);
        assertThat(logs).hasSize(1);
        assertThat(logs.getFirst())
                .containsEntry("ACTOR_ACCOUNT_ID", ADMIN_ID)
                .containsEntry("ACTION", "PARTICIPANT_ROLE")
                .containsEntry("TARGET_ACCOUNT_ID", CREW1_ID)
                .containsEntry("BEFORE_VALUE", "MEMBER")
                .containsEntry("AFTER_VALUE", String.valueOf(crew1.getId()));

        assertThat(roleChangedEvents.received).hasSize(1);
        StudyParticipantRoleChanged event = roleChangedEvents.received.getFirst();
        assertThat(event.name()).isEqualTo(StudyParticipantRoleChanged.NAME);
        assertThat(event.participantId()).isEqualTo(crew1.getId());
        assertThat(event.accountId()).isEqualTo(CREW1_ID);
        assertThat(event.previousRole()).isEqualTo(ParticipantRole.MEMBER);
        assertThat(event.newRole()).isEqualTo(ParticipantRole.LEADER);
        assertThat(event.meta().actorId()).isEqualTo(String.valueOf(ADMIN_ID));
    }

    // ── 헬퍼 ─────────────────────────────────────────────────────────────────

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

    /** 캡틴(ADMIN_ID)으로 다른 백오피스 API 를 부른다. */
    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> adminExchange(
            String url, HttpMethod method, Object... uriVariables) {
        HttpHeaders headers = new HttpHeaders();
        String email = accountRepository.findById(ADMIN_ID).orElseThrow().getEmail();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(ADMIN_ID), email));
        return rest.exchange(url, method, new HttpEntity<>(headers), Map.class, uriVariables);
    }

    private void saveAttendance(StudyMeeting meeting, Long accountId, AttendanceStatus status) {
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(accountId)
                        .studyId(study.getId())
                        .studyGroupId(meeting.getStudyGroupId())
                        .studyMeetingId(meeting.getId())
                        .status(status)
                        .build());
    }

    private AttendanceStatus attendanceStatus(StudyMeeting meeting, Long accountId) {
        return studyAttendanceRepo
                .findByStudyMeetingIdAndAccountId(meeting.getId(), accountId)
                .orElseThrow()
                .getStatus();
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

    @TestConfiguration
    static class EventCapture {
        @Bean
        RoleChangedEvents roleChangedEvents() {
            return new RoleChangedEvents();
        }
    }

    /** 커밋 뒤 받은 role_changed — 운영 구독자(DSC-08)와 같은 시점에 받는다. */
    static class RoleChangedEvents {
        final List<StudyParticipantRoleChanged> received = new CopyOnWriteArrayList<>();

        @TransactionalEventListener
        void on(StudyParticipantRoleChanged event) {
            received.add(event);
        }
    }
}
