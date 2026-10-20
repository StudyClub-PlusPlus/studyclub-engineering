package com.studyclub.api.studygroup;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
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
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 반 삭제 ({@code DELETE /api/admin/studies/{studyId}/groups/{groupId}}) — specs/study-group/spec.md
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyGroupDeleteIntegrationTest {

    private static final Long ADMIN_ID = 8603L;
    private static final Long MEMBER_ID = 8604L;
    private static final long MISSING_ID = 999_999_996L;
    private static final String URL = "/api/admin/studies/{studyId}/groups/{groupId}";

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

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccountIfAbsent(ADMIN_ID, "삭제캡틴", "admin@group-delete-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ID, "삭제크루", "member@group-delete-test.com", SystemRole.MEMBER);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("삭제 프로그램").studyKind(StudyKind.STUDY).build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("반 삭제 테스트")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.DRAFT)
                                .createdBy(ADMIN_ID)
                                .build());
        group = studyGroupRepo.save(StudyGroup.create(study.getId(), "삭제반"));
    }

    @Test
    @DisplayName("성공 - 빈 반 삭제 → 204, 반·회차·출석 모두 사라진다")
    void deletesEmptyGroup() {
        StudyMeeting meeting =
                studyMeetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().plusSeconds(3600), "1회차"));
        jdbcTemplate.update(
                "INSERT INTO STUDY_ATTENDANCE"
                        + " (ACCOUNT_ID, STUDY_ID, STUDY_GROUP_ID, STUDY_MEETING_ID, STATUS, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, 'PRESENT', NOW(), NOW())",
                ADMIN_ID,
                study.getId(),
                group.getId(),
                meeting.getId());

        var response = delete(ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(studyGroupRepo.findById(group.getId())).isEmpty();
        assertThat(studyMeetingRepo.findByStudyGroupIdOrderByScheduledAt(group.getId())).isEmpty();
        assertThat(studyAttendanceRepo.findByStudyMeetingIdIn(java.util.List.of(meeting.getId())))
                .isEmpty();
    }

    @Test
    @DisplayName("실패 - 활성 크루가 있으면 409 GROUP_NOT_EMPTY")
    void rejectsNonEmptyGroup() {
        studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(MEMBER_ID)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now())
                        .build());

        var response = delete(ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "GROUP_NOT_EMPTY");
        assertThat(studyGroupRepo.findById(group.getId())).isPresent();
    }

    @Test
    @DisplayName("실패 - PAUSED 크루도 활성으로 간주해 409 GROUP_NOT_EMPTY")
    void rejectsPausedParticipant() {
        studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(MEMBER_ID)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(ParticipantStatus.PAUSED)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now())
                        .build());

        var response = delete(ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "GROUP_NOT_EMPTY");
    }

    @Test
    @DisplayName("실패 - COMPLETED 크루가 있어도 409 GROUP_NOT_EMPTY — 수료 기록의 반이 사라지지 않게")
    void rejectsCompletedParticipant() {
        studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(MEMBER_ID)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(ParticipantStatus.COMPLETED)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now())
                        .build());

        var response = delete(ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "GROUP_NOT_EMPTY");
        assertThat(studyGroupRepo.findById(group.getId())).isPresent();
    }

    @Test
    @DisplayName("실패 - WITHDRAWN(참여 중단) 크루가 있어도 409 GROUP_NOT_EMPTY")
    void rejectsWithdrawnParticipant() {
        studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(MEMBER_ID)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(ParticipantStatus.WITHDRAWN)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now())
                        .build());

        var response = delete(ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "GROUP_NOT_EMPTY");
        assertThat(studyGroupRepo.findById(group.getId())).isPresent();
    }

    @Test
    @DisplayName("실패 - 없는 반 → 404 NOT_FOUND")
    void missingGroup() {
        var response = delete(ADMIN_ID, study.getId(), MISSING_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 - 다른 스터디의 반 ID → 404 NOT_FOUND")
    void groupBelongsToOtherStudy() {
        var otherProgram =
                studyProgramRepo.save(
                        StudyProgram.builder().title("다른 프로그램").studyKind(StudyKind.STUDY).build());
        var otherStudy =
                studyRepo.save(
                        Study.builder()
                                .programId(otherProgram.getId())
                                .title("다른 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.DRAFT)
                                .createdBy(ADMIN_ID)
                                .build());

        var response = delete(ADMIN_ID, otherStudy.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
        assertThat(studyGroupRepo.findById(group.getId())).isPresent();
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403, 토큰이 없으면 401")
    void permission() {
        var member = delete(MEMBER_ID, study.getId(), group.getId());
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(member.getBody()).containsEntry("errorCode", "FORBIDDEN");

        var anonymous = delete(null, study.getId(), group.getId());
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(anonymous.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> delete(Long accountId, Object studyId, Object groupId) {
        HttpHeaders headers = new HttpHeaders();
        if (accountId != null) {
            String email = accountRepository.findById(accountId).orElseThrow().getEmail();
            headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        }
        return rest.exchange(
                URL,
                HttpMethod.DELETE,
                new HttpEntity<>(null, headers),
                Map.class,
                studyId,
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
