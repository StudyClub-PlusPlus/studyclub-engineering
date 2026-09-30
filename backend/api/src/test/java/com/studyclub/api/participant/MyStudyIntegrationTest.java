package com.studyclub.api.participant;

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
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 내 스터디 목록({@code GET /api/me/studies}) — specs/my-studies/spec.md. 인증·온보딩 실패는 {@link
 * ParticipantHubIntegrationTest}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class MyStudyIntegrationTest {

    private static final Long MEMBER_ID = 8600L;
    private static final Long OTHER_ID = 8601L;
    private static final Duration DAY = Duration.ofDays(1);
    private static final String DISCORD_URL = "https://discord.com/channels/1/2";
    private static final String DRIVE_URL = "https://drive.google.com/drive/folders/my-studies";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyGroupRepository studyGroupRepository;
    @Autowired StudyMeetingRepository studyMeetingRepository;
    @Autowired StudyParticipantRepository studyParticipantRepository;
    @Autowired StudyAttendanceRepository studyAttendanceRepository;

    private final Instant now = Instant.now();

    @BeforeEach
    void setUp() {
        insertAccountIfAbsent(MEMBER_ID);
        insertAccountIfAbsent(OTHER_ID);
        for (Long id : List.of(MEMBER_ID, OTHER_ID)) {
            jdbcTemplate.update("DELETE FROM STUDY_ATTENDANCE WHERE ACCOUNT_ID = ?", id);
            jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE ACCOUNT_ID = ?", id);
        }
    }

    @Test
    @DisplayName("성공 - 명부 상태와 시작일로 시작전·참여중·완주·참여 종료를 나누고, 참여 종료에는 링크를 비운다")
    void splitsRelationsAndHidesLinksFromWithdrawn() {
        Long upcoming = enroll("시작 전", now.plus(DAY.multipliedBy(7)), ParticipantStatus.ACTIVE);
        Long ongoing = enroll("진행 중", now.minus(DAY.multipliedBy(7)), ParticipantStatus.ACTIVE);
        Long completed = enroll("완주", now.minus(DAY.multipliedBy(60)), ParticipantStatus.COMPLETED);
        Long withdrawn =
                enroll("참여 중단", now.minus(DAY.multipliedBy(30)), ParticipantStatus.WITHDRAWN);

        List<Map<String, Object>> items = items(MEMBER_ID);

        assertThat(items).hasSize(4);
        assertThat(item(items, upcoming)).containsEntry("relation", "UPCOMING");
        assertThat(item(items, ongoing))
                .containsEntry("relation", "ONGOING")
                .containsEntry("discordChannelUrl", DISCORD_URL);
        assertThat(item(items, completed))
                .containsEntry("relation", "COMPLETED")
                .containsEntry("driveUrl", DRIVE_URL);
        assertThat(item(items, withdrawn))
                .containsEntry("relation", "WITHDRAWN")
                .containsEntry("discordChannelUrl", null)
                .containsEntry("driveUrl", null);
        // 시작일 최신순
        assertThat(items).extracting(i -> i.get("title")).first().isEqualTo("시작 전");
    }

    @Test
    @DisplayName("성공 - 회차마다 내 출석을 붙이고, 시작 전 결석은 비우고 사전 휴가는 남긴다")
    void attachesMyAttendancePerMeeting() {
        Long studyId = enroll("출석 격자", now.minus(DAY.multipliedBy(14)), ParticipantStatus.ACTIVE);
        StudyParticipant me = participant(MEMBER_ID, studyId);
        // me 는 10일 전에 편입했다. 회차 번호가 저장 순서가 아니라 예정 시각 순서인지 보려고 섞어서 만든다
        Long late = meeting(me, now.minus(DAY), true);
        Long laterExcused = meeting(me, now.plus(DAY.multipliedBy(8)), false);
        Long beforeJoin = meeting(me, now.minus(DAY.multipliedBy(12)), true);
        Long nextAbsent = meeting(me, now.plus(DAY), false);
        Long present = meeting(me, now.minus(DAY.multipliedBy(7)), true);
        attend(me, present, AttendanceStatus.PRESENT);
        attend(me, late, AttendanceStatus.LATE);
        attend(me, nextAbsent, AttendanceStatus.ABSENT);
        attend(me, laterExcused, AttendanceStatus.EXCUSED);

        Map<String, Object> study = item(items(MEMBER_ID), studyId);
        List<Map<String, Object>> meetings = meetings(study);

        assertThat(meetings)
                .extracting(m -> ((Number) m.get("meetingId")).longValue())
                .containsExactly(beforeJoin, present, late, nextAbsent, laterExcused);
        assertThat(meetings).extracting(m -> m.get("sequence")).containsExactly(1, 2, 3, 4, 5);
        assertThat(meeting(meetings, beforeJoin))
                .containsEntry("attendanceStatus", null)
                .containsEntry("countedInRate", false);
        assertThat(meeting(meetings, present))
                .containsEntry("attendanceStatus", "PRESENT")
                .containsEntry("countedInRate", true);
        assertThat(meeting(meetings, late)).containsEntry("attendanceStatus", "LATE");
        assertThat(meeting(meetings, nextAbsent))
                .containsEntry("attendanceStatus", null)
                .containsEntry("countedInRate", false);
        assertThat(meeting(meetings, laterExcused))
                .containsEntry("attendanceStatus", "EXCUSED")
                .containsEntry("countedInRate", false);
        // 센 회차는 출석·지각 두 개 → (1 + 0.5) / 2
        assertThat(study).containsEntry("attendanceRate", 0.75);
    }

    @Test
    @DisplayName("성공 - 같은 반 다른 회원의 출석은 내 회차 칸에 섞이지 않는다")
    void excludesOtherMembersAttendance() {
        Long studyId = enroll("같은 반", now.minus(DAY.multipliedBy(7)), ParticipantStatus.ACTIVE);
        StudyParticipant me = participant(MEMBER_ID, studyId);
        StudyParticipant other =
                studyParticipantRepository.save(
                        StudyParticipant.builder()
                                .accountId(OTHER_ID)
                                .studyId(studyId)
                                .studyGroupId(me.getStudyGroupId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(now.minus(DAY.multipliedBy(10)))
                                .build());
        Long meetingId = meeting(me, now.minus(DAY), true);
        attend(me, meetingId, AttendanceStatus.ABSENT);
        attend(other, meetingId, AttendanceStatus.PRESENT);

        List<Map<String, Object>> mine = items(MEMBER_ID);
        List<Map<String, Object>> others = items(OTHER_ID);

        assertThat(mine).hasSize(1);
        assertThat(meeting(meetings(item(mine, studyId)), meetingId))
                .containsEntry("attendanceStatus", "ABSENT");
        assertThat(meeting(meetings(item(others, studyId)), meetingId))
                .containsEntry("attendanceStatus", "PRESENT");
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** 스터디 · 반 · MEMBER_ID 명부 한 줄. 명부 편입은 10일 전. */
    private Long enroll(String title, Instant startAt, ParticipantStatus status) {
        Study study =
                studyRepository.save(
                        Study.builder()
                                .programId(1L)
                                .slug("my-studies-" + UUID.randomUUID())
                                .title(title)
                                .oneLineSummary("소개")
                                .category(StudyCategory.SOFTWARE)
                                .studyKind(StudyKind.STUDY)
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.ONGOING)
                                .startAt(startAt)
                                .discordChannelUrl(DISCORD_URL)
                                .driveUrl(DRIVE_URL)
                                .build());
        StudyGroup group =
                studyGroupRepository.save(
                        new StudyGroup(study.getId(), "수요일반", startAt, "Asia/Seoul", 10));
        studyParticipantRepository.save(
                StudyParticipant.builder()
                        .accountId(MEMBER_ID)
                        .studyId(study.getId())
                        .studyGroupId(group.getId())
                        .status(status)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(now.minus(DAY.multipliedBy(10)))
                        .build());
        return study.getId();
    }

    private StudyParticipant participant(Long accountId, Long studyId) {
        return studyParticipantRepository.findByAccountId(accountId).stream()
                .filter(p -> p.getStudyId().equals(studyId))
                .findFirst()
                .orElseThrow();
    }

    private Long meeting(StudyParticipant p, Instant scheduledAt, boolean held) {
        return studyMeetingRepository
                .save(
                        new StudyMeeting(
                                p.getStudyGroupId(),
                                scheduledAt,
                                held ? scheduledAt : null,
                                held ? scheduledAt.plus(Duration.ofHours(2)) : null))
                .getId();
    }

    private void attend(StudyParticipant p, Long meetingId, AttendanceStatus status) {
        studyAttendanceRepository.save(
                StudyAttendance.builder()
                        .accountId(p.getAccountId())
                        .studyId(p.getStudyId())
                        .studyGroupId(p.getStudyGroupId())
                        .studyMeetingId(meetingId)
                        .status(status)
                        .build());
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> items(Long accountId) {
        HttpHeaders headers = new HttpHeaders();
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        headers.setBearerAuth(jwtService.issueAccess(String.valueOf(accountId), email));
        ResponseEntity<Map> response =
                rest.exchange(
                        "/api/me/studies", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return (List<Map<String, Object>>) response.getBody().get("items");
    }

    private static Map<String, Object> item(List<Map<String, Object>> items, Long studyId) {
        return items.stream()
                .filter(i -> ((Number) i.get("studyId")).longValue() == studyId)
                .findFirst()
                .orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> meetings(Map<String, Object> study) {
        return (List<Map<String, Object>>) study.get("meetings");
    }

    private static Map<String, Object> meeting(List<Map<String, Object>> meetings, Long id) {
        return meetings.stream()
                .filter(m -> ((Number) m.get("meetingId")).longValue() == id)
                .findFirst()
                .orElseThrow();
    }

    private void insertAccountIfAbsent(Long id) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        Timestamp ts = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                "my-studies-" + id + "@example.test",
                "my_studies_" + id,
                SystemRole.MEMBER.name(),
                "Asia/Seoul",
                ts,
                ts,
                ts);
    }
}
