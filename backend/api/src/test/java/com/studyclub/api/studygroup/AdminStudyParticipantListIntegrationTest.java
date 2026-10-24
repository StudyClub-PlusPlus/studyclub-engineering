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
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

/** 참여 명단 ({@code GET /api/admin/studies/{studyId}/participants}) — specs/study-group/spec.md */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyParticipantListIntegrationTest {

    // auto_increment 충돌 방지 — Long.MAX_VALUE 근처의 값은 실제 시퀀스가 도달하지 않는다.
    private static final Long ADMIN_ID = Long.MAX_VALUE - 200;
    private static final Long MEMBER_ID = Long.MAX_VALUE - 201;
    private static final Long CREW_A_ID = Long.MAX_VALUE - 202;
    private static final Long CREW_B_ID = Long.MAX_VALUE - 203;
    private static final Long CREW_C_ID = Long.MAX_VALUE - 204;
    private static final Long WITHDRAWN_ID = Long.MAX_VALUE - 205;
    private static final Long DELETED_ID = Long.MAX_VALUE - 206;
    private static final long MISSING_ID = 999_999_991L;
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
    @Autowired StudyRecruitmentRepository studyRecruitmentRepo;

    private StudyProgram program;
    private Study study;
    // 가반: 기본 반(첫 반) · 나반: 명부 있음 · 다반: 탈퇴 행만 · 라반: 하차 행만 · 마반: 옛 출석만
    private StudyGroup defaultGroup;
    private StudyGroup rosterGroup;
    private StudyGroup deletedOnlyGroup;
    private StudyGroup withdrawnOnlyGroup;
    private StudyGroup attendanceGroup;
    private StudyParticipant captainRow;
    private StudyParticipant crewA;
    private StudyParticipant crewB;
    private StudyParticipant crewC;
    private StudyParticipant withdrawnRow;
    private StudyParticipant deletedRow;
    private Instant joinedAt;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccountIfAbsent(ADMIN_ID, "명단캡틴", "admin@list-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ID, "명단비캡틴", "member@list-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_A_ID, "명단다", "crew-a@list-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_B_ID, "명단나", "crew-b@list-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(CREW_C_ID, "명단가", "crew-c@list-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(WITHDRAWN_ID, "명단하차", "withdrawn@list-test.com", SystemRole.MEMBER);
        insertAccountIfAbsent(DELETED_ID, "명단탈퇴", "deleted@list-test.com", SystemRole.MEMBER);
        jdbcTemplate.update(
                "UPDATE ACCOUNT SET DISCORD_NICKNAME = ?, REGION_GROUP = ? WHERE ID = ?",
                "다/BE/서울",
                "KR",
                CREW_A_ID);
        joinedAt = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("명단 프로그램").studyKind(StudyKind.STUDY).build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("명단 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.ONGOING)
                                .createdBy(ADMIN_ID)
                                .build());
        defaultGroup = studyGroupRepo.save(StudyGroup.create(study.getId(), "가반"));
        rosterGroup = studyGroupRepo.save(StudyGroup.create(study.getId(), "나반"));
        deletedOnlyGroup = studyGroupRepo.save(StudyGroup.create(study.getId(), "다반"));
        withdrawnOnlyGroup = studyGroupRepo.save(StudyGroup.create(study.getId(), "라반"));
        attendanceGroup = studyGroupRepo.save(StudyGroup.create(study.getId(), "마반"));

        captainRow =
                saveParticipant(
                        ADMIN_ID, defaultGroup, ParticipantStatus.ACTIVE, ParticipantRole.MEMBER);
        crewA =
                saveParticipant(
                        CREW_A_ID, defaultGroup, ParticipantStatus.ACTIVE, ParticipantRole.MEMBER);
        crewB =
                saveParticipant(
                        CREW_B_ID, rosterGroup, ParticipantStatus.ACTIVE, ParticipantRole.LEADER);
        crewC =
                saveParticipant(
                        CREW_C_ID, rosterGroup, ParticipantStatus.PAUSED, ParticipantRole.MEMBER);
        withdrawnRow =
                saveParticipant(
                        WITHDRAWN_ID,
                        withdrawnOnlyGroup,
                        ParticipantStatus.WITHDRAWN,
                        ParticipantRole.MEMBER);
        deletedRow =
                saveParticipant(
                        DELETED_ID,
                        deletedOnlyGroup,
                        ParticipantStatus.DELETED,
                        ParticipantRole.MEMBER);

        // 마반: 명부는 비었지만 가반으로 옮긴 크루의 지난 출석이 남았다
        StudyMeeting meeting =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                attendanceGroup.getId(),
                                Instant.now().minusSeconds(86_400),
                                "1회차"));
        jdbcTemplate.update(
                "INSERT INTO STUDY_ATTENDANCE"
                        + " (ACCOUNT_ID, STUDY_ID, STUDY_GROUP_ID, STUDY_MEETING_ID, STATUS, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, 'PRESENT', NOW(), NOW())",
                CREW_A_ID,
                study.getId(),
                attendanceGroup.getId(),
                meeting.getId());
        // 다반: 탈퇴 회원의 출석은 세지 않는다
        StudyMeeting deletedMeeting =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                deletedOnlyGroup.getId(),
                                Instant.now().minusSeconds(86_400),
                                "1회차"));
        jdbcTemplate.update(
                "INSERT INTO STUDY_ATTENDANCE"
                        + " (ACCOUNT_ID, STUDY_ID, STUDY_GROUP_ID, STUDY_MEETING_ID, STATUS, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, 'PRESENT', NOW(), NOW())",
                DELETED_ID,
                study.getId(),
                deletedOnlyGroup.getId(),
                deletedMeeting.getId());

        // 정원은 최신 모집 회차(ID 최대)의 값
        saveRecruitment(10);
        saveRecruitment(20);
    }

    @AfterEach
    void tearDown() {
        // 파생 삭제(derived delete)는 직접 트랜잭션이 없으면 실패하므로 JDBC로 정리한다.
        jdbcTemplate.update("DELETE FROM STUDY_ATTENDANCE WHERE STUDY_ID = ?", study.getId());
        jdbcTemplate.update(
                "DELETE FROM STUDY_MEETING WHERE STUDY_GROUP_ID IN"
                        + " (SELECT ID FROM STUDY_GROUP WHERE STUDY_ID = ?)",
                study.getId());
        jdbcTemplate.update("DELETE FROM STUDY_PARTICIPANT WHERE STUDY_ID = ?", study.getId());
        jdbcTemplate.update("DELETE FROM STUDY_GROUP WHERE STUDY_ID = ?", study.getId());
        jdbcTemplate.update("DELETE FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?", study.getId());
        studyRepo.delete(study);
        studyProgramRepo.delete(program);
    }

    @Test
    @DisplayName("성공 - 필드 · 정렬(네비게이터 → 반 이름 → 닉네임) · 기본은 ACTIVE · PAUSED 만")
    @SuppressWarnings("unchecked")
    void listsCurrentParticipants() {
        var response = get(ADMIN_ID, study.getId(), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(((Number) body.get("studyId")).longValue()).isEqualTo(study.getId());
        assertThat(body)
                .containsEntry("participantCount", 4)
                .containsEntry("recruitmentCapacity", 20);

        List<Map<String, Object>> participants =
                (List<Map<String, Object>>) body.get("participants");
        assertThat(participants)
                .extracting(p -> ((Number) p.get("participantId")).longValue())
                .containsExactly(crewB.getId(), crewA.getId(), captainRow.getId(), crewC.getId());

        Map<String, Object> a = participants.get(1);
        assertThat(((Number) a.get("accountId")).longValue()).isEqualTo(CREW_A_ID);
        assertThat(a)
                .containsEntry("nickname", "명단다")
                .containsEntry("discordNickname", "다/BE/서울")
                .containsEntry("email", "crew-a@list-test.com")
                .containsEntry("regionGroup", "KR")
                .containsEntry("participantRole", "MEMBER")
                .containsEntry("status", "ACTIVE")
                .containsEntry("captain", false);
        assertThat(((Number) a.get("groupId")).longValue()).isEqualTo(defaultGroup.getId());
        assertThat(Instant.parse((String) a.get("joinedAt"))).isEqualTo(joinedAt);

        assertThat(participants.get(0)).containsEntry("participantRole", "LEADER");
        assertThat(participants.get(3)).containsEntry("status", "PAUSED");
        assertThat(participants.get(3)).containsEntry("discordNickname", null);
    }

    @Test
    @DisplayName("성공 - 담당 캡틴(STUDY.CREATED_BY) 행만 captain=true")
    @SuppressWarnings("unchecked")
    void marksCaptain() {
        var participants =
                (List<Map<String, Object>>)
                        get(ADMIN_ID, study.getId(), null).getBody().get("participants");

        assertThat(participants)
                .filteredOn(p -> Boolean.TRUE.equals(p.get("captain")))
                .extracting(p -> ((Number) p.get("accountId")).longValue())
                .containsExactly(ADMIN_ID);
    }

    @Test
    @DisplayName("성공 - includeLeft=true 면 WITHDRAWN 도 준다. DELETED 는 늘 빼고 인원은 그대로")
    @SuppressWarnings("unchecked")
    void includeLeft() {
        var body = get(ADMIN_ID, study.getId(), true).getBody();

        List<Map<String, Object>> participants =
                (List<Map<String, Object>>) body.get("participants");
        assertThat(participants)
                .extracting(p -> ((Number) p.get("participantId")).longValue())
                .containsExactly(
                        crewB.getId(),
                        crewA.getId(),
                        captainRow.getId(),
                        crewC.getId(),
                        withdrawnRow.getId())
                .doesNotContain(deletedRow.getId());
        assertThat(participants.getLast()).containsEntry("status", "WITHDRAWN");
        assertThat(body).containsEntry("participantCount", 4);

        var defaults =
                (List<Map<String, Object>>)
                        get(ADMIN_ID, study.getId(), false).getBody().get("participants");
        assertThat(defaults)
                .extracting(p -> ((Number) p.get("participantId")).longValue())
                .doesNotContain(withdrawnRow.getId(), deletedRow.getId());
    }

    @Test
    @DisplayName("성공 - groups 는 ID 순, isDefault · canDelete 는 반 삭제와 같은 판정")
    @SuppressWarnings("unchecked")
    void groupsCanDelete() {
        var groups =
                (List<Map<String, Object>>)
                        get(ADMIN_ID, study.getId(), null).getBody().get("groups");

        assertThat(groups)
                .extracting(g -> g.get("name"))
                .containsExactly("가반", "나반", "다반", "라반", "마반");
        assertThat(groups)
                .extracting(g -> ((Number) g.get("groupId")).longValue())
                .containsExactly(
                        defaultGroup.getId(),
                        rosterGroup.getId(),
                        deletedOnlyGroup.getId(),
                        withdrawnOnlyGroup.getId(),
                        attendanceGroup.getId());
        assertThat(groups)
                .extracting(g -> g.get("isDefault"))
                .containsExactly(true, false, false, false, false);
        // 기본 반 · 명부 · 하차 행 · 옛 출석은 막고, 탈퇴 행 · 탈퇴 회원 출석만 남은 반은 지울 수 있다
        assertThat(groups)
                .extracting(g -> g.get("canDelete"))
                .containsExactly(false, false, true, false, false);

        // canDelete 가 true 인 반만 실제로 지워진다
        assertThat(adminDelete(withdrawnOnlyGroup).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(adminDelete(attendanceGroup).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(adminDelete(deletedOnlyGroup).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    @DisplayName("성공 - 모집 회차가 없으면 recruitmentCapacity null")
    void noRecruitment() {
        jdbcTemplate.update("DELETE FROM STUDY_RECRUITMENT WHERE STUDY_ID = ?", study.getId());

        var body = get(ADMIN_ID, study.getId(), null).getBody();

        assertThat(body).containsEntry("recruitmentCapacity", null);
    }

    @Test
    @DisplayName("실패 - 없는 스터디 → 404 NOT_FOUND")
    void studyNotFound() {
        var response = get(ADMIN_ID, MISSING_ID, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403, 토큰 없으면 401")
    void permission() {
        assertThat(get(MEMBER_ID, study.getId(), null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get(null, study.getId(), null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ── 헬퍼 ─────────────────────────────────────────────────────────────────

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ResponseEntity<Map<String, Object>> get(
            Long accountId, Object studyId, Boolean includeLeft) {
        HttpHeaders headers = new HttpHeaders();
        if (accountId != null) {
            String email = accountRepository.findById(accountId).orElseThrow().getEmail();
            headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        }
        String url = includeLeft == null ? URL : URL + "?includeLeft=" + includeLeft;
        ResponseEntity<Map> response =
                rest.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class, studyId);
        return (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) response;
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> adminDelete(StudyGroup target) {
        HttpHeaders headers = new HttpHeaders();
        String email = accountRepository.findById(ADMIN_ID).orElseThrow().getEmail();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(ADMIN_ID), email));
        return rest.exchange(
                "/api/admin/studies/{studyId}/groups/{groupId}",
                HttpMethod.DELETE,
                new HttpEntity<>(headers),
                Map.class,
                study.getId(),
                target.getId());
    }

    private StudyParticipant saveParticipant(
            Long accountId, StudyGroup group, ParticipantStatus status, ParticipantRole role) {
        return studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(accountId)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(status)
                        .participantRole(role)
                        .joinedAt(joinedAt)
                        .build());
    }

    private void saveRecruitment(int capacity) {
        studyRecruitmentRepo.save(
                StudyRecruitment.builder()
                        .studyId(study.getId())
                        .title("모집")
                        .description("설명")
                        .startAt(Instant.now().minusSeconds(3600))
                        .recruitDeadlineAt(Instant.now().plusSeconds(3600))
                        .recruitmentCapacity(capacity)
                        .build());
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
