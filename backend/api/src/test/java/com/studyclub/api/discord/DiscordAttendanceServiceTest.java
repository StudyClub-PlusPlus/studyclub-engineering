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

/** 회차 선택 규칙, 반 가르기, 덮어쓰기 보호의 세부. HTTP 표면은 {@link DiscordAttendanceIntegrationTest} 가 본다. */
@ExtendWith(MockitoExtension.class)
class DiscordAttendanceServiceTest {

    private static final String DISCORD_STUDY_ID = "1327394882193883136";
    private static final String LEADER_DISCORD_ID = "1327394882193880001";
    private static final String MEMBER_DISCORD_ID = "1327394882193880002";
    private static final String OTHER_GROUP_DISCORD_ID = "1327394882193880003";
    private static final Long STUDY_ID = 7L;
    private static final Long GROUP_A = 70L;
    private static final Long GROUP_B = 71L;
    private static final Long LEADER_ACCOUNT_ID = 700L;
    private static final Long MEMBER_ACCOUNT_ID = 701L;
    private static final Long OTHER_GROUP_ACCOUNT_ID = 702L;

    @Mock StudyDiscordLinkRepository studyDiscordLinkRepository;
    @Mock StudyMeetingRepository studyMeetingRepository;
    @Mock StudyParticipantRepository studyParticipantRepository;
    @Mock StudyAttendanceRepository studyAttendanceRepository;
    @Mock AccountRepository accountRepository;

    @InjectMocks DiscordAttendanceService service;

