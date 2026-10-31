package com.studyclub.api.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.auth.JwtService;
import com.studyclub.api.discord.DiscordBotClient;
import com.studyclub.api.study.StudyService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.LeaveReason;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.notice.DiscordDeliveryStatus;
import com.studyclub.domain.notice.DiscordSkipReason;
import com.studyclub.domain.notice.StudyNotice;
import com.studyclub.domain.notice.StudyNoticeRecipient;
import com.studyclub.domain.notice.StudyNoticeRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatus;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 반 공지 보내기 — 성공 하나, 실패 여럿 (specs/study-notice/spec.md). 권한(401/403), 입력(400), 한도(429), 없는 것(404),
 * 끝난 스터디(409), 메일 아웃박스 행이 공지와 함께 커밋·롤백되는지, 디스코드가 커밋 뒤 비동기로 가고 결과가 남는지를 본다. 봇은 목이라 아무 데도 보내지 않는다.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties =
                "spring.datasource.url=jdbc:h2:mem:study-notice;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureTestRestTemplate
class StudyNoticeIntegrationTest {

    private static final Long LEADER_ID = 6101L;
    private static final Long MEMBER_ID = 6102L;
    private static final Long PAUSED_ID = 6103L;
    private static final Long WITHDRAWN_ID = 6104L;
    private static final Long COMPLETED_ID = 6105L;
    private static final Long OTHER_GROUP_LEADER_ID = 6106L;
    private static final Long CREATOR_ID = 6107L;
    private static final Long OTHER_CAPTAIN_ID = 6108L;
    private static final Long OTHER_GROUP_MEMBER_ID = 6109L;

    private static final String LEADER_DISCORD_ID = "1327394882193886101";
    private static final String MEMBER_DISCORD_ID = "1327394882193886102";
    private static final String DISCORD_STUDY_ID = "1327394882193883136";
    private static final String CHANNEL_ID = "1327394882193883200";
    private static final String SYSTEM_DISCORD_ID = "1327394882193880001";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository studyGroupRepo;
    @Autowired StudyParticipantRepository studyParticipantRepo;
    @Autowired StudyNoticeRepository studyNoticeRepo;
    @Autowired StudyDiscordLinkRepository studyDiscordLinkRepo;
    @Autowired NotificationRepository notificationRepo;
    @Autowired NotificationTemplateRepository templateRepo;
    @Autowired TransactionTemplate tx;
    @Autowired AccountDeletionService accountDeletionService;
    @Autowired StudyService studyService;

    @MockitoBean DiscordBotClient bot;

    private Study study;
    private StudyGroup group;
    private StudyGroup otherGroup;
    private Study otherStudy;
    private StudyGroup otherStudyGroup;
    private StudyParticipant leader;
    private StudyParticipant member;
    private StudyParticipant paused;
    private StudyParticipant withdrawn;
    private StudyParticipant completed;
    private StudyParticipant otherGroupMember;

