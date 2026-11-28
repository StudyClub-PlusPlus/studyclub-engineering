package com.studyclub.api.retro;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.retro.RetroSection;
import com.studyclub.domain.retro.StudyMeetingRetro;
import com.studyclub.domain.retro.StudyMeetingRetroLikeRepository;
import com.studyclub.domain.retro.StudyMeetingRetroRepository;
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

@ExtendWith(MockitoExtension.class)
class MeetingRetroServiceTest {

    private static final Long ACCOUNT_ID = 1L;
    private static final Long STUDY_ID = 10L;
    private static final Long GROUP_ID = 100L;
    private static final Long MEETING_ID = 200L;
    private static final Long PARTICIPANT_ID = 300L;
    private static final Long RETRO_ID = 400L;

    @Mock StudyMeetingRepository meetingRepository;
    @Mock StudyGroupRepository groupRepository;
    @Mock StudyParticipantRepository participantRepository;
    @Mock AccountRepository accountRepository;
    @Mock StudyMeetingRetroRepository retroRepository;
    @Mock StudyMeetingRetroLikeRepository likeRepository;
    @Mock StudyCaptainGuard studyCaptainGuard;

    @InjectMocks MeetingRetroService service;

    // ── 회고 작성 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("회고_작성_앞뒤_공백이_제거된다")
    void 회고_작성_앞뒤_공백이_제거된다() {
        Instant meetingStart = Instant.now().minus(2, ChronoUnit.DAYS);
        StudyMeeting ended =
                mockMeeting(meetingStart, false, meetingStart.plus(2, ChronoUnit.HOURS));
        givenMeetingInGroup(ended);

        // 다음 회차(기한) — isKickoff, scheduledAt 만 필요
        StudyMeeting next = mock(StudyMeeting.class);
        when(next.isKickoff()).thenReturn(false);
        when(next.getScheduledAt()).thenReturn(Instant.now().plus(5, ChronoUnit.DAYS));
        when(meetingRepository.findByStudyGroupIdOrderByScheduledAt(GROUP_ID))
                .thenReturn(List.of(ended, next));

        StudyParticipant participant =
                StudyParticipant.builder()
                        .id(PARTICIPANT_ID)
                        .accountId(ACCOUNT_ID)
                        .studyGroupId(GROUP_ID)
                        .studyId(STUDY_ID)
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(meetingStart.minus(10, ChronoUnit.DAYS))
                        .build();
        when(participantRepository.findByStudyGroupIdAndAccountId(GROUP_ID, ACCOUNT_ID))
                .thenReturn(Optional.of(participant));
        when(retroRepository.findByMeetingIdAndParticipantId(MEETING_ID, PARTICIPANT_ID))
                .thenReturn(Optional.empty());
        when(retroRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.write(
                ACCOUNT_ID,
                STUDY_ID,
                MEETING_ID,
                new MeetingRetroRequests.WriteRetro("  좋았어요  ", "  개선점  ", "  소감  "));

        ArgumentCaptor<StudyMeetingRetro> captor = ArgumentCaptor.forClass(StudyMeetingRetro.class);
        verify(retroRepository).save(captor.capture());
        assertThat(captor.getValue().getGood()).isEqualTo("좋았어요");
        assertThat(captor.getValue().getImprove()).isEqualTo("개선점");
        assertThat(captor.getValue().getFeeling()).isEqualTo("소감");
    }

    @Test
    @DisplayName("회고_작성_실패_회차_이후_합류한_참여자_403")
    void 회고_작성_실패_회차_이후_합류한_참여자_403() {
        Instant meetingStart = Instant.now().minus(2, ChronoUnit.DAYS);
        StudyMeeting ended =
                mockMeeting(meetingStart, false, meetingStart.plus(2, ChronoUnit.HOURS));
        givenMeetingInGroup(ended);

        StudyMeeting next = mock(StudyMeeting.class);
        when(next.isKickoff()).thenReturn(false);
        when(next.getScheduledAt()).thenReturn(Instant.now().plus(5, ChronoUnit.DAYS));
        when(meetingRepository.findByStudyGroupIdOrderByScheduledAt(GROUP_ID))
                .thenReturn(List.of(ended, next));

        // 회차 시작(2일 전) 이후 합류 (1일 전)
        StudyParticipant late =
                StudyParticipant.builder()
                        .id(PARTICIPANT_ID)
                        .accountId(ACCOUNT_ID)
                        .studyGroupId(GROUP_ID)
                        .studyId(STUDY_ID)
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now().minus(1, ChronoUnit.DAYS))
                        .build();
        when(participantRepository.findByStudyGroupIdAndAccountId(GROUP_ID, ACCOUNT_ID))
                .thenReturn(Optional.of(late));

        assertThatThrownBy(
                        () ->
                                service.write(
                                        ACCOUNT_ID,
                                        STUDY_ID,
                                        MEETING_ID,
                                        new MeetingRetroRequests.WriteRetro("좋았어요", "개선점", "")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    // ── 회고 목록 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("회고_목록_미팅_미종료_409_RETRO_NOT_OPEN")
    void 회고_목록_미팅_미종료_409() {
        // 아직 끝나지 않은 회차 — scheduledAt + 120분이 미래
        StudyMeeting future = mockMeeting(Instant.now().plus(5, ChronoUnit.DAYS), false, null);
        givenMeetingInGroup(future);
        when(accountRepository.findById(ACCOUNT_ID)).thenReturn(Optional.of(mock(Account.class)));

        assertThatThrownBy(() -> service.list(ACCOUNT_ID, STUDY_ID, MEETING_ID, null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.RETRO_NOT_OPEN);
    }

    // ── 뷰어 컨텍스트 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("뷰어_컨텍스트_미팅_미종료_409_RETRO_NOT_OPEN")
    void 뷰어_컨텍스트_미팅_미종료_409() {
        StudyMeeting future = mockMeeting(Instant.now().plus(5, ChronoUnit.DAYS), false, null);
        givenMeetingInGroup(future);

        assertThatThrownBy(() -> service.viewerContext(ACCOUNT_ID, STUDY_ID, MEETING_ID))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.RETRO_NOT_OPEN);
    }

    // ── 공감 ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("공감_실패_비운_소감_409_EMPTY_SECTION")
    void 공감_실패_비운_소감_409() {
        StudyMeeting meeting = mock(StudyMeeting.class);
        when(meeting.getStudyGroupId()).thenReturn(GROUP_ID);
        givenMeetingInGroup(meeting);

        StudyMeetingRetro retro = mock(StudyMeetingRetro.class);
        when(retro.getMeetingId()).thenReturn(MEETING_ID);
        when(retro.getFeeling()).thenReturn("");
        when(retroRepository.findById(RETRO_ID)).thenReturn(Optional.of(retro));
        // 자기 회고 아님 — 참여자 없음
        when(participantRepository.findByStudyGroupIdAndAccountId(GROUP_ID, ACCOUNT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service.like(
                                        ACCOUNT_ID,
                                        STUDY_ID,
                                        MEETING_ID,
                                        RETRO_ID,
                                        RetroSection.FEELING))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.EMPTY_SECTION);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** meetingRepository + groupRepository stub — service 의 meeting() 헬퍼가 쓰는 최소 stub. */
    private void givenMeetingInGroup(StudyMeeting meeting) {
        StudyGroup group = mock(StudyGroup.class);
        when(group.getStudyId()).thenReturn(STUDY_ID);
        when(meetingRepository.findById(MEETING_ID)).thenReturn(Optional.of(meeting));
        when(groupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group));
    }

    private StudyMeeting mockMeeting(Instant scheduledAt, boolean kickoff, Instant endAt) {
        StudyMeeting m = mock(StudyMeeting.class);
        when(m.getStudyGroupId()).thenReturn(GROUP_ID);
        when(m.isKickoff()).thenReturn(kickoff);
        when(m.getScheduledAt()).thenReturn(scheduledAt);
        when(m.getEndAt()).thenReturn(endAt);
        return m;
    }
}
