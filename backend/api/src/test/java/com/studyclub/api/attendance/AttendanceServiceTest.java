package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
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

/** includeWithdrawn 필터와 participantCount 전체 수 반환을 검증한다. */
@ExtendWith(MockitoExtension.class)
class AttendanceServiceTest {

    private static final Long STUDY_ID = 1L;
    private static final Long GROUP_ID = 10L;
    private static final Long ACTIVE_ACCOUNT_ID = 100L;
    private static final Long WITHDRAWN_ACCOUNT_ID = 101L;

    @Mock StudyRepository studyRepository;
    @Mock StudyGroupRepository studyGroupRepository;
    @Mock StudyParticipantRepository studyParticipantRepository;
    @Mock StudyMeetingRepository studyMeetingRepository;
    @Mock StudyAttendanceRepository studyAttendanceRepository;
    @Mock AccountRepository accountRepository;

    @InjectMocks AttendanceService service;

    @Test
    @DisplayName("includeWithdrawn=false — ACTIVE 참여자만 participants에 포함된다")
    void includeWithdrawn_false_ACTIVE만_포함된다() {
        givenStudyAndGroup();
        StudyParticipant active = stubParticipant(1L, ACTIVE_ACCOUNT_ID, ParticipantStatus.ACTIVE);
        StudyParticipant withdrawn =
                stubParticipant(2L, WITHDRAWN_ACCOUNT_ID, ParticipantStatus.WITHDRAWN);
        when(studyParticipantRepository.findByStudyGroupId(GROUP_ID))
                .thenReturn(List.of(active, withdrawn));
        when(studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(GROUP_ID))
                .thenReturn(List.of());
        when(accountRepository.findAllById(any())).thenReturn(List.of());

        AttendanceResponse response = service.getAttendances(STUDY_ID, GROUP_ID, null, false);

        assertThat(response.participants()).hasSize(1);
        assertThat(response.participants().get(0).participantId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("includeWithdrawn=true — WITHDRAWN 참여자도 participants에 포함된다")
    void includeWithdrawn_true_WITHDRAWN도_포함된다() {
        givenStudyAndGroup();
        StudyParticipant active = stubParticipant(1L, ACTIVE_ACCOUNT_ID, ParticipantStatus.ACTIVE);
        StudyParticipant withdrawn =
                stubParticipant(2L, WITHDRAWN_ACCOUNT_ID, ParticipantStatus.WITHDRAWN);
        when(studyParticipantRepository.findByStudyGroupId(GROUP_ID))
                .thenReturn(List.of(active, withdrawn));
        when(studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(GROUP_ID))
                .thenReturn(List.of());
        when(accountRepository.findAllById(any())).thenReturn(List.of());

        AttendanceResponse response = service.getAttendances(STUDY_ID, GROUP_ID, null, true);

        assertThat(response.participants()).hasSize(2);
    }

    @Test
    @DisplayName("includeWithdrawn=false여도 study.participantCount는 전체 수(ACTIVE+WITHDRAWN)를 반환한다")
    void participantCount는_필터_무관_전체_수를_반환한다() {
        givenStudyAndGroup();
        StudyParticipant active = stubParticipant(1L, ACTIVE_ACCOUNT_ID, ParticipantStatus.ACTIVE);
        StudyParticipant withdrawn =
                stubParticipant(2L, WITHDRAWN_ACCOUNT_ID, ParticipantStatus.WITHDRAWN);
        when(studyParticipantRepository.findByStudyGroupId(GROUP_ID))
                .thenReturn(List.of(active, withdrawn));
        when(studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(GROUP_ID))
                .thenReturn(List.of());
        when(accountRepository.findAllById(any())).thenReturn(List.of());

        AttendanceResponse response = service.getAttendances(STUDY_ID, GROUP_ID, null, false);

        assertThat(response.study().participantCount()).isEqualTo(2);
    }

    private void givenStudyAndGroup() {
        Study study = mock(Study.class);
        when(study.getId()).thenReturn(STUDY_ID);
        when(study.getTitle()).thenReturn("테스트 스터디");
        when(studyRepository.findById(STUDY_ID)).thenReturn(Optional.of(study));

        StudyGroup group = mock(StudyGroup.class);
        when(group.getStudyId()).thenReturn(STUDY_ID);
        when(studyGroupRepository.findById(GROUP_ID)).thenReturn(Optional.of(group));
    }

    private StudyParticipant stubParticipant(
            Long participantId, Long accountId, ParticipantStatus status) {
        return StudyParticipant.builder()
                .id(participantId)
                .accountId(accountId)
                .studyGroupId(GROUP_ID)
                .studyId(STUDY_ID)
                .status(status)
                .participantRole(ParticipantRole.MEMBER)
                .joinedAt(Instant.parse("2026-01-01T00:00:00Z"))
                .build();
    }
}
