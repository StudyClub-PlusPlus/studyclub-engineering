package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

/** 봇을 언제 부르고 언제 안 부르는지. HTTP 표면은 {@link StudyDiscordLinkIntegrationTest} 가 본다. */
@ExtendWith(MockitoExtension.class)
class StudyDiscordLinkServiceTest {

    private static final Long ADMIN_ID = 1L;
    private static final Long STUDY_ID = 10L;
    private static final String DISCORD_USER_ID = "1327394882193880001";
    private static final DiscordBotClient.CreatedStudy CREATED =
            new DiscordBotClient.CreatedStudy("1327394882193883136", "1327394882193883140");

    @Mock DiscordBotClient discordBotClient;
    @Mock StudyDiscordLinkRepository studyDiscordLinkRepository;
    @Mock StudyRepository studyRepository;
    @Mock AccountRepository accountRepository;
    @Mock StudyParticipantRepository studyParticipantRepository;
    @Mock TransactionTemplate transactionTemplate;

    @InjectMocks StudyDiscordLinkService service;

    @Test
    @DisplayName("봇_설정이_없으면_등록_경로는_봇을_부르지_않는다")
    void 봇_설정이_없으면_등록_경로는_봇을_부르지_않는다() {
        when(discordBotClient.isConfigured()).thenReturn(false);

        service.linkAfterCreate(ADMIN_ID, STUDY_ID);

        verify(discordBotClient, never()).createStudy(anyString(), anyString());
        verify(studyDiscordLinkRepository, never()).save(any());
    }

    @Test
    @DisplayName("봇이_실패해도_등록_경로는_던지지_않는다")
    void 봇이_실패해도_등록_경로는_던지지_않는다() {
        when(discordBotClient.isConfigured()).thenReturn(true);
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy(anyString(), anyString()))
                .thenThrow(new BusinessException(ErrorCode.CONFLICT));

