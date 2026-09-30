package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
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
class AttendanceUpsertServiceTest {

    @Mock StudyRepository studyRepository;
    @Mock StudyParticipantRepository participantRepository;
    @Mock StudyMeetingRepository studyMeetingRepository;
    @Mock StudyAttendanceRepository attendanceRepository;

    @InjectMocks AttendanceUpsertService service;

    private static final Long STUDY_ID = 1L;
    private static final Long CALLER_ACCOUNT_ID = 10L;
    private static final Long MEETING_ID = 100L;
    private static final Long PARTICIPANT_ID = 200L;
    private static final Long ACCOUNT_ID = 300L;
    private static final Long GROUP_ID = 400L;

    // ─────────────────────────────────────────────────────────────────────────
    // validateRequests()
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("유효하지 않은 status 문자열이면 INVALID_INPUT — AttendanceStatus.from() 예외가 포장된다")
    void 유효하지_않은_status_문자열이면_INVALID_INPUT() {
        givenStudyExists();
        givenCallerIsCaptain();

        var request =
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "NOT_A_STATUS")));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, CALLER_ACCOUNT_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("meetingId·participantId 중복 쌍이면 INVALID_INPUT — 같은 조합이 두 번 오면 막는다")
    void meetingId_participantId_중복_쌍이면_INVALID_INPUT() {
        givenStudyExists();
        givenCallerIsCaptain();

        var item =
                new AttendanceUpsertRequest.AttendanceUpsertItem(
                        MEETING_ID, PARTICIPANT_ID, "PRESENT");
        var request = new AttendanceUpsertRequest(List.of(item, item));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, CALLER_ACCOUNT_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validateMeetingsBelongToStudy()
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("스터디에 속하지 않는 meetingId이면 INVALID_INPUT — 레포가 요청보다 적은 미팅을 반환한다")
    void 스터디에_속하지_않는_meetingId이면_INVALID_INPUT() {
        givenStudyExists();
        givenCallerIsCaptain();
        when(studyMeetingRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of()); // size(0) < requested(1)

        var request =
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "PRESENT")));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, CALLER_ACCOUNT_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // loadAndValidateParticipants()
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("스터디에 속하지 않는 participantId이면 INVALID_INPUT — 레포가 요청보다 적은 참여자를 반환한다")
    void 스터디에_속하지_않는_participantId이면_INVALID_INPUT() {
        givenStudyExists();
        givenCallerIsCaptain();
        when(studyMeetingRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of(mock(StudyMeeting.class)));
        when(participantRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of()); // size(0) < requested(1)

        var request =
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "PRESENT")));

        assertThatThrownBy(() -> service.upsert(STUDY_ID, CALLER_ACCOUNT_ID, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // buildToSave() — 기존 출석 없음 → 새 레코드
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName(
            "기존 출석 없으면 올바른 필드로 새 레코드를 생성한다 — accountId·studyId·studyGroupId·studyMeetingId·status 모두 채워진다")
    void 기존_출석_없으면_올바른_필드로_새_레코드를_생성한다() {
        givenHappyPath(List.of());

        service.upsert(
                STUDY_ID,
                CALLER_ACCOUNT_ID,
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "PRESENT"))));

        List<StudyAttendance> saved = captureSaveAll();
        assertThat(saved).hasSize(1);
        StudyAttendance record = saved.get(0);
        assertThat(record.getAccountId()).isEqualTo(ACCOUNT_ID);
        assertThat(record.getStudyId()).isEqualTo(STUDY_ID);
        assertThat(record.getStudyGroupId()).isEqualTo(GROUP_ID);
        assertThat(record.getStudyMeetingId()).isEqualTo(MEETING_ID);
        assertThat(record.getStatus()).isEqualTo(AttendanceStatus.PRESENT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // buildToSave() — 기존 출석 있음 → status 만 교체
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("기존 출석 있으면 status만 업데이트한다 — 같은 엔티티 인스턴스가 saveAll 에 전달된다")
    void 기존_출석_있으면_status만_업데이트한다() {
        StudyAttendance existing =
                StudyAttendance.builder()
                        .accountId(ACCOUNT_ID)
                        .studyId(STUDY_ID)
                        .studyGroupId(GROUP_ID)
                        .studyMeetingId(MEETING_ID)
                        .status(AttendanceStatus.PRESENT)
                        .build();

        givenHappyPath(List.of(existing));

        service.upsert(
                STUDY_ID,
                CALLER_ACCOUNT_ID,
                new AttendanceUpsertRequest(
                        List.of(
                                new AttendanceUpsertRequest.AttendanceUpsertItem(
                                        MEETING_ID, PARTICIPANT_ID, "ABSENT"))));

        List<StudyAttendance> saved = captureSaveAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0)).isSameAs(existing);
        assertThat(saved.get(0).getStatus()).isEqualTo(AttendanceStatus.ABSENT);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // helpers
    // ─────────────────────────────────────────────────────────────────────────

    private void givenStudyExists() {
        when(studyRepository.findById(STUDY_ID)).thenReturn(Optional.of(mock(Study.class)));
    }

    private void givenCallerIsCaptain() {
        when(participantRepository.existsByAccountIdAndStudyIdAndParticipantRoleIn(
                        eq(CALLER_ACCOUNT_ID), eq(STUDY_ID), any()))
                .thenReturn(true);
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

    private void givenHappyPath(List<StudyAttendance> existingAttendances) {
        givenStudyExists();
        givenCallerIsCaptain();
        when(studyMeetingRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of(mock(StudyMeeting.class)));
        when(participantRepository.findByIdInAndStudyId(any(), eq(STUDY_ID)))
                .thenReturn(List.of(stubParticipant()));
        when(attendanceRepository.findByStudyMeetingIdIn(any())).thenReturn(existingAttendances);
        when(attendanceRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @SuppressWarnings("unchecked")
    private List<StudyAttendance> captureSaveAll() {
        ArgumentCaptor<List<StudyAttendance>> captor = ArgumentCaptor.forClass(List.class);
        verify(attendanceRepository).saveAll(captor.capture());
        return captor.getValue();
    }
}
