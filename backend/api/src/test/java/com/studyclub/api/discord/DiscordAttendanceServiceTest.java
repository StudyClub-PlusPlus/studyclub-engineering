package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
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
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** 회차 선택 규칙과 덮어쓰기 보호의 세부. HTTP 표면은 {@link DiscordAttendanceIntegrationTest} 가 본다. */
@ExtendWith(MockitoExtension.class)
class DiscordAttendanceServiceTest {

    private static final String DISCORD_STUDY_ID = "1327394882193883136";
    private static final String LEADER_DISCORD_ID = "1327394882193880001";
    private static final String MEMBER_DISCORD_ID = "1327394882193880002";
    private static final Long STUDY_ID = 7L;
    private static final Long GROUP_ID = 70L;
    private static final Long LEADER_ACCOUNT_ID = 700L;
    private static final Long MEMBER_ACCOUNT_ID = 701L;

    @Mock StudyDiscordLinkRepository studyDiscordLinkRepository;
    @Mock StudyGroupRepository studyGroupRepository;
    @Mock StudyMeetingRepository studyMeetingRepository;
    @Mock StudyParticipantRepository studyParticipantRepository;
    @Mock StudyAttendanceRepository studyAttendanceRepository;
    @Mock AccountRepository accountRepository;

    @InjectMocks DiscordAttendanceService service;