    @Test
    @DisplayName("진행_중인_회차가_있으면_그_회차에_찍고_새로_시작하지_않는다")
    void 진행_중인_회차가_있으면_그_회차에_찍고_새로_시작하지_않는다() {
        StudyMeeting inProgress =
                meeting(1L, GROUP_A, Instant.now().minus(1, ChronoUnit.HOURS), true);
        StudyMeeting upcoming = meeting(2L, GROUP_A, Instant.now(), false);
        givenOneGroupStudy();
        givenMeetings(GROUP_A, List.of(inProgress, upcoming));
        givenAccounts();

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.groups())
                .singleElement()
                .satisfies(
                        g -> {
                            assertThat(g.studyGroupId()).isEqualTo(GROUP_A);
                            assertThat(g.studyMeetingId()).isEqualTo(1L);
                            assertThat(g.meetingStarted()).isFalse();
                        });
        assertThat(upcoming.getStartAt()).isNull();
    }

    @Test
    @DisplayName("진행_중인_회차가_없으면_2시간_이내_예정_회차를_시작시킨다")
    void 진행_중인_회차가_없으면_2시간_이내_예정_회차를_시작시킨다() {
        StudyMeeting upcoming =
                meeting(2L, GROUP_A, Instant.now().plus(90, ChronoUnit.MINUTES), false);
        givenOneGroupStudy();
        givenMeetings(GROUP_A, List.of(upcoming));
        givenAccounts();

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.groups())
                .singleElement()
                .satisfies(
                        g -> {
                            assertThat(g.studyMeetingId()).isEqualTo(2L);
                            assertThat(g.meetingStarted()).isTrue();
                        });
        assertThat(upcoming.getStartAt()).isNotNull();
    }

    @Test
    @DisplayName("예정_회차가_2시간_밖이면_찍지_않고_noMeeting_으로_돌려준다")
    void 예정_회차가_2시간_밖이면_찍지_않고_noMeeting_으로_돌려준다() {
        StudyMeeting far = meeting(2L, GROUP_A, Instant.now().plus(3, ChronoUnit.HOURS), false);
        givenOneGroupStudy();
        givenMeetings(GROUP_A, List.of(far));
        givenAccounts();

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.groups()).isEmpty();
        assertThat(response.noMeeting())
                .containsExactlyInAnyOrder(LEADER_DISCORD_ID, MEMBER_DISCORD_ID);
        assertThat(far.getStartAt()).isNull();
        verify(studyAttendanceRepository).saveAll(List.of());
    }

    @Test
    @DisplayName("끝난_회차만_있으면_소급_입력하지_않는다")
    void 끝난_회차만_있으면_소급_입력하지_않는다() {
        Instant scheduledAt = Instant.now().minus(30, ChronoUnit.MINUTES);
        StudyMeeting done =
                withId(
                        new StudyMeeting(
                                GROUP_A,
                                scheduledAt,
                                scheduledAt,
                                Instant.now().minus(5, ChronoUnit.MINUTES)),
                        3L);
        givenOneGroupStudy();
        givenMeetings(GROUP_A, List.of(done));
        givenAccounts();

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.groups()).isEmpty();
        assertThat(response.noMeeting()).isNotEmpty();
    }

    @Test
    @DisplayName("시작할_수_있는_회차가_2개면_409_아무거나_고르지_않는다")
    void 시작할_수_있는_회차가_2개면_409_아무거나_고르지_않는다() {
        givenOneGroupStudy();
        givenMeetings(
                GROUP_A,
                List.of(
                        meeting(4L, GROUP_A, Instant.now().plus(10, ChronoUnit.MINUTES), false),
                        meeting(5L, GROUP_A, Instant.now().plus(20, ChronoUnit.MINUTES), false)));
        givenAccounts();

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    @DisplayName("반이_여러_개면_각자_자기_반_회차에_찍힌다")
    void 반이_여러_개면_각자_자기_반_회차에_찍힌다() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyParticipantRepository.findByStudyId(STUDY_ID))
                .thenReturn(
                        List.of(
                                participant(LEADER_ACCOUNT_ID, GROUP_A, ParticipantRole.LEADER),
                                participant(MEMBER_ACCOUNT_ID, GROUP_A, ParticipantRole.MEMBER),
                                participant(
                                        OTHER_GROUP_ACCOUNT_ID, GROUP_B, ParticipantRole.MEMBER)));
        givenMeetings(GROUP_A, List.of(meeting(1L, GROUP_A, Instant.now(), true)));
        givenMeetings(GROUP_B, List.of(meeting(9L, GROUP_B, Instant.now(), true)));
        when(accountRepository.findByDiscordIdIn(any()))
                .thenReturn(
                        List.of(
                                account(LEADER_ACCOUNT_ID, LEADER_DISCORD_ID),
                                account(MEMBER_ACCOUNT_ID, MEMBER_DISCORD_ID),
                                account(OTHER_GROUP_ACCOUNT_ID, OTHER_GROUP_DISCORD_ID)));

        DiscordAttendanceResponse response =
                service.mark(
                        DISCORD_STUDY_ID,
                        new DiscordAttendanceRequest(
                                LEADER_DISCORD_ID,
                                List.of(
                                        LEADER_DISCORD_ID,
                                        MEMBER_DISCORD_ID,
                                        OTHER_GROUP_DISCORD_ID)));

        assertThat(response.groups()).hasSize(2);
        assertThat(response.groups())
                .anySatisfy(
                        g -> {
                            assertThat(g.studyGroupId()).isEqualTo(GROUP_A);
                            assertThat(g.studyMeetingId()).isEqualTo(1L);
                            assertThat(g.marked())
                                    .containsExactlyInAnyOrder(
                                            LEADER_DISCORD_ID, MEMBER_DISCORD_ID);
                        })
                .anySatisfy(
                        g -> {
                            assertThat(g.studyGroupId()).isEqualTo(GROUP_B);
                            assertThat(g.studyMeetingId()).isEqualTo(9L);
                            assertThat(g.marked()).containsExactly(OTHER_GROUP_DISCORD_ID);
                        });
        assertThat(response.noMeeting()).isEmpty();
    }

    @Test
    @DisplayName("한_반만_모이는_중이면_나머지_반_사람은_noMeeting_이고_전체가_실패하지_않는다")
    void 한_반만_모이는_중이면_나머지_반_사람은_noMeeting_이고_전체가_실패하지_않는다() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyParticipantRepository.findByStudyId(STUDY_ID))
                .thenReturn(
                        List.of(
                                participant(LEADER_ACCOUNT_ID, GROUP_A, ParticipantRole.LEADER),
                                participant(
                                        OTHER_GROUP_ACCOUNT_ID, GROUP_B, ParticipantRole.MEMBER)));
        givenMeetings(GROUP_A, List.of(meeting(1L, GROUP_A, Instant.now(), true)));
        givenMeetings(GROUP_B, List.of());
        when(accountRepository.findByDiscordIdIn(any()))
                .thenReturn(
                        List.of(
                                account(LEADER_ACCOUNT_ID, LEADER_DISCORD_ID),
                                account(OTHER_GROUP_ACCOUNT_ID, OTHER_GROUP_DISCORD_ID)));

        DiscordAttendanceResponse response =
                service.mark(
                        DISCORD_STUDY_ID,
                        new DiscordAttendanceRequest(
                                LEADER_DISCORD_ID,
                                List.of(LEADER_DISCORD_ID, OTHER_GROUP_DISCORD_ID)));

        assertThat(response.groups())
                .singleElement()
                .satisfies(
                        g -> {
                            assertThat(g.studyGroupId()).isEqualTo(GROUP_A);
                            assertThat(g.marked()).containsExactly(LEADER_DISCORD_ID);
                        });
        assertThat(response.noMeeting()).containsExactly(OTHER_GROUP_DISCORD_ID);
    }

    @Test
    @DisplayName("옆_반_반장이_쳐도_통과한다_공부방을_같이_쓴다")
    void 옆_반_반장이_쳐도_통과한다_공부방을_같이_쓴다() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyParticipantRepository.findByStudyId(STUDY_ID))
                .thenReturn(
                        List.of(
                                participant(LEADER_ACCOUNT_ID, GROUP_B, ParticipantRole.LEADER),
                                participant(MEMBER_ACCOUNT_ID, GROUP_A, ParticipantRole.MEMBER)));
        givenMeetings(GROUP_A, List.of(meeting(1L, GROUP_A, Instant.now(), true)));
        givenAccounts();

        DiscordAttendanceResponse response =
                service.mark(
                        DISCORD_STUDY_ID,
                        new DiscordAttendanceRequest(
                                LEADER_DISCORD_ID, List.of(MEMBER_DISCORD_ID)));

        assertThat(response.groups())
                .singleElement()
                .satisfies(
                        g -> {
                            assertThat(g.studyGroupId()).isEqualTo(GROUP_A);
                            assertThat(g.marked()).containsExactly(MEMBER_DISCORD_ID);
                        });
    }

    @Test
    @DisplayName("호출자가_반장이_아니면_403_회차를_건드리지_않는다")
    void 호출자가_반장이_아니면_403_회차를_건드리지_않는다() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyParticipantRepository.findByStudyId(STUDY_ID))
                .thenReturn(
                        List.of(participant(LEADER_ACCOUNT_ID, GROUP_A, ParticipantRole.MEMBER)));
        givenAccounts();

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
        verify(studyMeetingRepository, never()).findByStudyGroupIdForUpdate(any());
    }

    @Test
    @DisplayName("하차한_전_반장은_역할이_남아있어도_403")
    void 하차한_전_반장은_역할이_남아있어도_403() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyParticipantRepository.findByStudyId(STUDY_ID))
                .thenReturn(
                        List.of(
                                participant(
                                        LEADER_ACCOUNT_ID,
                                        GROUP_A,
                                        ParticipantRole.LEADER,
                                        ParticipantStatus.WITHDRAWN)));
        givenAccounts();

        assertThatThrownBy(() -> service.mark(DISCORD_STUDY_ID, request()))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("LATE_와_EXCUSED_는_스냅샷으로_덮어쓰지_않는다")
    void LATE_와_EXCUSED_는_스냅샷으로_덮어쓰지_않는다() {
        givenOneGroupStudy();
        givenMeetings(GROUP_A, List.of(meeting(1L, GROUP_A, Instant.now(), true)));
        givenAccounts();
        StudyAttendance late = attendance(MEMBER_ACCOUNT_ID, AttendanceStatus.LATE);
        StudyAttendance excused = attendance(LEADER_ACCOUNT_ID, AttendanceStatus.EXCUSED);
        when(studyAttendanceRepository.findByStudyMeetingIdIn(List.of(1L)))
                .thenReturn(List.of(late, excused));

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(late.getStatus()).isEqualTo(AttendanceStatus.LATE);
        assertThat(excused.getStatus()).isEqualTo(AttendanceStatus.EXCUSED);
        assertThat(response.groups().get(0).marked())
                .containsExactlyInAnyOrder(LEADER_DISCORD_ID, MEMBER_DISCORD_ID);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<StudyAttendance>> saved = ArgumentCaptor.forClass(List.class);
        verify(studyAttendanceRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).isEmpty();
    }

    @Test
    @DisplayName("ABSENT_는_PRESENT_로_올린다")
    void ABSENT_는_PRESENT_로_올린다() {
        givenOneGroupStudy();
        givenMeetings(GROUP_A, List.of(meeting(1L, GROUP_A, Instant.now(), true)));
        givenAccounts();
        StudyAttendance absent = attendance(MEMBER_ACCOUNT_ID, AttendanceStatus.ABSENT);
        when(studyAttendanceRepository.findByStudyMeetingIdIn(List.of(1L)))
                .thenReturn(List.of(absent));

        service.mark(DISCORD_STUDY_ID, request());

        assertThat(absent.getStatus()).isEqualTo(AttendanceStatus.PRESENT);
    }

    @Test
    @DisplayName("연동_안된_유저는_에러가_아니라_unmatched_로_돌려준다")
    void 연동_안된_유저는_에러가_아니라_unmatched_로_돌려준다() {
        givenOneGroupStudy();
        givenMeetings(GROUP_A, List.of(meeting(1L, GROUP_A, Instant.now(), true)));
        when(accountRepository.findByDiscordIdIn(any()))
                .thenReturn(List.of(account(LEADER_ACCOUNT_ID, LEADER_DISCORD_ID)));

        DiscordAttendanceResponse response = service.mark(DISCORD_STUDY_ID, request());

        assertThat(response.unmatched()).containsExactly(MEMBER_DISCORD_ID);
        assertThat(response.groups().get(0).marked()).containsExactly(LEADER_DISCORD_ID);
    }

    private DiscordAttendanceRequest request() {
        return new DiscordAttendanceRequest(
                LEADER_DISCORD_ID, List.of(LEADER_DISCORD_ID, MEMBER_DISCORD_ID));
    }

    private void givenOneGroupStudy() {
        when(studyDiscordLinkRepository.findByDiscordStudyId(DISCORD_STUDY_ID))
                .thenReturn(Optional.of(link()));
        when(studyParticipantRepository.findByStudyId(STUDY_ID))
                .thenReturn(
                        List.of(
                                participant(LEADER_ACCOUNT_ID, GROUP_A, ParticipantRole.LEADER),
                                participant(MEMBER_ACCOUNT_ID, GROUP_A, ParticipantRole.MEMBER)));
    }

    private void givenMeetings(Long groupId, List<StudyMeeting> meetings) {
        when(studyMeetingRepository.findByStudyGroupIdForUpdate(groupId)).thenReturn(meetings);
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

    private StudyParticipant participant(Long accountId, Long groupId, ParticipantRole role) {
        return participant(accountId, groupId, role, ParticipantStatus.ACTIVE);
    }

    private StudyParticipant participant(
            Long accountId, Long groupId, ParticipantRole role, ParticipantStatus status) {
        return StudyParticipant.builder()
                .accountId(accountId)
                .studyGroupId(groupId)
                .studyId(STUDY_ID)
                .status(status)
                .participantRole(role)
                .joinedAt(Instant.now())
                .build();
    }

    private StudyAttendance attendance(Long accountId, AttendanceStatus status) {
        return StudyAttendance.builder()
                .accountId(accountId)
                .studyId(STUDY_ID)
                .studyGroupId(GROUP_A)
                .studyMeetingId(1L)
                .status(status)
                .build();
    }

    private Account account(Long id, String discordId) {
        Account account = new Account("a" + id + "@test.com", "n" + id, null, SystemRole.MEMBER);
        ReflectionTestUtils.setField(account, "discordId", discordId);
        return withId(account, id);
    }

    private StudyMeeting meeting(Long id, Long groupId, Instant scheduledAt, boolean started) {
        return withId(
                new StudyMeeting(groupId, scheduledAt, started ? scheduledAt : null, null), id);
    }

    /** 엔티티 ID 는 DB 가 채우므로 단위 테스트에서는 직접 넣는다. */
    private <T> T withId(T entity, Long id) {
        ReflectionTestUtils.setField(entity, "id", id);
        return entity;
    }
}
