package com.studyclub.api.studygroup;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
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
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 킥오프 정하기 ({@code PUT /api/admin/studies/{studyId}/groups/{groupId}/kickoff}) —
 * specs/study-meeting/spec.md 결정 11
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyGroupKickoffIntegrationTest {

    private static final Long ADMIN_ID = 8607L;
    private static final Long MEMBER_ID = 8608L;
    private static final long MISSING_ID = 999_999_994L;
    private static final String URL = "/api/admin/studies/{studyId}/groups/{groupId}/kickoff";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;
    @Autowired StudyMeetingRepository studyMeetingRepo;
    @Autowired StudyAttendanceRepository studyAttendanceRepo;

    private Study study;
    private StudyGroup group;
    private StudyMeeting firstRegular;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccountIfAbsent(ADMIN_ID, "킥오프캡틴", "admin@kickoff-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ID, "킥오프크루", "member@kickoff-test.com", SystemRole.MEMBER);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder()
                                .title("킥오프 프로그램")
                                .studyKind(StudyKind.STUDY)
                                .build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("킥오프 테스트")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.OPEN)
                                .createdBy(ADMIN_ID)
                                .build());
        group = studyGroupRepo.save(StudyGroup.create(study.getId(), "킥오프반"));
        firstRegular =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().plus(10, ChronoUnit.DAYS), null));
    }

    @Test
    @DisplayName("성공 - 킥오프 없는 반에 정하면 0회차를 만든다. 지난 시각도 받고, 출석 행은 깔지 않는다")
    void createsKickoff() {
        Instant at = Instant.now().minus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

        var response = put(Map.of("scheduledAt", at.toString()), ADMIN_ID, group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        List<StudyMeeting> kickoffs = kickoffs();
        assertThat(kickoffs).hasSize(1);
        assertThat(kickoffs.get(0).getScheduledAt()).isEqualTo(at);
        assertThat(kickoffs.get(0).getTitle()).isEqualTo("킥오프");
        assertThat(studyAttendanceRepo.findByStudyMeetingIdIn(List.of(kickoffs.get(0).getId())))
                .isEmpty();
    }

    @Test
    @DisplayName("성공 - 킥오프가 있으면 새로 만들지 않고 일자만 옮긴다 — 회차 ID 가 그대로라 찍은 출석이 따라온다")
    void movesExistingKickoff() {
        StudyMeeting kickoff =
                studyMeetingRepo.save(
                        StudyMeeting.kickoff(
                                group.getId(), Instant.now().plus(2, ChronoUnit.DAYS)));
        Instant at = Instant.now().plus(5, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);

        var response = put(Map.of("scheduledAt", at.toString()), ADMIN_ID, group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        List<StudyMeeting> kickoffs = kickoffs();
        assertThat(kickoffs).extracting(StudyMeeting::getId).containsExactly(kickoff.getId());
        assertThat(kickoffs.get(0).getScheduledAt()).isEqualTo(at);
    }

    @Test
    @DisplayName("실패 - 1회차 날이나 그 뒤로 정하면 400 INVALID_INPUT")
    void mustPrecedeFirstRegular() {
        var response =
                put(
                        Map.of("scheduledAt", firstRegular.getScheduledAt().toString()),
                        ADMIN_ID,
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(kickoffs()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 시각이 없으면 400, 없는 반이면 404")
    void invalidInput() {
        var missingAt = put(Map.of(), ADMIN_ID, group.getId());
        assertThat(missingAt.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(missingAt.getBody()).containsEntry("errorCode", "INVALID_INPUT");

        var missingGroup =
                put(Map.of("scheduledAt", Instant.now().toString()), ADMIN_ID, MISSING_ID);
        assertThat(missingGroup.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(missingGroup.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403, 토큰이 없으면 401")
    void permission() {
        var body = Map.of("scheduledAt", Instant.now().toString());

        var member = put(body, MEMBER_ID, group.getId());
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(member.getBody()).containsEntry("errorCode", "FORBIDDEN");

        var anonymous = put(body, null, group.getId());
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(anonymous.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    private List<StudyMeeting> kickoffs() {
        return studyMeetingRepo.findByStudyGroupIdOrderByScheduledAt(group.getId()).stream()
                .filter(StudyMeeting::isKickoff)
                .toList();
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> put(Object body, Long accountId, Object groupId) {
        HttpHeaders headers = new HttpHeaders();
        if (accountId != null) {
            String email = accountRepository.findById(accountId).orElseThrow().getEmail();
            headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                URL,
                HttpMethod.PUT,
                new HttpEntity<>(body, headers),
                Map.class,
                study.getId(),
                groupId);
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
