package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/** HTTP 표면 — 서비스 키 인증과 응답 모양. 회차 선택 규칙의 세부는 {@link DiscordAttendanceServiceTest} 가 본다. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "discord.api-key=" + DiscordAttendanceIntegrationTest.API_KEY)
@AutoConfigureTestRestTemplate
class DiscordAttendanceIntegrationTest {

    static final String API_KEY = "discord-integration-test-key";

    private static final String DISCORD_STUDY_ID = "1327394882193883136";
    private static final String LEADER_DISCORD_ID = "1327394882193880001";
    private static final String MEMBER_DISCORD_ID = "1327394882193880002";
    private static final String STRANGER_DISCORD_ID = "1327394882193880009";
    private static final Long LEADER_ACCOUNT_ID = 4001L;
    private static final Long MEMBER_ACCOUNT_ID = 4002L;

    @Autowired TestRestTemplate rest;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;
    @Autowired StudyMeetingRepository studyMeetingRepo;
    @Autowired StudyParticipantRepository studyParticipantRepo;
    @Autowired StudyAttendanceRepository studyAttendanceRepo;
    @Autowired StudyDiscordLinkRepository studyDiscordLinkRepo;

    private StudyMeeting meeting;

    @BeforeEach
    void setUp() {
        studyAttendanceRepo.deleteAll();
        studyParticipantRepo.deleteAll();
        studyMeetingRepo.deleteAll();
        studyDiscordLinkRepo.deleteAll();
        studyGroupRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();

        insertAccount(LEADER_ACCOUNT_ID, "반장", "leader@discord-test.com", LEADER_DISCORD_ID);
        insertAccount(MEMBER_ACCOUNT_ID, "멤버", "member@discord-test.com", MEMBER_DISCORD_ID);

        var program = studyProgramRepo.save(StudyProgram.builder().title("디스코드 프로그램").build());
        var study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .slug("discord-test-study")
                                .title("디스코드 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.CS)
                                .studyKind(StudyKind.STUDY)
                                .description("설명")
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.OPEN)
                                .capacity(10)
                                .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                                .build());
        var group =
                studyGroupRepo.save(
                        new StudyGroup(
                                study.getId(),
                                "A반",
                                Instant.now().minus(21, ChronoUnit.DAYS),
                                "Asia/Seoul",
                                10));
        studyDiscordLinkRepo.save(
                new StudyDiscordLink(study.getId(), DISCORD_STUDY_ID, "1327394882193883140"));

        // 진행 중인 회차 하나 — 시작했고 끝나지 않았다.
        meeting =
                studyMeetingRepo.save(
                        new StudyMeeting(
                                group.getId(),
                                Instant.now().minus(30, ChronoUnit.MINUTES),
                                Instant.now().minus(25, ChronoUnit.MINUTES),
                                null));

        Instant joinedAt = Instant.now().minus(21, ChronoUnit.DAYS);
        studyParticipantRepo.save(
                StudyParticipant.builder()
                        .accountId(LEADER_ACCOUNT_ID)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(ParticipantRole.LEADER)
                        .joinedAt(joinedAt)
                        .build());
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
    @DisplayName("성공_보이스_참가자는_출석되고_미연동_유저는_unmatched_로_돌아온다")
    void 성공_보이스_참가자는_출석되고_미연동_유저는_unmatched_로_돌아온다() {
        var response =
                post(
                        DISCORD_STUDY_ID,
                        Map.of(
                                "callerDiscordUserId",
                                LEADER_DISCORD_ID,
                                "discordUserIds",
                                List.of(LEADER_DISCORD_ID, MEMBER_DISCORD_ID, STRANGER_DISCORD_ID)),
                        API_KEY,
                        DiscordAttendanceResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        DiscordAttendanceResponse body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.groups())
                .singleElement()
                .satisfies(
                        g -> {
                            assertThat(g.studyMeetingId()).isEqualTo(meeting.getId());
                            assertThat(g.meetingStarted()).isFalse();
                            assertThat(g.marked())
                                    .containsExactlyInAnyOrder(
                                            LEADER_DISCORD_ID, MEMBER_DISCORD_ID);
                        });
        assertThat(body.unmatched()).containsExactly(STRANGER_DISCORD_ID);
        assertThat(body.notParticipant()).isEmpty();
        assertThat(body.noMeeting()).isEmpty();

        List<StudyAttendance> saved = studyAttendanceRepo.findAll();
        assertThat(saved).hasSize(2);
        assertThat(saved).allMatch(a -> a.getStatus() == AttendanceStatus.PRESENT);
        assertThat(saved).allMatch(a -> a.getStudyMeetingId().equals(meeting.getId()));
    }

    @Test
    @DisplayName("멱등_같은_스냅샷을_두_번_보내도_행이_늘지_않는다")
    void 멱등_같은_스냅샷을_두_번_보내도_행이_늘지_않는다() {
        var body =
                Map.of(
                        "callerDiscordUserId",
                        LEADER_DISCORD_ID,
                        "discordUserIds",
                        List.of(LEADER_DISCORD_ID, MEMBER_DISCORD_ID));

        post(DISCORD_STUDY_ID, body, API_KEY, DiscordAttendanceResponse.class);
        post(DISCORD_STUDY_ID, body, API_KEY, DiscordAttendanceResponse.class);

        assertThat(studyAttendanceRepo.findAll()).hasSize(2);
    }

    @Test
    @DisplayName("실패_API_키가_없으면_401")
    void 실패_API_키가_없으면_401() {
        var response = post(DISCORD_STUDY_ID, validBody(), null, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(studyAttendanceRepo.findAll()).isEmpty();
    }

    @Test
    @DisplayName("실패_API_키가_틀리면_401")
    void 실패_API_키가_틀리면_401() {
        var response = post(DISCORD_STUDY_ID, validBody(), "wrong-key", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("실패_유저_목록이_비면_400")
    void 실패_유저_목록이_비면_400() {
        var response =
                post(
                        DISCORD_STUDY_ID,
                        Map.of(
                                "callerDiscordUserId",
                                LEADER_DISCORD_ID,
                                "discordUserIds",
                                List.of()),
                        API_KEY,
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("실패_snowflake_형식이_아니면_400")
    void 실패_snowflake_형식이_아니면_400() {
        var response =
                post(
                        DISCORD_STUDY_ID,
                        Map.of(
                                "callerDiscordUserId",
                                LEADER_DISCORD_ID,
                                "discordUserIds",
                                List.of("not-a-snowflake")),
                        API_KEY,
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("실패_연결된_스터디가_없으면_404")
    void 실패_연결된_스터디가_없으면_404() {
        var response = post("1327394882193889999", validBody(), API_KEY, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("실패_호출자가_반장이_아니면_403")
    void 실패_호출자가_반장이_아니면_403() {
        var response =
                post(
                        DISCORD_STUDY_ID,
                        Map.of(
                                "callerDiscordUserId",
                                MEMBER_DISCORD_ID,
                                "discordUserIds",
                                List.of(MEMBER_DISCORD_ID)),
                        API_KEY,
                        String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(studyAttendanceRepo.findAll()).isEmpty();
    }

    private Map<String, Object> validBody() {
        return Map.of(
                "callerDiscordUserId",
                LEADER_DISCORD_ID,
                "discordUserIds",
                List.of(LEADER_DISCORD_ID));
    }

    private <T> org.springframework.http.ResponseEntity<T> post(
            String discordStudyId, Object body, String apiKey, Class<T> responseType) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null) {
            headers.set("X-API-Key", apiKey);
        }
        return rest.exchange(
                "/api/discord/studies/" + discordStudyId + "/attendances",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                responseType);
    }

    private void insertAccount(Long id, String nickname, String email, String discordId) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE, DISCORD_ID,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                nickname,
                SystemRole.MEMBER.name(),
                "Asia/Seoul",
                discordId,
                now,
                now,
                now);
    }
}
