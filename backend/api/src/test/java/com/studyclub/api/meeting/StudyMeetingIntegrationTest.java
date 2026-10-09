package com.studyclub.api.meeting;

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
import java.time.LocalDate;
import java.time.ZoneId;
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
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyMeetingIntegrationTest {

    private static final Long LEADER_ID = 5101L;
    private static final Long MEMBER_ID = 5102L;
    private static final Long WITHDRAWN_ID = 5103L;
    private static final Long OTHER_GROUP_LEADER_ID = 5104L;
    private static final Long PAUSED_ID = 5105L;
    private static final Long COMPLETED_ID = 5106L;
    private static final Long CAPTAIN_ID = 5107L;
    // 이 스터디를 만든 캡틴 — 사용자 사이트에서 고칠 수 있는 캡틴은 이 사람뿐이다 (스펙 결정 3)
    private static final Long CREATOR_ID = 5109L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

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
    private StudyMeeting pastMeeting;
    private StudyMeeting futureMeeting;
    private StudyParticipant member;
    private StudyParticipant paused;
    private StudyParticipant withdrawn;

    @BeforeEach
    void setUp() {
        // 바디 있는 요청에 4xx 가 오면 레거시 클라이언트는 응답을 못 읽는다
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());

        studyAttendanceRepo.deleteAll();
        studyParticipantRepo.deleteAll();
        studyMeetingRepo.deleteAll();
        studyGroupRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();

        insertAccountIfAbsent(LEADER_ID, "네비게이터", "leader@meeting-test.com");
        insertAccountIfAbsent(MEMBER_ID, "크루", "member@meeting-test.com");
        insertAccountIfAbsent(WITHDRAWN_ID, "하차", "withdrawn@meeting-test.com");
        insertAccountIfAbsent(OTHER_GROUP_LEADER_ID, "옆반", "other@meeting-test.com");
        insertAccountIfAbsent(PAUSED_ID, "쉼", "paused@meeting-test.com");
        insertAccountIfAbsent(COMPLETED_ID, "완주", "completed@meeting-test.com");
        insertAccountIfAbsent(CAPTAIN_ID, "캡틴", "captain@meeting-test.com");
        insertAccountIfAbsent(CREATOR_ID, "만든캡틴", "creator@meeting-test.com");
        jdbcTemplate.update(
                "UPDATE ACCOUNT SET SYSTEM_ROLE = ? WHERE ID IN (?, ?)",
                SystemRole.ADMIN.name(),
                CAPTAIN_ID,
                CREATOR_ID);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("회차 프로그램").studyKind(StudyKind.STUDY).build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("회차 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.OPEN)
                                .startAt(Instant.now().minus(7, ChronoUnit.DAYS))
                                .createdBy(CREATOR_ID)
                                .discordChannelUrl("https://discord.gg/test")
                                .driveUrl("https://drive.google.com/test")
                                .build());
        // 정규 시작 20:00 KST = 11:00 UTC
        group =
                studyGroupRepo.save(
                        new StudyGroup(
                                study.getId(),
                                "목요일반",
                                Instant.parse("2026-09-03T11:00:00Z"),
                                "Asia/Seoul",
                                10));
        var otherGroup = studyGroupRepo.save(new StudyGroup(study.getId(), "미주반", null, null, 10));

        pastMeeting =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().minus(1, ChronoUnit.DAYS), "OT"));
        futureMeeting =
                studyMeetingRepo.save(StudyMeeting.schedule(group.getId(), daysFromNowAt(3), null));

        participant(LEADER_ID, group, ParticipantRole.LEADER, ParticipantStatus.ACTIVE);
        member = participant(MEMBER_ID, group, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);
        withdrawn =
                participant(
                        WITHDRAWN_ID, group, ParticipantRole.MEMBER, ParticipantStatus.WITHDRAWN);
        paused = participant(PAUSED_ID, group, ParticipantRole.MEMBER, ParticipantStatus.PAUSED);
        participant(COMPLETED_ID, group, ParticipantRole.MEMBER, ParticipantStatus.COMPLETED);
        participant(
                OTHER_GROUP_LEADER_ID,
                otherGroup,
                ParticipantRole.LEADER,
                ParticipantStatus.ACTIVE);
    }

    @Test
    @DisplayName("성공 - 분반을 안 주면 내 분반 회차를 날짜순 번호·시작 여부·현지 정규 시각과 함께 준다")
    void listsMyGroupMeetings() {
        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings",
                        null,
                        LEADER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> studyGroup = (Map<String, Object>) response.getBody().get("studyGroup");
        assertThat(studyGroup)
                .containsEntry("name", "목요일반")
                .containsEntry("timezone", "Asia/Seoul")
                .containsEntry("startTime", "20:00");
        List<Map<String, Object>> meetings =
                (List<Map<String, Object>>) response.getBody().get("meetings");
        assertThat(meetings).extracting(m -> m.get("number")).containsExactly(1, 2);
        assertThat(meetings).extracting(m -> m.get("title")).containsExactly("OT", null);
        assertThat(meetings).extracting(m -> m.get("started")).containsExactly(true, false);
        assertThat(meetings).extracting(m -> m.get("type")).containsOnly("REGULAR");
        assertThat(studyGroup).containsEntry("navigatorName", "네비게이터");
        assertThat((Map<String, Object>) response.getBody().get("me"))
                .containsEntry("canEdit", true);
        // 발표자 후보는 활성 참여자(ACTIVE·PAUSED)만, 이름순 — 하차·완주는 빠진다
        assertThat((List<Map<String, Object>>) response.getBody().get("participants"))
                .extracting(p -> p.get("name"))
                .containsExactly("네비게이터", "쉼", "크루");
        // 스터디 정보 카드 — id·title·discordChannelUrl·driveUrl 모두 응답에 실린다
        Map<String, Object> studyView = (Map<String, Object>) response.getBody().get("study");
        assertThat(studyView)
                .containsEntry("id", study.getId().intValue())
                .containsEntry("title", "회차 테스트 스터디")
                .containsEntry("discordChannelUrl", "https://discord.gg/test")
                .containsEntry("driveUrl", "https://drive.google.com/test");
    }

    @Test
    @DisplayName("성공 - 크루도 내 분반 일정을 본다. 고칠 수는 없다 (canEdit=false)")
    void memberCanList() {
        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings",
                        null,
                        MEMBER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat((Map<String, Object>) response.getBody().get("me"))
                .containsEntry("participantId", member.getId().intValue())
                .containsEntry("canEdit", false);
    }

    @Test
    @DisplayName("실패 - 참여를 중단한 사람은 일정을 볼 수 없다 → 403")
    void withdrawnCannotList() {
        var response =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings",
                        null,
                        WITHDRAWN_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("성공 - 킥오프는 0회차, 정규 회차는 1부터. 킥오프는 지울 수 없다 → 409 KICKOFF_NOT_DELETABLE")
    void kickoffIsZeroAndNotDeletable() {
        StudyMeeting kickoff =
                studyMeetingRepo.save(
                        StudyMeeting.kickoff(
                                group.getId(), Instant.now().minus(3, ChronoUnit.DAYS)));

        ResponseEntity<Map> list =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings",
                        null,
                        LEADER_ID,
                        study.getId());
        List<Map<String, Object>> meetings =
                (List<Map<String, Object>>) list.getBody().get("meetings");
        assertThat(meetings).extracting(m -> m.get("number")).containsExactly(0, 1, 2);
        assertThat(meetings).extracting(m -> m.get("type")).first().isEqualTo("KICKOFF");

        var delete =
                exchange(
                        HttpMethod.DELETE,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        null,
                        LEADER_ID,
                        study.getId(),
                        kickoff.getId());
        assertThat(delete.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(delete.getBody()).containsEntry("errorCode", "KICKOFF_NOT_DELETABLE");
    }

    @Test
    @DisplayName("실패 - 킥오프 날이나 그 앞에 정규 회차를 추가하면 400")
    void cannotAddBeforeKickoff() {
        studyMeetingRepo.save(StudyMeeting.kickoff(group.getId(), daysFromNowAt(5)));
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "scheduledAts",
                        List.of(daysFromNowAt(4).toString()));

        var response =
                exchange(
                        HttpMethod.POST,
                        "/api/studies/{studyId}/meetings",
                        body,
                        LEADER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("성공 - 반복(2개 이상)으로 만든 회차는 같은 묶음 ID, 한 번 만든 회차는 없음")
    void storesSeriesId() {
        var repeat =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "scheduledAts",
                        List.of(daysFromNowAt(10).toString(), daysFromNowAt(17).toString()));
        var once =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "scheduledAts",
                        List.of(daysFromNowAt(20).toString()));

        exchange(
                HttpMethod.POST,
                "/api/studies/{studyId}/meetings",
                repeat,
                LEADER_ID,
                study.getId());
        exchange(
                HttpMethod.POST, "/api/studies/{studyId}/meetings", once, LEADER_ID, study.getId());

        List<StudyMeeting> all =
                studyMeetingRepo.findByStudyGroupIdOrderByScheduledAt(group.getId());
        StudyMeeting first = all.get(all.size() - 3);
        StudyMeeting second = all.get(all.size() - 2);
        StudyMeeting single = all.get(all.size() - 1);
        assertThat(first.getSeriesId()).isNotNull().isEqualTo(second.getSeriesId());
        assertThat(single.getSeriesId()).isNull();
    }

    @Test
    @DisplayName("성공 - 하차한 참여자가 발표자로 남아 있으면 active=false 로 표시된다")
    void withdrawnPresenterShowsActiveFalse() {
        StudyMeeting meeting = studyMeetingRepo.findById(futureMeeting.getId()).orElseThrow();
        meeting.assignPresenters(withdrawn.getId(), null);
        studyMeetingRepo.save(meeting);

        ResponseEntity<Map> response =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings",
                        null,
                        LEADER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> meetings =
                (List<Map<String, Object>>) response.getBody().get("meetings");
        Map<String, Object> presenter1 = (Map<String, Object>) meetings.get(1).get("presenter1");
        assertThat(presenter1)
                .containsEntry("participantId", withdrawn.getId().intValue())
                .containsEntry("active", false);
    }

    @Test
    @DisplayName("성공 - 수정에서 발표자 칸은 보낸 칸만 바뀐다. 키가 없으면 그대로, null 이면 비운다")
    void updatesOnlySentPresenterSlots() {
        StudyMeeting meeting = studyMeetingRepo.findById(futureMeeting.getId()).orElseThrow();
        meeting.assignPresenters(member.getId(), paused.getId());
        studyMeetingRepo.save(meeting);

        var body = new java.util.HashMap<String, Object>();
        body.put("scheduledAt", futureMeeting.getScheduledAt().toString());
        body.put("presenter2ParticipantId", null);
        var response =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        body,
                        LEADER_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        StudyMeeting updated = studyMeetingRepo.findById(futureMeeting.getId()).orElseThrow();
        assertThat(updated.getPresenter1ParticipantId()).isEqualTo(member.getId());
        assertThat(updated.getPresenter2ParticipantId()).isNull();
    }

    @Test
    @DisplayName("실패 - 발표자1·2를 같은 사람으로 → 400")
    void samePresenterTwiceRejected() {
        var body =
                Map.of(
                        "scheduledAt",
                        futureMeeting.getScheduledAt().toString(),
                        "presenter1ParticipantId",
                        member.getId(),
                        "presenter2ParticipantId",
                        member.getId());

        var response =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        body,
                        LEADER_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("성공 - 크루가 빈 칸에 발표 신청하고, 같은 칸에 다른 크루가 신청하면 409 PRESENTER_SLOT_TAKEN")
    void crewSignsUpFirstComeFirstServed() {
        var mine =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/meetings/{meetingId}/presenters/1/me",
                        null,
                        MEMBER_ID,
                        study.getId(),
                        futureMeeting.getId());
        var late =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/meetings/{meetingId}/presenters/1/me",
                        null,
                        PAUSED_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(mine.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(late.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(late.getBody()).containsEntry("errorCode", "PRESENTER_SLOT_TAKEN");
        assertThat(
                        studyMeetingRepo
                                .findById(futureMeeting.getId())
                                .orElseThrow()
                                .getPresenter1ParticipantId())
                .isEqualTo(member.getId());
    }

    @Test
    @DisplayName("실패 - 남의 칸을 빼려 하면 409 PRESENTER_NOT_ME")
    void cannotCancelOthersSlot() {
        exchange(
                HttpMethod.PUT,
                "/api/studies/{studyId}/meetings/{meetingId}/presenters/2/me",
                null,
                MEMBER_ID,
                study.getId(),
                futureMeeting.getId());

        var response =
                exchange(
                        HttpMethod.DELETE,
                        "/api/studies/{studyId}/meetings/{meetingId}/presenters/2/me",
                        null,
                        PAUSED_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "PRESENTER_NOT_ME");
    }

    @Test
    @DisplayName("실패 - 명부에 없는 사람은 발표 신청 403 — 캡틴도 우회하지 않는다")
    void nonMemberCannotSignUp() {
        var response =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/meetings/{meetingId}/presenters/1/me",
                        null,
                        CREATOR_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("성공 - 네비게이터가 규칙을 저장하면 목록에 실린다")
    void savesRules() {
        var response =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/groups/{groupId}/rules",
                        Map.of("rules", "1. 발표는 최대 2명"),
                        LEADER_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getRules())
                .isEqualTo("1. 발표는 최대 2명");
    }

    @Test
    @DisplayName("실패 - 규칙 501자 → 400, 크루 → 403")
    void rulesValidationAndPermission() {
        var tooLong =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/groups/{groupId}/rules",
                        Map.of("rules", "가".repeat(501)),
                        LEADER_ID,
                        study.getId(),
                        group.getId());
        var crew =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/groups/{groupId}/rules",
                        Map.of("rules", "규칙"),
                        MEMBER_ID,
                        study.getId(),
                        group.getId());

        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(crew.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("성공 - 반복 추가는 날짜마다 회차를 만들고, ACTIVE·PAUSED 참여자 출석만 ABSENT 로 깐다 (하차·완주는 앞으로 오지 않는다)")
    void createsMeetingsWithAbsentAttendance() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "scheduledAts",
                        List.of(daysFromNowAt(10).toString(), daysFromNowAt(17).toString()),
                        "title",
                        "논문 읽기");

        var response =
                exchange(
                        HttpMethod.POST,
                        "/api/studies/{studyId}/meetings",
                        body,
                        LEADER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        List<StudyMeeting> created =
                studyMeetingRepo.findByStudyGroupIdOrderByScheduledAt(group.getId()).stream()
                        .filter(m -> "논문 읽기".equals(m.getTitle()))
                        .toList();
        assertThat(created).hasSize(2);
        List<StudyAttendance> attendances =
                studyAttendanceRepo.findByStudyMeetingIdIn(
                        created.stream().map(StudyMeeting::getId).toList());
        assertThat(attendances).hasSize(6);
        assertThat(attendances)
                .allSatisfy(a -> assertThat(a.getStatus()).isEqualTo(AttendanceStatus.ABSENT))
                .extracting(StudyAttendance::getAccountId)
                .containsOnly(LEADER_ID, MEMBER_ID, PAUSED_ID);
        // 첫 회차를 깔아도 모집이 닫히지 않게 STATUS 는 그대로 둔다 (스펙 결정 5)
        assertThat(studyRepo.findById(study.getId()).orElseThrow().getStatus())
                .isEqualTo(StudyStatus.OPEN);
    }

    @Test
    @DisplayName("성공 - 수정하면 시각·제목이 바뀌고 회차 ID 가 그대로라 그 회차의 휴가가 따라온다")
    void updatesMeetingKeepingAttendance() {
        excused(futureMeeting, MEMBER_ID);
        Instant moved = daysFromNowAt(4);

        var response =
                exchange(
                        HttpMethod.PUT,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        Map.of("scheduledAt", moved.toString(), "title", "옮긴 회차"),
                        LEADER_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        StudyMeeting updated = studyMeetingRepo.findById(futureMeeting.getId()).orElseThrow();
        assertThat(updated.getScheduledAt()).isEqualTo(moved);
        assertThat(updated.getTitle()).isEqualTo("옮긴 회차");
        assertThat(studyAttendanceRepo.findByStudyMeetingIdIn(List.of(futureMeeting.getId())))
                .singleElement()
                .extracting(StudyAttendance::getStatus)
                .isEqualTo(AttendanceStatus.EXCUSED);
    }

    @Test
    @DisplayName("성공 - 삭제하면 그 회차의 출석·휴가도 지운다 (외래키가 없어 DB 가 지워 주지 않는다)")
    void deletesMeetingWithAttendance() {
        excused(futureMeeting, MEMBER_ID);

        var response =
                exchange(
                        HttpMethod.DELETE,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        null,
                        LEADER_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyMeetingRepo.findById(futureMeeting.getId())).isEmpty();
        assertThat(studyAttendanceRepo.findByStudyMeetingIdIn(List.of(futureMeeting.getId())))
                .isEmpty();
    }

    @Test
    @DisplayName("성공 - 명부에 없어도 이 스터디를 만든 캡틴은 분반을 골라 오면 관리할 수 있다")
    void creatorCaptainManagesAnyGroup() {
        var response =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings?studyGroupId={groupId}",
                        null,
                        CREATOR_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> me = (Map<String, Object>) response.getBody().get("me");
        assertThat(me).containsEntry("canEdit", true);
        assertThat(me.get("participantId")).isNull();
    }

    @Test
    @DisplayName("실패 - 이 스터디를 만들지 않은 다른 캡틴(ADMIN)은 사용자 사이트에서 403 — 운영은 백오피스에서")
    void otherCaptainForbidden() {
        var response =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings?studyGroupId={groupId}",
                        null,
                        CAPTAIN_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("실패 - 명부에 없는 캡틴이 분반을 안 주면 400 — 고를 내 분반이 없다")
    void captainWithoutGroupId() {
        var response =
                exchange(
                        HttpMethod.GET,
                        "/api/studies/{studyId}/meetings",
                        null,
                        CREATOR_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패 - 토큰 없이 → 401 + errorCode UNAUTHORIZED")
    void unauthenticated() {
        var response =
                rest.getForEntity("/api/studies/{studyId}/meetings", Map.class, study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 날짜 목록이 비면 400 INVALID_INPUT")
    void emptyScheduledAts() {
        var body = Map.of("studyGroupId", group.getId(), "scheduledAts", List.of());

        var response =
                exchange(
                        HttpMethod.POST,
                        "/api/studies/{studyId}/meetings",
                        body,
                        LEADER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패 - 같은 스터디라도 다른 분반의 네비게이터는 403 — 회차는 분반에 붙어 있다")
    void otherGroupNavigatorForbidden() {
        var response =
                exchange(
                        HttpMethod.DELETE,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        null,
                        OTHER_GROUP_LEADER_ID,
                        study.getId(),
                        futureMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
    }

    @Test
    @DisplayName("실패 - 일반 크루는 회차를 추가할 수 없다 → 403")
    void memberForbidden() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "scheduledAts",
                        List.of(daysFromNowAt(10).toString()));

        var response =
                exchange(
                        HttpMethod.POST,
                        "/api/studies/{studyId}/meetings",
                        body,
                        MEMBER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("실패 - 없는 회차 → 404 NOT_FOUND")
    void missingMeeting() {
        var response =
                exchange(
                        HttpMethod.DELETE,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        null,
                        LEADER_ID,
                        study.getId(),
                        999_999L);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 시작한 회차 삭제 → 409 MEETING_ALREADY_STARTED (출석이 찍혀 있을 수 있다)")
    void startedMeetingCannotBeDeleted() {
        var response =
                exchange(
                        HttpMethod.DELETE,
                        "/api/studies/{studyId}/meetings/{meetingId}",
                        null,
                        LEADER_ID,
                        study.getId(),
                        pastMeeting.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "MEETING_ALREADY_STARTED");
    }

    @Test
    @DisplayName("실패 - 기존 회차와 같은 날 → 409 MEETING_DATE_CONFLICT")
    void sameDayConflict() {
        var body =
                Map.of(
                        "studyGroupId",
                        group.getId(),
                        "scheduledAts",
                        List.of(
                                futureMeeting
                                        .getScheduledAt()
                                        .plus(1, ChronoUnit.HOURS)
                                        .toString()));

        var response =
                exchange(
                        HttpMethod.POST,
                        "/api/studies/{studyId}/meetings",
                        body,
                        LEADER_ID,
                        study.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "MEETING_DATE_CONFLICT");
    }

    // 분반 현지 기준 n일 뒤 20:00 — 한밤 근처에서 테스트가 날짜 경계를 넘지 않게 고정 시각을 쓴다
    private static Instant daysFromNowAt(int days) {
        return LocalDate.now(SEOUL).plusDays(days).atTime(20, 0).atZone(SEOUL).toInstant();
    }

    private void excused(StudyMeeting meeting, Long accountId) {
        studyAttendanceRepo.save(
                StudyAttendance.builder()
                        .accountId(accountId)
                        .studyId(study.getId())
                        .studyGroupId(group.getId())
                        .studyMeetingId(meeting.getId())
                        .status(AttendanceStatus.EXCUSED)
                        .build());
    }

    private StudyParticipant participant(
            Long accountId, StudyGroup group, ParticipantRole role, ParticipantStatus status) {
        return studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(accountId)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(status)
                        .participantRole(role)
                        .joinedAt(Instant.now().minus(30, ChronoUnit.DAYS))
                        .build());
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> exchange(
            HttpMethod method, String url, Object body, Long accountId, Object... uriVariables) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(url, method, new HttpEntity<>(body, headers), Map.class, uriVariables);
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