        assertThatCode(() -> service.linkAfterCreate(ADMIN_ID, STUDY_ID))
                .doesNotThrowAnyException();
        verify(studyDiscordLinkRepository, never()).save(any());
    }

    @Test
    @DisplayName("이미_연결된_스터디는_봇을_부르지_않고_409")
    void 이미_연결된_스터디는_봇을_부르지_않고_409() {
        givenStudy("알고리즘 스터디");
        when(studyDiscordLinkRepository.existsByStudyId(STUDY_ID)).thenReturn(true);

        assertThatThrownBy(() -> service.link(ADMIN_ID, STUDY_ID, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONFLICT);
        verify(discordBotClient, never()).createStudy(anyString(), anyString());
    }

    @Test
    @DisplayName("디스코드_ID_가_없는_계정은_봇을_부르지_않고_409")
    void 디스코드_ID_가_없는_계정은_봇을_부르지_않고_409() {
        givenStudy("알고리즘 스터디");
        givenAccount(null);

        assertThatThrownBy(() -> service.link(ADMIN_ID, STUDY_ID, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONFLICT);
        verify(discordBotClient, never()).createStudy(anyString(), anyString());
    }

    @Test
    @DisplayName("studyName_이_없으면_스터디_제목을_보내고_연결을_저장한다")
    void studyName_이_없으면_스터디_제목을_보내고_연결을_저장한다() {
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디", DISCORD_USER_ID)).thenReturn(CREATED);
        givenStudyStillExists(true);

        service.link(ADMIN_ID, STUDY_ID, null);

        verify(studyDiscordLinkRepository)
                .save(
                        argThat(
                                link ->
                                        link.getStudyId().equals(STUDY_ID)
                                                && link.getDiscordStudyId()
                                                        .equals(CREATED.discordStudyId())
                                                && link.getDiscordRoleId()
                                                        .equals(CREATED.discordRoleId())));
    }

    @Test
    @DisplayName("studyName_이_있으면_앞뒤_공백을_잘라_그_이름을_보낸다")
    void studyName_이_있으면_앞뒤_공백을_잘라_그_이름을_보낸다() {
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디 2기", DISCORD_USER_ID)).thenReturn(CREATED);
        givenStudyStillExists(true);

        service.link(ADMIN_ID, STUDY_ID, "  알고리즘 스터디 2기 ");

        verify(discordBotClient).createStudy("알고리즘 스터디 2기", DISCORD_USER_ID);
    }

    @Test
    @DisplayName("봇을_기다리는_사이_스터디가_삭제되면_연결을_만들지_않는다")
    void 봇을_기다리는_사이_스터디가_삭제되면_연결을_만들지_않는다() {
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디", DISCORD_USER_ID)).thenReturn(CREATED);
        givenStudyStillExists(false);

        assertThatThrownBy(() -> service.link(ADMIN_ID, STUDY_ID, null))
                .extracting("errorCode")
                .isEqualTo(ErrorCode.NOT_FOUND);
        verify(studyDiscordLinkRepository, never()).save(any());
    }

    @Test
    @DisplayName("연결_후_기존_참여자에게_디스코드_role_을_부여한다")
    void 연결_후_기존_참여자에게_디스코드_role_을_부여한다() {
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디", DISCORD_USER_ID)).thenReturn(CREATED);
        givenStudyStillExists(true);

        when(studyParticipantRepository.findAccountIdsByStudyIdAndStatusIn(
                        eq(STUDY_ID), anyCollection()))
                .thenReturn(List.of(2L));
        when(accountRepository.findDiscordIdsByIdIn(anyCollection()))
                .thenReturn(List.of("1327394882193880002"));
        when(discordBotClient.systemUserId()).thenReturn("bot-id");
        when(discordBotClient.assignRole(
                        "bot-id",
                        CREATED.discordRoleId(),
                        CREATED.discordStudyId(),
                        List.of("1327394882193880002")))
                .thenReturn(new DiscordBotClient.RoleChangeResult(1, List.of()));

        service.link(ADMIN_ID, STUDY_ID, null);

        verify(discordBotClient)
                .assignRole(
                        "bot-id",
                        CREATED.discordRoleId(),
                        CREATED.discordStudyId(),
                        List.of("1327394882193880002"));
    }

    @Test
    @DisplayName("기존_참여자_중_디스코드_미연동_계정은_role_부여를_건너뛴다")
    void 기존_참여자_중_디스코드_미연동_계정은_role_부여를_건너뛴다() {
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디", DISCORD_USER_ID)).thenReturn(CREATED);
        givenStudyStillExists(true);

        when(studyParticipantRepository.findAccountIdsByStudyIdAndStatusIn(
                        eq(STUDY_ID), anyCollection()))
                .thenReturn(List.of(2L));
        when(accountRepository.findDiscordIdsByIdIn(anyCollection())).thenReturn(List.of());

        service.link(ADMIN_ID, STUDY_ID, null);

        verify(discordBotClient, never()).assignRole(any(), any(), any(), anyList());
    }

    /** 저장 직전 잠금 재확인. 트랜잭션 템플릿은 콜백을 그대로 실행한다. */
    @Test
    @DisplayName("주소가_비어_있으면_첫_텍스트_채널_주소로_채운다")
    void 주소가_비어_있으면_첫_텍스트_채널_주소로_채운다() {
        StudyDiscordLinkService withGuild = serviceWithGuild();
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디", DISCORD_USER_ID)).thenReturn(CREATED);
        when(discordBotClient.getStudyChannels(DISCORD_USER_ID, CREATED.discordStudyId()))
                .thenReturn(
                        List.of(
                                new DiscordBotClient.StudyChannel(
                                        "1327394882193883200",
                                        "음성",
                                        DiscordBotClient.ChannelType.VOICE),
                                new DiscordBotClient.StudyChannel(
                                        "1327394882193883201",
                                        "로비",
                                        DiscordBotClient.ChannelType.TEXT)));
        Study locked = givenLockedStudy();

        withGuild.link(ADMIN_ID, STUDY_ID, null);

        verify(locked)
                .changeDiscordChannelUrl(
                        "https://discord.com/channels/" + GUILD_ID + "/1327394882193883201");
    }

    @Test
    @DisplayName("캡틴이_넣어_둔_주소는_덮어쓰지_않는다")
    void 캡틴이_넣어_둔_주소는_덮어쓰지_않는다() {
        StudyDiscordLinkService withGuild = serviceWithGuild();
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디", DISCORD_USER_ID)).thenReturn(CREATED);
        when(discordBotClient.getStudyChannels(DISCORD_USER_ID, CREATED.discordStudyId()))
                .thenReturn(
                        List.of(
                                new DiscordBotClient.StudyChannel(
                                        "1327394882193883201",
                                        "로비",
                                        DiscordBotClient.ChannelType.TEXT)));
        Study locked = givenLockedStudy();
        when(locked.getDiscordChannelUrl()).thenReturn("https://discord.gg/old");

        withGuild.link(ADMIN_ID, STUDY_ID, null);

        verify(locked, never()).changeDiscordChannelUrl(anyString());
    }

    @Test
    @DisplayName("채널_조회가_실패해도_연결은_성공한다")
    void 채널_조회가_실패해도_연결은_성공한다() {
        StudyDiscordLinkService withGuild = serviceWithGuild();
        givenStudy("알고리즘 스터디");
        givenAccount(DISCORD_USER_ID);
        when(discordBotClient.createStudy("알고리즘 스터디", DISCORD_USER_ID)).thenReturn(CREATED);
        givenStudyStillExists(true);
        when(discordBotClient.getStudyChannels(DISCORD_USER_ID, CREATED.discordStudyId()))
                .thenThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR));

        assertThatCode(() -> withGuild.link(ADMIN_ID, STUDY_ID, null)).doesNotThrowAnyException();
    }

    private static final String GUILD_ID = "1327394882193883000";

    private StudyDiscordLinkService serviceWithGuild() {
        return new StudyDiscordLinkService(
                discordBotClient,
                studyDiscordLinkRepository,
                studyRepository,
                accountRepository,
                studyParticipantRepository,
                transactionTemplate,
                GUILD_ID);
    }

    /** 연결 저장과 주소 채우기가 둘 다 잠가서 읽는 같은 스터디를 받는다. */
    private Study givenLockedStudy() {
        Study locked = mock(Study.class);
        when(transactionTemplate.execute(any()))
                .thenAnswer(
                        inv -> inv.<TransactionCallback<?>>getArgument(0).doInTransaction(null));
        when(studyRepository.findByIdForUpdate(STUDY_ID)).thenReturn(Optional.of(locked));
        return locked;
    }

    private void givenStudyStillExists(boolean exists) {
        when(transactionTemplate.execute(any()))
                .thenAnswer(
                        inv -> inv.<TransactionCallback<?>>getArgument(0).doInTransaction(null));
        when(studyRepository.findByIdForUpdate(STUDY_ID))
                .thenReturn(exists ? Optional.of(mock(Study.class)) : Optional.empty());
    }

    private void givenStudy(String title) {
        Study study = mock(Study.class);
        lenient().when(study.getTitle()).thenReturn(title);
        when(studyRepository.findById(STUDY_ID)).thenReturn(Optional.of(study));
    }

    private void givenAccount(String discordId) {
        Account account = mock(Account.class);
        when(account.getDiscordId()).thenReturn(discordId);
        when(accountRepository.findById(ADMIN_ID)).thenReturn(Optional.of(account));
    }
}