    @BeforeEach
    void setUp() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());

        notificationRepo.deleteAll();
        studyNoticeRepo.deleteAll();
        studyDiscordLinkRepo.deleteAll();
        studyParticipantRepo.deleteAll();
        studyGroupRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();
        templateRepo.deleteAll();

        // Flyway 가 꺼진 테스트(H2)라 마이그레이션이 시딩하는 템플릿이 없다 — 직접 심는다
        templateRepo.save(
                new NotificationTemplate(
                        NotificationEventType.STUDY_NOTICE,
                        NotificationChannel.EMAIL,
                        "[StudyClub] {{studyTitle}} 공지",
                        "<p>{{title}}</p><p>{{body}}</p>"));

        account(LEADER_ID, "네비게이터", "leader@notice-test.com");
        account(MEMBER_ID, "가나다크루", "member@notice-test.com");
        account(PAUSED_ID, "쉬는크루", "paused@notice-test.com");
        account(WITHDRAWN_ID, "하차크루", "withdrawn@notice-test.com");
        account(COMPLETED_ID, "완주크루", "completed@notice-test.com");
        account(OTHER_GROUP_LEADER_ID, "옆반장", "other-leader@notice-test.com");
        account(CREATOR_ID, "만든캡틴", "creator@notice-test.com");
        account(OTHER_CAPTAIN_ID, "다른캡틴", "other-captain@notice-test.com");
        account(OTHER_GROUP_MEMBER_ID, "옆반크루", "other-member@notice-test.com");
        jdbcTemplate.update(
                "UPDATE ACCOUNT SET SYSTEM_ROLE = ? WHERE ID IN (?, ?)",
                SystemRole.ADMIN.name(),
                CREATOR_ID,
                OTHER_CAPTAIN_ID);
        jdbcTemplate.update("UPDATE ACCOUNT SET DISCORD_ID = NULL");
        jdbcTemplate.update(
                "UPDATE ACCOUNT SET DISCORD_ID = ? WHERE ID = ?", LEADER_DISCORD_ID, LEADER_ID);
        jdbcTemplate.update(
                "UPDATE ACCOUNT SET DISCORD_ID = ? WHERE ID = ?", MEMBER_DISCORD_ID, MEMBER_ID);

        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("공지 프로그램").studyKind(StudyKind.STUDY).build());
        study = study(program, "공지 테스트 스터디", StudyStatus.ONGOING);
        otherStudy = study(program, "다른 스터디", StudyStatus.ONGOING);
        group = studyGroupRepo.save(new StudyGroup(study.getId(), "수요일반", null, null, 10));
        otherGroup = studyGroupRepo.save(new StudyGroup(study.getId(), "목요일반", null, null, 10));
        otherStudyGroup =
                studyGroupRepo.save(new StudyGroup(otherStudy.getId(), "남의반", null, null, 10));

        leader =
                participant(
                        LEADER_ID, study, group, ParticipantRole.LEADER, ParticipantStatus.ACTIVE);
        member =
                participant(
                        MEMBER_ID, study, group, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);
        paused =
                participant(
                        PAUSED_ID, study, group, ParticipantRole.MEMBER, ParticipantStatus.PAUSED);
        withdrawn =
                participant(
                        WITHDRAWN_ID,
                        study,
                        group,
                        ParticipantRole.MEMBER,
                        ParticipantStatus.WITHDRAWN);
        completed =
                participant(
                        COMPLETED_ID,
                        study,
                        group,
                        ParticipantRole.MEMBER,
                        ParticipantStatus.COMPLETED);
        participant(
                OTHER_GROUP_LEADER_ID,
                study,
                otherGroup,
                ParticipantRole.LEADER,
                ParticipantStatus.ACTIVE);
        otherGroupMember =
                participant(
                        OTHER_GROUP_MEMBER_ID,
                        study,
                        otherGroup,
                        ParticipantRole.MEMBER,
                        ParticipantStatus.ACTIVE);
    }

    // ── 보내기 화면 값 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공 - compose 는 이 반의 참여 중·쉬는 중만, 참여 중이 먼저 이름순으로 준다. 하차·완주·옆반은 없다. 이메일은 싣지 않는다")
    void composeListsActiveAndPausedOnly() {
        ResponseEntity<Map> response = get(compose(), LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<String, Object>> recipients =
                (List<Map<String, Object>>) response.getBody().get("recipients");
        assertThat(recipients)
                .extracting(r -> r.get("displayName"))
                .containsExactly("가나다크루", "네비게이터", "쉬는크루");
        assertThat(recipients)
                .extracting(r -> r.get("participantStatus"))
                .containsExactly("ACTIVE", "ACTIVE", "PAUSED");
        assertThat(recipients)
                .extracting(r -> r.get("discordLinked"))
                .containsExactly(true, true, false);
        assertThat(recipients.get(0)).containsEntry("participantId", member.getId().intValue());
        assertThat(response.getBody().toString()).doesNotContain("notice-test.com");
        assertThat(response.getBody())
                .containsEntry("canSend", true)
                .containsEntry("remainingToday", 30)
                .containsEntry("blockedReason", null);
    }

    @Test
    @DisplayName("성공 - compose 의 디스코드: 봇 미연결이면 사유를, 연결·채널·보내는 사람 연동이 갖춰지면 가능으로 준다")
    void composeDiscordAvailability() {
        // 봇 미설정(목 기본값)
        assertThat((Map<String, Object>) get(compose(), LEADER_ID).getBody().get("discord"))
                .containsEntry("available", false)
                .containsEntry("unavailableReason", "BOT_NOT_CONFIGURED");

        when(bot.isConfigured()).thenReturn(true);
        assertThat((Map<String, Object>) get(compose(), LEADER_ID).getBody().get("discord"))
                .containsEntry("unavailableReason", "NO_DISCORD_CHANNEL");

        linkDiscord();
        assertThat((Map<String, Object>) get(compose(), LEADER_ID).getBody().get("discord"))
                .containsEntry("available", true)
                .containsEntry("unavailableReason", null);

        // 연동하지 않았어도 봇 ID 가 없으면 보낼 길이 없다 (봇 ID 가 있으면 아래 테스트처럼 시스템 ID 로 간다)
        jdbcTemplate.update("UPDATE ACCOUNT SET DISCORD_ID = NULL WHERE ID = ?", LEADER_ID);
        assertThat((Map<String, Object>) get(compose(), LEADER_ID).getBody().get("discord"))
                .containsEntry("unavailableReason", "SENDER_NOT_LINKED");

        when(bot.canCallAsSystem()).thenReturn(true);
        assertThat((Map<String, Object>) get(compose(), LEADER_ID).getBody().get("discord"))
                .containsEntry("available", true)
                .containsEntry("unavailableReason", null);
    }

    // ── 보내기 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공 - 메일: 공지와 받는 사람이 저장되고, 받는 사람마다 PENDING 메일 행이 공지와 함께 생긴다")
    void sendEmailCreatesNoticeAndOutboxRows() {
        ResponseEntity<Map> response =
                post(
                        collection(),
                        sendBody("이번 주 장소 변경", "수요일 20:30 온라인", List.of("EMAIL"), member, paused),
                        LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("recipientCount", 2);
        Long noticeId = ((Number) response.getBody().get("noticeId")).longValue();

        StudyNotice notice = studyNoticeRepo.findById(noticeId).orElseThrow();
        assertThat(notice.getTitle()).isEqualTo("이번 주 장소 변경");
        assertThat(notice.getStudyGroupId()).isEqualTo(group.getId());
        assertThat(notice.getSenderAccountId()).isEqualTo(LEADER_ID);
        assertThat(notice.getDiscordStatus()).isEqualTo(DiscordDeliveryStatus.NOT_REQUESTED);
        assertThat(recipientAccountIds(noticeId)).containsExactlyInAnyOrder(MEMBER_ID, PAUSED_ID);

        List<Notification> mails = noticeMails();
        assertThat(mails).hasSize(2);
        assertThat(mails)
                .allSatisfy(
                        n -> {
                            assertThat(n.getStatus()).isEqualTo(NotificationStatus.PENDING);
                            assertThat(n.getReferenceId()).isEqualTo(noticeId);
                            assertThat(n.getRecipientType()).isEqualTo(NotificationChannel.EMAIL);
                            assertThat(n.getPayload())
                                    .containsEntry("studyTitle", "공지 테스트 스터디")
                                    .containsEntry("groupName", "수요일반")
                                    .containsEntry("senderName", "네비게이터")
                                    .containsEntry("title", "이번 주 장소 변경")
                                    .containsEntry("body", "수요일 20:30 온라인");
                        });
        assertThat(mails)
                .extracting(Notification::getRecipientValue)
                .containsExactlyInAnyOrder("member@notice-test.com", "paused@notice-test.com");
    }

    @Test
    @DisplayName("성공 - 스터디 이름이 길면 메일 제목에 쓰는 이름을 25자로 자른다")
    void longStudyTitleIsAbbreviated() {
        jdbcTemplate.update(
                "UPDATE STUDY SET TITLE = ? WHERE ID = ?", "가".repeat(40), study.getId());

        post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), LEADER_ID);

        assertThat(noticeMails().get(0).getPayload().get("studyTitle").toString())
                .hasSize(25)
                .endsWith("…");
    }

    @Test
    @DisplayName("성공 - 그 스터디를 만든 캡틴도 보낼 수 있다 (명부에 없어도)")
    void creatorCaptainCanSend() {
        ResponseEntity<Map> response =
                post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), CREATOR_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    @DisplayName("성공 - 디스코드: 커밋 뒤 비동기로 로비 채널에 올리고, 연동한 사람만 멘션하며 SENT 로 남긴다")
    void sendDiscordPostsAndRecords() {
        linkDiscord();
        when(bot.isConfigured()).thenReturn(true);
        when(bot.getStudyChannels(LEADER_DISCORD_ID, DISCORD_STUDY_ID))
                .thenReturn(
                        List.of(
                                new DiscordBotClient.StudyChannel(
                                        CHANNEL_ID, "로비-공지", DiscordBotClient.ChannelType.TEXT)));

        ResponseEntity<Map> response =
                post(
                        collection(),
                        sendBody("디스코드 공지", "본문", List.of("DISCORD"), member, paused),
                        LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long noticeId = ((Number) response.getBody().get("noticeId")).longValue();
        verify(bot, timeout(5000))
                .sendMessage(
                        eq(LEADER_DISCORD_ID),
                        eq(CHANNEL_ID),
                        eq(DISCORD_STUDY_ID),
                        anyString(),
                        eq(List.of(MEMBER_DISCORD_ID)));
        waitUntil(
                () ->
                        studyNoticeRepo.findById(noticeId).orElseThrow().getDiscordStatus()
                                == DiscordDeliveryStatus.SENT);
        assertThat(mentionedAccountIds(noticeId)).containsExactly(MEMBER_ID);
        // 메일은 안 골랐으니 아웃박스 행이 없다
        assertThat(noticeMails()).isEmpty();
    }

    @Test
    @DisplayName("성공 - 디스코드를 연동하지 않은 사람은 시스템 ID 로 보내고, 본문 앞에 보낸 사람 이름을 적는다")
    void discordSentAsSystemWhenSenderNotLinked() {
        linkDiscord();
        when(bot.isConfigured()).thenReturn(true);
        when(bot.canCallAsSystem()).thenReturn(true);
        when(bot.systemUserId()).thenReturn(SYSTEM_DISCORD_ID);
        jdbcTemplate.update("UPDATE ACCOUNT SET DISCORD_ID = NULL WHERE ID = ?", LEADER_ID);
        when(bot.getStudyChannels(SYSTEM_DISCORD_ID, DISCORD_STUDY_ID))
                .thenReturn(
                        List.of(
                                new DiscordBotClient.StudyChannel(
                                        CHANNEL_ID, "로비-공지", DiscordBotClient.ChannelType.TEXT)));

        ResponseEntity<Map> response =
                post(
                        collection(),
                        sendBody("디스코드 공지", "본문", List.of("DISCORD"), member),
                        LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long noticeId = ((Number) response.getBody().get("noticeId")).longValue();
        org.mockito.ArgumentCaptor<String> message =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(bot, timeout(5000))
                .sendMessage(
                        eq(SYSTEM_DISCORD_ID),
                        eq(CHANNEL_ID),
                        eq(DISCORD_STUDY_ID),
                        message.capture(),
                        eq(List.of(MEMBER_DISCORD_ID)));
        // 발신 줄은 봇 이름이라, 보낸 사람은 본문에 글자로 적는다
        assertThat(message.getValue()).contains("보낸 사람 네비게이터");
        waitUntil(
                () ->
                        studyNoticeRepo.findById(noticeId).orElseThrow().getDiscordStatus()
                                == DiscordDeliveryStatus.SENT);
    }

    @Test
    @DisplayName("성공 - 연동한 사람은 본인 ID 로 보내고 본문에 이름을 따로 적지 않는다 (발신 줄에 본인이 보인다)")
    void linkedSenderDoesNotRepeatNameInBody() {
        linkDiscord();
        when(bot.isConfigured()).thenReturn(true);
        when(bot.canCallAsSystem()).thenReturn(true);
        when(bot.getStudyChannels(LEADER_DISCORD_ID, DISCORD_STUDY_ID))
                .thenReturn(
                        List.of(
                                new DiscordBotClient.StudyChannel(
                                        CHANNEL_ID, "로비-공지", DiscordBotClient.ChannelType.TEXT)));

        post(collection(), sendBody("디스코드 공지", "본문", List.of("DISCORD"), member), LEADER_ID);

        org.mockito.ArgumentCaptor<String> message =
                org.mockito.ArgumentCaptor.forClass(String.class);
        verify(bot, timeout(5000))
                .sendMessage(
                        eq(LEADER_DISCORD_ID),
                        eq(CHANNEL_ID),
                        eq(DISCORD_STUDY_ID),
                        message.capture(),
                        eq(List.of(MEMBER_DISCORD_ID)));
        assertThat(message.getValue()).doesNotContain("보낸 사람");
    }

    @Test
    @DisplayName("성공 - 연동하지 않았고 봇 ID 도 없으면 건너뛰고(SKIPPED) 사유를 남긴다. 메일은 그대로 나간다")
    void discordSkippedWhenSenderNotLinked() {
        linkDiscord();
        when(bot.isConfigured()).thenReturn(true);
        jdbcTemplate.update("UPDATE ACCOUNT SET DISCORD_ID = NULL WHERE ID = ?", LEADER_ID);

        ResponseEntity<Map> response =
                post(
                        collection(),
                        sendBody("제목", "본문", List.of("EMAIL", "DISCORD"), member),
                        LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long noticeId = ((Number) response.getBody().get("noticeId")).longValue();
        waitUntil(
                () ->
                        studyNoticeRepo.findById(noticeId).orElseThrow().getDiscordStatus()
                                == DiscordDeliveryStatus.SKIPPED);
        assertThat(studyNoticeRepo.findById(noticeId).orElseThrow().getDiscordSkipReason())
                .isEqualTo(DiscordSkipReason.SENDER_NOT_LINKED);
        assertThat(noticeMails()).hasSize(1);
        verify(bot, org.mockito.Mockito.never())
                .sendMessage(anyString(), anyString(), anyString(), anyString(), anyList());
    }

    @Test
    @DisplayName("실패 - 메일 템플릿이 없으면 공지 전체가 롤백된다 (공지는 있는데 메일 행이 없는 상태를 만들지 않는다)")
    void missingTemplateRollsBackNotice() {
        templateRepo.deleteAll();

        ResponseEntity<Map> response =
                post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(studyNoticeRepo.count()).isZero();
        assertThat(noticeMails()).isEmpty();
    }

    @Test
    @DisplayName(
            "실패 - 1분 안에 다시 보내면 429 STUDY_NOTICE_RATE_LIMITED, compose 는 COOLDOWN 과 다시 보낼 수 있는 시각을 준다")
    void cooldown() {
        var first = post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), LEADER_ID);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        var second =
                post(collection(), sendBody("제목2", "본문2", List.of("EMAIL"), member), LEADER_ID);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(second.getBody()).containsEntry("errorCode", "STUDY_NOTICE_RATE_LIMITED");
        assertThat(studyNoticeRepo.count()).isEqualTo(1);
        Map<String, Object> compose = get(compose(), LEADER_ID).getBody();
        assertThat(compose)
                .containsEntry("canSend", false)
                .containsEntry("blockedReason", "COOLDOWN")
                .containsEntry("remainingToday", 29);
        assertThat(compose.get("nextAvailableAt")).isNotNull();
    }

    @Test
    @DisplayName("성공 - 직전 발송이 1분보다 오래됐으면 다시 보낼 수 있다")
    void afterCooldownCanSendAgain() {
        post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), LEADER_ID);
        jdbcTemplate.update(
                "UPDATE STUDY_NOTICE SET CREATED_AT = ?",
                Timestamp.from(Instant.now().minus(2, ChronoUnit.MINUTES)));

        var again = post(collection(), sendBody("제목2", "본문2", List.of("EMAIL"), member), LEADER_ID);

        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    @DisplayName("실패 - 입력 검증: 제목·본문 길이, 보낼 곳 없음, 받는 사람 없음·겹침은 400")
    void invalidInput() {
        assertInvalid(sendBody("   ", "본문", List.of("EMAIL"), member));
        assertInvalid(sendBody("가".repeat(61), "본문", List.of("EMAIL"), member));
        assertInvalid(sendBody("제목", "나".repeat(1501), List.of("EMAIL"), member));
        assertInvalid(sendBody("제목", "본문", List.of(), member));
        assertInvalid(sendBody("제목", "본문", List.of("EMAIL", "EMAIL"), member));
        assertInvalid(sendBody("제목", "본문", List.of("EMAIL")));
        assertInvalid(sendBody("제목", "본문", List.of("EMAIL"), member, member));
        assertInvalid(sendBody("제목", "본문", List.of("SMS"), member));
        assertThat(studyNoticeRepo.count()).isZero();
        assertThat(noticeMails()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 받는 사람이 이 반의 참여 중·쉬는 중이 아니면(하차·완주·옆반) 일부만 보내지 않고 전체를 거절한다")
    void recipientsMustBeRoster() {
        assertInvalid(sendBody("제목", "본문", List.of("EMAIL"), member, withdrawn));
        assertInvalid(sendBody("제목", "본문", List.of("EMAIL"), member, completed));
        assertInvalid(sendBody("제목", "본문", List.of("EMAIL"), member, otherGroupMember));
        assertThat(studyNoticeRepo.count()).isZero();
    }

    @Test
    @DisplayName("실패 - 끝난 스터디는 409 STUDY_ENDED")
    void endedStudy() {
        jdbcTemplate.update(
                "UPDATE STUDY SET STATUS = ? WHERE ID = ?",
                StudyStatus.ENDED.name(),
                study.getId());

        var response =
                post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("errorCode", "STUDY_ENDED");
    }

    @Test
    @DisplayName(
            "성공 - 끝난 스터디는 compose 가 canSend=false · STUDY_ENDED 를 준다 (보내기도 409 라 화면과 어긋나지 않는다)")
    void composeOnEndedStudy() {
        jdbcTemplate.update(
                "UPDATE STUDY SET STATUS = ? WHERE ID = ?",
                StudyStatus.CLOSED.name(),
                study.getId());

        Map<String, Object> compose = get(compose(), LEADER_ID).getBody();

        assertThat(compose)
                .containsEntry("canSend", false)
                .containsEntry("blockedReason", "STUDY_ENDED")
                .containsEntry("nextAvailableAt", null);
        // 끝난 스터디에서도 보낸 공지 기록은 본다
        assertThat(get(collection(), LEADER_ID).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("성공 - 디스코드 대기가 10분을 넘으면 기록에서 실패로 내려준다. 9분이면 대기 그대로. DB 값은 바뀌지 않는다")
    void stalePendingDiscordShownAsFailed() {
        StudyNotice stale = pendingDiscordNotice("오래된 대기");
        StudyNotice fresh = pendingDiscordNotice("방금");
        setCreatedAt(stale.getId(), Instant.now().minus(11, ChronoUnit.MINUTES));
        setCreatedAt(fresh.getId(), Instant.now().minus(9, ChronoUnit.MINUTES));

        List<Map<String, Object>> items =
                (List<Map<String, Object>>) get(collection(), LEADER_ID).getBody().get("items");

        Map<String, Object> staleItem = byTitle(items, "오래된 대기");
        Map<String, Object> freshItem = byTitle(items, "방금");
        assertThat((Map<String, Object>) staleItem.get("discord"))
                .containsEntry("status", "FAILED");
        assertThat((Map<String, Object>) freshItem.get("discord"))
                .containsEntry("status", "PENDING");
        assertThat(studyNoticeRepo.findById(stale.getId()).orElseThrow().getDiscordStatus())
                .isEqualTo(DiscordDeliveryStatus.PENDING);
    }

    @Test
    @DisplayName("성공 - 보낸 사람이 탈퇴하면 받은 사람들의 메일 행에서 보낸 사람 이름만 「탈퇴한 회원」으로 바뀐다 (제목·본문은 그대로)")
    void senderDeletionRedactsSenderNameInMails() {
        post(collection(), sendBody("공지 제목", "공지 본문", List.of("EMAIL"), member, paused), LEADER_ID);
        assertThat(noticeMails())
                .allSatisfy(n -> assertThat(n.getPayload()).containsEntry("senderName", "네비게이터"));

        accountDeletionService.deleteAccount(LEADER_ID, LeaveReason.OTHER);

        List<Notification> mails = noticeMails();
        assertThat(mails).hasSize(2);
        assertThat(mails)
                .allSatisfy(
                        n ->
                                assertThat(n.getPayload())
                                        .containsEntry("senderName", "탈퇴한 회원")
                                        .containsEntry("title", "공지 제목")
                                        .containsEntry("body", "공지 본문")
                                        .doesNotContainKey("nickname"));
        // 받는 사람의 주소는 그대로다 (받는 사람이 탈퇴한 것이 아니다)
        assertThat(mails)
                .extracting(Notification::getRecipientValue)
                .containsExactlyInAnyOrder("member@notice-test.com", "paused@notice-test.com");
    }

    @Test
    @DisplayName("성공 - 메일 행에 보낸 사람 ID 가 실린다. 스터디가 지워져 공지가 사라진 뒤에 보낸 사람이 탈퇴해도 이름이 비식별화된다")
    void senderDeletionRedactsMailsEvenAfterStudyDeleted() {
        post(collection(), sendBody("공지 제목", "공지 본문", List.of("EMAIL"), member, paused), LEADER_ID);
        assertThat(noticeMails())
                .allSatisfy(n -> assertThat(n.getSenderAccountId()).isEqualTo(LEADER_ID));

        // 스터디 삭제가 공지를 먼저 지운다 — 메일 행은 남고, 공지 ID 로는 보낸 사람을 되짚을 수 없다
        tx.executeWithoutResult(status -> studyNoticeRepo.deleteByStudyId(study.getId()));
        assertThat(studyNoticeRepo.findIdsBySenderAccountId(LEADER_ID)).isEmpty();

        accountDeletionService.deleteAccount(LEADER_ID, LeaveReason.OTHER);

        assertThat(noticeMails())
                .hasSize(2)
                .allSatisfy(n -> assertThat(n.getPayload()).containsEntry("senderName", "탈퇴한 회원"));
    }

    @Test
    @DisplayName("동시성 - 보낸 사람(담당 캡틴)이 탈퇴하는 중에는 발송이 기다리고, 탈퇴가 끝나면 401 로 거절되어 닉네임이 담긴 메일 행이 남지 않는다")
    void sendWaitsForSenderWithdrawal() throws Exception {
        AtomicReference<CompletableFuture<ResponseEntity<Map>>> send = new AtomicReference<>();

        // 탈퇴가 쥐는 첫 잠금(계정 행)을 쥐고 있는 동안 발송을 시작한다. 만든 캡틴은 명부에 없어 반 잠금으로는 서로 막히지 않는다
        tx.executeWithoutResult(
                status -> {
                    accountRepository.findByIdForUpdate(CREATOR_ID).orElseThrow();
                    send.set(
                            CompletableFuture.supplyAsync(
                                    () ->
                                            post(
                                                    collection(),
                                                    sendBody("제목", "본문", List.of("EMAIL"), member),
                                                    CREATOR_ID)));
                    pause(700);
                    assertThat(send.get().isDone())
                            .as("계정 행을 쥐고 있는 동안 발송은 끝나면 안 된다 (잠그지 않고 앞서 읽으면 탈퇴 뒤에 닉네임을 싣는다)")
                            .isFalse();
                    accountDeletionService.deleteAccount(CREATOR_ID, LeaveReason.OTHER);
                });

        ResponseEntity<Map> response = send.get().get(10, TimeUnit.SECONDS);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(studyNoticeRepo.findAll()).isEmpty();
        assertThat(noticeMails()).isEmpty();
    }

    @Test
    @DisplayName("동시성 - 스터디를 지우는 중에 저장되던 공지도 스터디와 함께 지워진다 (삭제가 반을 먼저 잠그고 공지를 지운다)")
    void studyDeletionAlsoRemovesNoticeSavedByInFlightSend() throws Exception {
        AtomicReference<CompletableFuture<Void>> deletion = new AtomicReference<>();

        // 발송은 반 행을 잠그고 공지를 저장한다. 그 저장이 아직 커밋되기 전에 스터디 삭제가 시작된 상황을 만든다
        tx.executeWithoutResult(
                status -> {
                    studyGroupRepo.findByIdForUpdate(group.getId()).orElseThrow();
                    studyNoticeRepo.save(
                            StudyNotice.create(
                                    study.getId(),
                                    group.getId(),
                                    LEADER_ID,
                                    "저장 중인 공지",
                                    "본문",
                                    true,
                                    false,
                                    List.of(MEMBER_ID)));
                    deletion.set(
                            CompletableFuture.runAsync(() -> studyService.delete(study.getId())));
                    pause(700);
                    assertThat(deletion.get().isDone()).as("삭제는 반 잠금을 기다린다").isFalse();
                });

        deletion.get().get(10, TimeUnit.SECONDS);
        // 반 잠금을 먼저 잡은 삭제가 발송의 커밋을 기다렸다가 공지를 지우므로 남지 않는다
        assertThat(studyNoticeRepo.findAll()).isEmpty();
        assertThat(
                        jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM STUDY_NOTICE_RECIPIENT", Integer.class))
                .as("받는 사람 행도 함께 지워진다")
                .isZero();
        assertThat(studyRepo.findById(study.getId())).isEmpty();
    }

    private static void pause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Test
    @DisplayName("성공 - 받는 사람이 탈퇴하면 그 사람 행의 주소만 가려지고 공지 payload 에 빈 nickname 키가 생기지 않는다")
    void recipientDeletionRedactsOnlyAddress() {
        post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member, paused), LEADER_ID);

        accountDeletionService.deleteAccount(MEMBER_ID, LeaveReason.OTHER);

        List<Notification> mails = noticeMails();
        Notification gone =
                mails.stream()
                        .filter(n -> MEMBER_ID.equals(n.getRecipientUserId()))
                        .findFirst()
                        .orElseThrow();
        Notification kept =
                mails.stream()
                        .filter(n -> PAUSED_ID.equals(n.getRecipientUserId()))
                        .findFirst()
                        .orElseThrow();
        assertThat(gone.getRecipientValue()).isEqualTo("[탈퇴한 계정]");
        assertThat(gone.getPayload())
                .doesNotContainKey("nickname")
                .containsEntry("senderName", "네비게이터");
        assertThat(kept.getRecipientValue()).isEqualTo("paused@notice-test.com");
    }

    // ── 권한 ─────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("실패 - 토큰 없이 세 엔드포인트 모두 401")
    void unauthenticated() {
        for (var method : List.of(HttpMethod.GET, HttpMethod.POST)) {
            String url = method == HttpMethod.GET ? compose() : collection();
            var response =
                    rest.exchange(
                            url,
                            method,
                            new HttpEntity<>(
                                    method == HttpMethod.POST
                                            ? sendBody("제목", "본문", List.of("EMAIL"), member)
                                            : null,
                                    jsonHeaders()),
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        }
        var history =
                rest.exchange(
                        collection(), HttpMethod.GET, new HttpEntity<>(jsonHeaders()), Map.class);
        assertThat(history.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(history.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
    }

    @Test
    @DisplayName("실패 - 같은 반 크루 · 옆반 네비게이터 · 만들지 않은 다른 캡틴은 403 (compose · 보내기 · 기록 모두)")
    void forbidden() {
        for (Long outsider : List.of(MEMBER_ID, OTHER_GROUP_LEADER_ID, OTHER_CAPTAIN_ID)) {
            assertThat(get(compose(), outsider).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(get(collection(), outsider).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            var response =
                    post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), outsider);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
        }
        assertThat(studyNoticeRepo.count()).isZero();
        assertThat(noticeMails()).isEmpty();
    }

    @Test
    @DisplayName("실패 - 없는 스터디·반은 404, 다른 스터디의 반이면 400")
    void notFoundAndMismatch() {
        assertThat(
                        get(
                                        "/api/studies/999999/groups/"
                                                + group.getId()
                                                + "/notices/compose",
                                        LEADER_ID)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(
                        get(
                                        "/api/studies/"
                                                + study.getId()
                                                + "/groups/999999/notices/compose",
                                        LEADER_ID)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(
                        get(
                                        "/api/studies/"
                                                + study.getId()
                                                + "/groups/"
                                                + otherStudyGroup.getId()
                                                + "/notices/compose",
                                        LEADER_ID)
                                .getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ── 기록 ─────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("성공 - 기록은 최근 순으로, 받은 사람 수·메일 상태별 수·디스코드 결과와 함께 준다")
    void listShowsResults() {
        var sent =
                post(
                        collection(),
                        sendBody("첫 공지", "본문", List.of("EMAIL"), member, paused),
                        LEADER_ID);
        Long noticeId = ((Number) sent.getBody().get("noticeId")).longValue();
        List<Notification> mails = noticeMails();
        jdbcTemplate.update(
                "UPDATE NOTIFICATION SET STATUS = 'SENT' WHERE ID = ?", mails.get(0).getId());
        jdbcTemplate.update(
                "UPDATE NOTIFICATION SET STATUS = 'FAILED' WHERE ID = ?", mails.get(1).getId());

        ResponseEntity<Map> response = get(collection(), LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("total", 1)
                .containsEntry("offset", 0)
                .containsEntry("limit", 20);
        Map<String, Object> item =
                ((List<Map<String, Object>>) response.getBody().get("items")).get(0);
        assertThat(item)
                .containsEntry("noticeId", noticeId.intValue())
                .containsEntry("title", "첫 공지")
                .containsEntry("senderName", "네비게이터")
                .containsEntry("recipientCount", 2);
        assertThat((Map<String, Object>) item.get("email"))
                .containsEntry("requested", true)
                .containsEntry("pending", 0)
                .containsEntry("sent", 1)
                .containsEntry("failed", 1);
        assertThat((Map<String, Object>) item.get("discord"))
                .containsEntry("requested", false)
                .containsEntry("status", "NOT_REQUESTED")
                .containsEntry("mentionedCount", 0);
    }

    @Test
    @DisplayName("성공 - 같은 조건에 템플릿이 둘이면 받는 사람마다 메일 행이 둘이다 (행마다 templateId 가 다르다)")
    void twoTemplatesCreateTwoRowsPerRecipient() {
        NotificationTemplate second = secondNoticeTemplate();

        var response =
                post(
                        collection(),
                        sendBody("첫 공지", "본문", List.of("EMAIL"), member, paused),
                        LEADER_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("recipientCount", 2);
        List<Notification> mails = noticeMails();
        assertThat(mails).hasSize(4);
        assertThat(mails)
                .extracting(Notification::getRecipientUserId)
                .containsExactlyInAnyOrder(MEMBER_ID, MEMBER_ID, PAUSED_ID, PAUSED_ID);
        assertThat(mails.stream().map(Notification::getTemplateId).distinct().toList())
                .hasSize(2)
                .contains(second.getId());
        assertThat(mails)
                .allSatisfy(n -> assertThat(n.getStatus()).isEqualTo(NotificationStatus.PENDING));
    }

    @Test
    @DisplayName("성공 - 기록의 메일 건수는 행 수가 아니라 받는 사람 수 기준이다 (한 명이 한 통 실패하면 실패 1명)")
    void listCountsRecipientsNotRows() {
        NotificationTemplate second = secondNoticeTemplate();
        post(collection(), sendBody("첫 공지", "본문", List.of("EMAIL"), member, paused), LEADER_ID);
        Long firstTemplateId = firstNoticeTemplateIdOtherThan(second.getId());

        // member: 한 통 완료, 한 통 실패 → 실패 1명 / paused: 둘 다 완료 → 완료 1명
        markMail(MEMBER_ID, firstTemplateId, "SENT");
        markMail(MEMBER_ID, second.getId(), "FAILED");
        markMail(PAUSED_ID, firstTemplateId, "SENT");
        markMail(PAUSED_ID, second.getId(), "SENT");

        Map<String, Object> email = emailCountsOfFirstItem();

        assertThat(email)
                .containsEntry("requested", true)
                .containsEntry("pending", 0)
                .containsEntry("sent", 1)
                .containsEntry("failed", 1);
    }

    @Test
    @DisplayName("성공 - 한 통은 완료, 한 통은 대기인 사람은 대기 1명으로 센다 (합이 받는 사람 수를 넘지 않는다)")
    void listCountsPendingWhenOneRowIsStillPending() {
        NotificationTemplate second = secondNoticeTemplate();
        var sent =
                post(
                        collection(),
                        sendBody("첫 공지", "본문", List.of("EMAIL"), member, paused),
                        LEADER_ID);
        assertThat(sent.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Long firstTemplateId = firstNoticeTemplateIdOtherThan(second.getId());

        markMail(MEMBER_ID, firstTemplateId, "SENT"); // member 의 나머지 한 통은 PENDING
        markMail(PAUSED_ID, firstTemplateId, "SENT");
        markMail(PAUSED_ID, second.getId(), "SENT");

        Map<String, Object> email = emailCountsOfFirstItem();

        assertThat(email)
                .containsEntry("pending", 1)
                .containsEntry("sent", 1)
                .containsEntry("failed", 0);
    }

    @Test
    @DisplayName("성공 - 탈퇴로 취소된 사람은 템플릿이 둘이어도 세지 않는다")
    void listSkipsCancelledRecipients() {
        NotificationTemplate second = secondNoticeTemplate();
        post(collection(), sendBody("첫 공지", "본문", List.of("EMAIL"), member, paused), LEADER_ID);
        Long firstTemplateId = firstNoticeTemplateIdOtherThan(second.getId());

        markMail(MEMBER_ID, firstTemplateId, "CANCELLED");
        markMail(MEMBER_ID, second.getId(), "CANCELLED");
        markMail(PAUSED_ID, firstTemplateId, "SENT");
        markMail(PAUSED_ID, second.getId(), "SENT");

        Map<String, Object> email = emailCountsOfFirstItem();

        assertThat(email)
                .containsEntry("pending", 0)
                .containsEntry("sent", 1)
                .containsEntry("failed", 0);
    }

    @Test
    @DisplayName("성공 - 보낸 사람이 탈퇴했으면 「탈퇴한 회원」, 기록이 없으면 빈 목록")
    void listWithdrawnSenderAndEmpty() {
        assertThat((List<?>) get(collection(), LEADER_ID).getBody().get("items")).isEmpty();

        post(collection(), sendBody("제목", "본문", List.of("EMAIL"), member), CREATOR_ID);
        jdbcTemplate.update("DELETE FROM ACCOUNT WHERE ID = ?", CREATOR_ID);
        // 만든 캡틴은 지워졌으니 기록은 네비게이터가 본다
        Map<String, Object> item =
                ((List<Map<String, Object>>) get(collection(), LEADER_ID).getBody().get("items"))
                        .get(0);
        assertThat(item).containsEntry("senderName", "탈퇴한 회원");
    }

    @Test
    @DisplayName("성공 - offset·limit 으로 자르고 limit 은 50 을 넘지 못한다")
    void listPaging() {
        for (int i = 0; i < 3; i++) {
            post(collection(), sendBody("공지" + i, "본문", List.of("EMAIL"), member), LEADER_ID);
            jdbcTemplate.update(
                    "UPDATE STUDY_NOTICE SET CREATED_AT = ?",
                    Timestamp.from(Instant.now().minus(10, ChronoUnit.MINUTES)));
            // 직전 발송을 오래된 것으로 돌려야 1분 간격에 걸리지 않는다
        }

        Map<String, Object> page = get(collection() + "?offset=1&limit=1", LEADER_ID).getBody();
        assertThat(page)
                .containsEntry("total", 3)
                .containsEntry("offset", 1)
                .containsEntry("limit", 1);
        assertThat((List<?>) page.get("items")).hasSize(1);
        assertThat(get(collection() + "?limit=500", LEADER_ID).getBody())
                .containsEntry("limit", 50);
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private String collection() {
        return "/api/studies/" + study.getId() + "/groups/" + group.getId() + "/notices";
    }

    private String compose() {
        return collection() + "/compose";
    }

    private Map<String, Object> sendBody(
            String title, String body, List<String> channels, StudyParticipant... recipients) {
        return Map.of(
                "title",
                title,
                "body",
                body,
                "channels",
                channels,
                "participantIds",
                java.util.Arrays.stream(recipients).map(StudyParticipant::getId).toList());
    }

    private void assertInvalid(Map<String, Object> body) {
        var response = post(collection(), body, LEADER_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
    }

    private NotificationTemplate secondNoticeTemplate() {
        return templateRepo.save(
                new NotificationTemplate(
                        NotificationEventType.STUDY_NOTICE,
                        NotificationChannel.EMAIL,
                        "[StudyClub] 새 공지가 도착했어요",
                        "<p>{{title}}</p>"));
    }

    private Long firstNoticeTemplateIdOtherThan(Long otherId) {
        return templateRepo
                .findAllByEventTypeAndChannelOrderByIdAsc(
                        NotificationEventType.STUDY_NOTICE, NotificationChannel.EMAIL)
                .stream()
                .map(NotificationTemplate::getId)
                .filter(id -> !id.equals(otherId))
                .findFirst()
                .orElseThrow();
    }

    private void markMail(Long recipientId, Long templateId, String status) {
        jdbcTemplate.update(
                "UPDATE NOTIFICATION SET STATUS = ? WHERE RECIPIENT_USER_ID = ? AND TEMPLATE_ID = ?",
                status,
                recipientId,
                templateId);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> emailCountsOfFirstItem() {
        ResponseEntity<Map> response = get(collection(), LEADER_ID);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> item =
                ((List<Map<String, Object>>) response.getBody().get("items")).get(0);
        assertThat(item).containsEntry("recipientCount", 2);
        return (Map<String, Object>) item.get("email");
    }

    private List<Notification> noticeMails() {
        return notificationRepo.findAllByOrderByCreatedAtDesc().stream()
                .filter(n -> n.getEventType() == NotificationEventType.STUDY_NOTICE)
                .toList();
    }

    // 받는 사람은 지연 로딩이라 트랜잭션 안에서 읽는다
    private List<Long> recipientAccountIds(Long noticeId) {
        return tx.execute(
                status ->
                        studyNoticeRepo.findById(noticeId).orElseThrow().getRecipients().stream()
                                .map(StudyNoticeRecipient::getAccountId)
                                .toList());
    }

    private List<Long> mentionedAccountIds(Long noticeId) {
        return tx.execute(
                status ->
                        studyNoticeRepo.findById(noticeId).orElseThrow().getRecipients().stream()
                                .filter(StudyNoticeRecipient::isDiscordMentioned)
                                .map(StudyNoticeRecipient::getAccountId)
                                .toList());
    }

    private StudyNotice pendingDiscordNotice(String title) {
        return studyNoticeRepo.save(
                StudyNotice.create(
                        study.getId(),
                        group.getId(),
                        LEADER_ID,
                        title,
                        "본문",
                        false,
                        true,
                        List.of(MEMBER_ID)));
    }

    private void setCreatedAt(Long noticeId, Instant at) {
        jdbcTemplate.update(
                "UPDATE STUDY_NOTICE SET CREATED_AT = ? WHERE ID = ?",
                Timestamp.from(at),
                noticeId);
    }

    private static Map<String, Object> byTitle(List<Map<String, Object>> items, String title) {
        return items.stream().filter(i -> title.equals(i.get("title"))).findFirst().orElseThrow();
    }

    private void linkDiscord() {
        studyDiscordLinkRepo.save(
                new StudyDiscordLink(study.getId(), DISCORD_STUDY_ID, "1327394882193883140"));
    }

    private static void waitUntil(BooleanSupplier condition) {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            if (condition.getAsBoolean()) {
                return;
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        assertThat(condition.getAsBoolean()).as("5초 안에 조건이 되지 않았다").isTrue();
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private HttpHeaders authHeaders(Long accountId) {
        HttpHeaders headers = jsonHeaders();
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        return headers;
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> get(String url, Long accountId) {
        return rest.exchange(
                url, HttpMethod.GET, new HttpEntity<>(authHeaders(accountId)), Map.class);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> post(String url, Object body, Long accountId) {
        return rest.exchange(
                url, HttpMethod.POST, new HttpEntity<>(body, authHeaders(accountId)), Map.class);
    }

    private Study study(StudyProgram program, String title, StudyStatus status) {
        return studyRepo.save(
                Study.builder()
                        .programId(program.getId())
                        .title(title)
                        .oneLineSummary("테스트용")
                        .category(StudyCategory.ALGORITHM)
                        .description("설명")
                        .status(status)
                        .startAt(Instant.now().minus(7, ChronoUnit.DAYS))
                        .createdBy(CREATOR_ID)
                        .build());
    }

    private StudyParticipant participant(
            Long accountId,
            Study study,
            StudyGroup group,
            ParticipantRole role,
            ParticipantStatus status) {
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

    private void account(Long id, String nickname, String email) {
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