    @Test
    @DisplayName("진행_중인_회차가_있으면_그_회차에_찍고_새로_시작하지_않는다")
    void 진행_중인_회차가_있으면_그_회차에_찍고_새로_시작하지_않는다() {
        StudyMeeting inProgress = meeting(1L, Instant.now().minus(1, ChronoUnit.HOURS), true);
        StudyMeeting upcoming = meeting(2L, Instant.now(), false);
        givenStudyWithMeetings(List.of(inProgress, upcoming));
        givenAccounts();

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.studyMeetingId()).isEqualTo(1L);
        assertThat(response.meetingStarted()).isFalse();
        assertThat(upcoming.getStartAt()).isNull();
    }

    @Test
    @DisplayName("진행_중인_회차가_없으면_2시간_이내_예정_회차를_시작시킨다")
    void 진행_중인_회차가_없으면_2시간_이내_예정_회차를_시작시킨다() {
        StudyMeeting upcoming = meeting(2L, Instant.now().plus(90, ChronoUnit.MINUTES), false);
        givenStudyWithMeetings(List.of(upcoming));
        givenAccounts();

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.studyMeetingId()).isEqualTo(2L);
        assertThat(response.meetingStarted()).isTrue();
        assertThat(upcoming.getStartAt()).isNotNull();
    }

    @Test
    @DisplayName("예정_회차가_2시간_밖이면_404_찍지_않는다")
    void 예정_회차가_2시간_밖이면_404_찍지_않는다() {
        StudyMeeting far = meeting(2L, Instant.now().plus(3, ChronoUnit.HOURS), false);
        givenStudyWithMeetings(List.of(far));
        givenAccounts();

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(far.getStartAt()).isNull();
        verify(studyAttendanceRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("끝난_회차만_있으면_404_소급_입력하지_않는다")
    void 끝난_회차만_있으면_404_소급_입력하지_않는다() {
        Instant scheduledAt = Instant.now().minus(30, ChronoUnit.MINUTES);
        StudyMeeting done =
                withId(
                        new StudyMeeting(
                                GROUP_ID,
                                scheduledAt,
                                scheduledAt,
                                Instant.now().minus(5, ChronoUnit.MINUTES)),
                        3L);
        givenStudyWithMeetings(List.of(done));
        givenAccounts();

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("시작할_수_있는_회차가_2개면_409_아무거나_고르지_않는다")
    void 시작할_수_있는_회차가_2개면_409_아무거나_고르지_않는다() {
        givenStudyWithMeetings(
                List.of(
                        meeting(4L, Instant.now().plus(10, ChronoUnit.MINUTES), false),
                        meeting(5L, Instant.now().plus(20, ChronoUnit.MINUTES), false)));
        givenAccounts();

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    @DisplayName("분반이_2개면_409_어느_반인지_정할_수_없다")
    void 분반이_2개면_409_어느_반인지_정할_수_없다() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyGroupRepository.findByStudyId(STUDY_ID))
                .thenReturn(List.of(group(GROUP_ID), group(71L)));

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    @DisplayName("호출자가_반장이_아니면_403_회차를_시작시키지_않는다")
    void 호출자가_반장이_아니면_403_회차를_시작시키지_않는다() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyGroupRepository.findByStudyId(STUDY_ID)).thenReturn(List.of(group(GROUP_ID)));
        when(studyParticipantRepository.findByStudyGroupId(GROUP_ID))
                .thenReturn(
                        List.of(
                                participant(
                                        LEADER_ACCOUNT_ID,
                                        ParticipantRole.MEMBER,
                                        ParticipantStatus.ACTIVE)));
        givenAccounts();

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
        verify(studyMeetingRepository, never()).findByStudyGroupIdOrderByScheduledAt(any());
    }

    @Test
    @DisplayName("LATE_와_EXCUSED_는_스냅샷으로_덮어쓰지_않는다")
    void LATE_와_EXCUSED_는_스냅샷으로_덮어쓰지_않는다() {
        givenStudyWithMeetings(List.of(meeting(1L, Instant.now(), true)));
        givenAccounts();
        StudyAttendance late =
                StudyAttendance.builder()
                        .accountId(MEMBER_ACCOUNT_ID)
                        .studyId(STUDY_ID)
                        .studyGroupId(GROUP_ID)
                        .studyMeetingId(1L)
                        .status(AttendanceStatus.LATE)
                        .build();
        when(studyAttendanceRepository.findByStudyMeetingIdIn(List.of(1L)))
                .thenReturn(List.of(late));

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(late.getStatus()).isEqualTo(AttendanceStatus.LATE);
        assertThat(response.marked()).contains(MEMBER_DISCORD_ID);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<StudyAttendance>> saved = ArgumentCaptor.forClass(List.class);
        verify(studyAttendanceRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).noneMatch(a -> a.getAccountId().equals(MEMBER_ACCOUNT_ID));
    }

    @Test
    @DisplayName("연동_안된_유저는_에러가_아니라_unmatched_로_돌려준다")
    void 연동_안된_유저는_에러가_아니라_unmatched_로_돌려준다() {
        givenStudyWithMeetings(List.of(meeting(1L, Instant.now(), true)));
        when(accountRepository.findByDiscordIdIn(any()))
                .thenReturn(List.of(account(LEADER_ACCOUNT_ID, LEADER_DISCORD_ID)));

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.unmatched()).containsExactly(MEMBER_DISCORD_ID);
        assertThat(response.marked()).containsExactly(LEADER_DISCORD_ID);
    }

    private DiscordAttendanceRequest request() {
        return new DiscordAttendanceRequest(
                LEADER_DISCORD_ID, List.of(LEADER_DISCORD_ID, MEMBER_DISCORD_ID));
    }

    private void givenStudyWithMeetings(List<StudyMeeting> meetings) {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyGroupRepository.findByStudyId(STUDY_ID)).thenReturn(List.of(group(GROUP_ID)));
        when(studyParticipantRepository.findByStudyGroupId(GROUP_ID))
                .thenReturn(
                        List.of(
                                participant(
                                        LEADER_ACCOUNT_ID,
                                        ParticipantRole.LEADER,
                                        ParticipantStatus.ACTIVE),
                                participant(
                                        MEMBER_ACCOUNT_ID,
                                        ParticipantRole.MEMBER,
                                        ParticipantStatus.ACTIVE)));
        when(studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(GROUP_ID))
                .thenReturn(meetings);
    }

    private void givenAccounts() {
        when(accountRepository.findByDiscordIdIn(any()))
                .thenReturn(
                        List.of(
                                account(LEADER_ACCOUNT_ID, LEADER_DISCORD_ID),
                                account(MEMBER_ACCOUNT_ID, MEMBER_DISCORD_ID)));
    }

    private StudyDiscordLink link() {
        return new StudyDiscordLink(STUDY_ID, DISCORD_STUDY_ID, "1327394882193883140");
    }

    private StudyGroup group(Long id) {
        return withId(new StudyGroup(STUDY_ID, "A반", Instant.now(), "Asia/Seoul", 10), id);
    }

    private StudyParticipant participant(
            Long accountId, ParticipantRole role, ParticipantStatus status) {
        return StudyParticipant.builder()
                .accountId(accountId)
                .studyGroupId(GROUP_ID)
                .studyId(STUDY_ID)
                .status(status)
                .participantRole(role)
                .joinedAt(Instant.now())
                .build();
    }

    private Account account(Long id, String discordId) {
        Account account = new Account("a" + id + "@test.com", "n" + id, null, SystemRole.MEMBER);
        ReflectionTestUtils.setField(account, "discordId", discordId);
        return withId(account, id);
    }

    private StudyMeeting meeting(Long id, Instant scheduledAt, boolean started) {
        return withId(
                new StudyMeeting(GROUP_ID, scheduledAt, started ? scheduledAt : null, null), id);
    }

    /** 엔티티 ID 는 DB 가 채우므로 단위 테스트에서는 직접 넣는다. */
    private <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
