package com.studyclub.api.studygroup;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashMap;
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
 * 반 수정 ({@code PATCH /api/admin/studies/{studyId}/groups/{groupId}}) — specs/study-group/spec.md.
 * 이름 · 요일 · 시간대를 각각 독립적으로 보낼 수 있다(보낸 필드만 반영).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminStudyGroupUpdateIntegrationTest {

    private static final Long ADMIN_ID = 8605L;
    private static final Long MEMBER_ID = 8606L;
    private static final long MISSING_ID = 999_999_995L;
    private static final String URL = "/api/admin/studies/{studyId}/groups/{groupId}";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;

    private Study study;
    private StudyGroup group;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        insertAccountIfAbsent(ADMIN_ID, "수정캡틴", "admin@group-update-test.com", SystemRole.ADMIN);
        insertAccountIfAbsent(MEMBER_ID, "수정크루", "member@group-update-test.com", SystemRole.MEMBER);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("수정 프로그램").studyKind(StudyKind.STUDY).build());
        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("반 수정 테스트")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.DRAFT)
                                .createdBy(ADMIN_ID)
                                .build());
        group = studyGroupRepo.save(StudyGroup.create(study.getId(), "원래반"));
    }

    @Test
    @DisplayName("성공 - 이름을 바꾼다. 앞뒤 공백을 잘라 저장한다")
    void updatesName() {
        var response = patch(Map.of("name", "  새이름  "), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("groupId", group.getId().intValue())
                .containsEntry("name", "새이름");
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("새이름");
    }

    @Test
    @DisplayName("성공 - 같은 이름(대소문자 포함)으로 보내면 중복 검사 없이 그대로 200")
    void sameNameIsAllowed() {
        var response = patch(Map.of("name", "원래반"), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("원래반");
    }

    @Test
    @DisplayName("실패 - 같은 스터디의 다른 반과 이름이 겹치면 409 CONFLICT")
    void duplicateNameWithOtherGroup() {
        studyGroupRepo.save(StudyGroup.create(study.getId(), "B반"));

        var response = patch(Map.of("name", "B반"), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "CONFLICT");
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("원래반");
    }

    @Test
    @DisplayName("실패 - 이름이 공백뿐이거나 21자면 400 INVALID_INPUT")
    void invalidName() {
        var blank = patch(Map.of("name", "   "), ADMIN_ID, study.getId(), group.getId());
        assertThat(blank.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(blank.getBody()).containsEntry("errorCode", "INVALID_INPUT");

        var tooLong = patch(Map.of("name", "가".repeat(21)), ADMIN_ID, study.getId(), group.getId());
        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooLong.getBody()).containsEntry("errorCode", "INVALID_INPUT");

        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getName()).isEqualTo("원래반");
    }

    @Test
    @DisplayName("실패 - 없는 반 → 404 NOT_FOUND")
    void missingGroup() {
        var response = patch(Map.of("name", "새이름"), ADMIN_ID, study.getId(), MISSING_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("성공 - 요일을 저장한다")
    void updatesDaysOfWeek() {
        var response =
                patch(
                        Map.of("daysOfWeek", List.of("mon", "wed")),
                        ADMIN_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("daysOfWeek", List.of("mon", "wed"));
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getDaysOfWeek())
                .isEqualTo(List.of("mon", "wed"));
    }

    @Test
    @DisplayName("성공 - daysOfWeek · timezone · startTime null 이면 기존 값 그대로")
    void nullFieldsAreIgnored() {
        group.changeDaysOfWeek(List.of("mon"));
        group.changeTimezone("Asia/Seoul");
        group.changeStartAt(
                LocalTime.parse("20:00")
                        .atDate(LocalDate.EPOCH)
                        .atZone(ZoneId.of("Asia/Seoul"))
                        .toInstant());
        studyGroupRepo.saveAndFlush(group);

        var body = new HashMap<String, Object>();
        body.put("daysOfWeek", null);
        body.put("timezone", null);
        body.put("startTime", null);
        var response = patch(body, ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var saved = studyGroupRepo.findById(group.getId()).orElseThrow();
        assertThat(saved.getDaysOfWeek()).isEqualTo(List.of("mon"));
        assertThat(saved.getTimezone()).isEqualTo("Asia/Seoul");
        assertThat(saved.getStartAt()).isNotNull();
    }

    @Test
    @DisplayName("실패 - 유효하지 않은 요일 값이면 400 INVALID_INPUT")
    void invalidDayOfWeek() {
        var response =
                patch(
                        Map.of("daysOfWeek", List.of("monday")),
                        ADMIN_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("실패 - 빈 요일 목록은 400 INVALID_INPUT")
    void emptyDaysOfWeek() {
        var response =
                patch(Map.of("daysOfWeek", List.of()), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("성공 - 시간대를 저장한다")
    void updatesTimezone() {
        var response =
                patch(
                        Map.of("timezone", "America/New_York"),
                        ADMIN_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("timezone", "America/New_York");
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getTimezone())
                .isEqualTo("America/New_York");
    }

    @Test
    @DisplayName("실패 - 허용되지 않은 시간대면 400 INVALID_INPUT")
    void invalidTimezone() {
        var response =
                patch(Map.of("timezone", "Europe/Paris"), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("성공 - 이름·요일·시간대를 한 번에 바꾼다")
    void updatesAllFields() {
        var response =
                patch(
                        Map.of(
                                "name", "새이름",
                                "daysOfWeek", List.of("tue", "fri"),
                                "timezone", "America/Vancouver"),
                        ADMIN_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var saved = studyGroupRepo.findById(group.getId()).orElseThrow();
        assertThat(saved.getName()).isEqualTo("새이름");
        assertThat(saved.getDaysOfWeek()).isEqualTo(List.of("tue", "fri"));
        assertThat(saved.getTimezone()).isEqualTo("America/Vancouver");
    }

    @Test
    @DisplayName("성공 - startTime 과 timezone 을 함께 보내 저장한다")
    void updatesStartTime() {
        var response =
                patch(
                        Map.of("startTime", "20:30", "timezone", "Asia/Seoul"),
                        ADMIN_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("startTime", "20:30");
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getStartAt()).isNotNull();
    }

    @Test
    @DisplayName("성공 - timezone 없이 startTime 만 보내면 기본 시간대(Asia/Seoul)로 저장한다")
    void startTimeWithoutTimezoneUsesDefault() {
        var response = patch(Map.of("startTime", "20:00"), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(studyGroupRepo.findById(group.getId()).orElseThrow().getStartAt()).isNotNull();
    }

    @Test
    @DisplayName("실패 - startTime 형식이 잘못되면 400 INVALID_INPUT")
    void invalidStartTime() {
        var response =
                patch(
                        Map.of("startTime", "9:00", "timezone", "Asia/Seoul"),
                        ADMIN_ID,
                        study.getId(),
                        group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    @Test
    @DisplayName("성공 - 이름만 보내면 요일·시간대는 그대로")
    void nameOnlyDoesNotClearOthers() {
        group.changeDaysOfWeek(List.of("sat"));
        group.changeTimezone("Asia/Seoul");
        studyGroupRepo.saveAndFlush(group);

        var response = patch(Map.of("name", "새이름2"), ADMIN_ID, study.getId(), group.getId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var saved = studyGroupRepo.findById(group.getId()).orElseThrow();
        assertThat(saved.getDaysOfWeek()).isEqualTo(List.of("sat"));
        assertThat(saved.getTimezone()).isEqualTo("Asia/Seoul");
    }

    @Test
    @DisplayName("실패 - 캡틴이 아니면 403, 토큰이 없으면 401")
    void permission() {
        var member = patch(Map.of("name", "새이름"), MEMBER_ID, study.getId(), group.getId());
        assertThat(member.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(member.getBody()).containsEntry("errorCode", "FORBIDDEN");

        var anonymous = patch(Map.of("name", "새이름"), null, study.getId(), group.getId());
        assertThat(anonymous.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(anonymous.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @SuppressWarnings({"rawtypes"})
    private ResponseEntity<Map> patch(Object body, Long accountId, Object studyId, Object groupId) {
        HttpHeaders headers = new HttpHeaders();
        if (accountId != null) {
            String email = accountRepository.findById(accountId).orElseThrow().getEmail();
            headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(
                URL,
                HttpMethod.PATCH,
                new HttpEntity<>(body, headers),
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
