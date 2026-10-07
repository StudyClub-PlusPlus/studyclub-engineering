package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AttendanceUpsertServiceTest {

    @Mock StudyRepository studyRepository;
    @Mock StudyGroupRepository studyGroupRepository;
    @Mock StudyParticipantRepository studyParticipantRepository;
    @Mock StudyMeetingRepository studyMeetingRepository;
    @Mock StudyAttendanceRepository attendanceRepository;

    @InjectMocks AttendanceUpsertService service;

    private static final Long STUDY_ID = 1L;
    private static final Long MEETING_ID = 100L;
    private static final Long PARTICIPANT_ID = 200L;
    private static final Long ACCOUNT_ID = 300L;
    private static final Long GROUP_ID = 400L;

    @Test
    @DisplayName("유효하지 않은 status 문자열이면 INVALID_INPUT")
    void 유효하지_않은_status_문자열이면_INVALID_INPUT() {
        givenStudyExists();
        givenGroupBelongsToStudy();

        var request =
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "NOT_A_STATUS")));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, GROUP_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("meetingId·participantId 중복 쌍이면 INVALID_INPUT")
    void meetingId_participantId_중복_쌍이면_INVALID_INPUT() {
        givenStudyExists();
        givenGroupBelongsToStudy();

        var item =
                new AttendanceUpsertRequest.AttendanceUpsertItem(
                        MEETING_ID, PARTICIPANT_ID, "PRESENT");
        var request = new AttendanceUpsertRequest(List.of(item, item));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, GROUP_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("스터디에 속하지 않는 meetingId이면 INVALID_INPUT")
    void 스터디에_속하지_않는_meetingId이면_INVALID_INPUT() {
        givenStudyExists();
        givenGroupBelongsToStudy();
        when(studyMeetingRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of());

        var request =
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "PRESENT")));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, GROUP_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("잠금을 기다리는 사이 회차가 지워졌으면 INVALID_INPUT")
    void 잠금_대기_중_회차가_지워지면_INVALID_INPUT() {
        givenStudyExists();
        givenGroupBelongsToStudy();
        StudyMeeting meeting = mock(StudyMeeting.class);
        when(meeting.getStudyGroupId()).thenReturn(GROUP_ID);
        when(studyMeetingRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of(meeting));
        when(studyMeetingRepository.findByStudyGroupIdForUpdate(GROUP_ID)).thenReturn(List.of());

        var request =
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "PRESENT")));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, GROUP_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
        verify(attendanceRepository, never())
                .upsertStatus(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("스터디에 속하지 않는 participantId이면 INVALID_INPUT")
    void 스터디에_속하지_않는_participantId이면_INVALID_INPUT() {
        givenStudyExists();
        givenGroupBelongsToStudy();
        givenMeetingInGroup();
        when(studyParticipantRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of());

        var request =
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "PRESENT")));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, GROUP_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("항목마다 참여자의 계정·분반으로 한 문장 upsert 를 부른다")
    void 항목마다_한_문장_upsert를_부른다() {
        givenHappyPath();

        service.upsert(
                STUDY_ID,
                GROUP_ID,
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "late"))));

        verify(attendanceRepository)
                .upsertStatus(
                        eq(ACCOUNT_ID),
                        eq(STUDY_ID),
                        eq(GROUP_ID),
                        eq(MEETING_ID),
                        eq(AttendanceStatus.LATE.name()),
                        any());
        verify(attendanceRepository, never()).saveAll(any());
    }

    private void givenStudyExists() {
        when(studyRepository.findById(STUDY_ID)).thenReturn(Optional.of(mock(Study.class)));
    }

    private void givenGroupBelongsToStudy() {
        StudyGroup group = mock(StudyGroup.class);
        when(group.getStudyId()).thenReturn(STUDY_ID);
        when(studyGroupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group));
    }

    private StudyParticipant stubParticipant() {
        return StudyParticipant.builder()
                .id(PARTICIPANT_ID)
                .accountId(ACCOUNT_ID)
                .studyGroupId(GROUP_ID)
                .studyId(STUDY_ID)
                .status(ParticipantStatus.ACTIVE)
                .participantRole(ParticipantRole.MEMBER)
                .joinedAt(Instant.now())
                .build();
    }

    private void givenHappyPath() {
        givenStudyExists();
        givenGroupBelongsToStudy();
        givenMeetingInGroup();
        when(studyParticipantRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of(stubParticipant()));
    }

    private void givenMeetingInGroup() {
        StudyMeeting meeting = mock(StudyMeeting.class);
        when(meeting.getId()).thenReturn(MEETING_ID);
        when(meeting.getStudyGroupId()).thenReturn(GROUP_ID);
        when(studyMeetingRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of(meeting));
        when(studyMeetingRepository.findByStudyGroupIdForUpdate(GROUP_ID))
                .thenReturn(List.of(meeting));
    }
}
