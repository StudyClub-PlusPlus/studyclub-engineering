package com.studyclub.api.attendance;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.commons.lang3.tuple.Pair;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class AttendanceUpsertService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceUpsertService.class);
    private final StudyCaptainGuard studyCaptainGuard;

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;

    public AttendanceUpsertService(
            StudyCaptainGuard studyCaptainGuard,
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository) {
        this.studyCaptainGuard = studyCaptainGuard;
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
    }

    @Transactional
    public void upsert(
            Long studyId,
            Long studyGroupId,
            AttendanceUpsertRequest request,
            Long accountId,
            boolean admin) {
        StudyGroup group = lockGroup(studyGroupId);
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!studyId.equals(group.getStudyId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "studyGroupId가 이 스터디에 속하지 않습니다.");
        }
        if (admin) {
            studyCaptainGuard.assertCaptain(accountId, "권한이 없습니다.");
        } else if (!request.withdrawals().isEmpty()) {
            studyCaptainGuard.assertCanWithdrawParticipant(
                    accountId, study.getCreatedBy(), studyGroupId);
        } else {
            studyCaptainGuard.assertCaptainOrNavigatorOfGroup(
                    accountId, studyId, studyGroupId, "권한이 없습니다.");
        }
        if (!request.isNotEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        List<StudyParticipant> withdrawals =
                validateWithdrawals(study, studyGroupId, request.withdrawals(), accountId);

        List<AttendanceUpsertRequest.AttendanceUpsertItem> upsertRequests = request.updates();
        ValidRequestContext validRequestContext = validateRequests(upsertRequests);

        List<StudyMeeting> meetings =
                validateMeetingsBelongToGroup(
                        validRequestContext.meetingIds(), studyId, studyGroupId);
        Map<Long, StudyParticipant> participantById =
                loadAndValidateParticipants(validRequestContext.participantIds(), studyId);

        Instant now = Instant.now();
        // 출석 upsert가 영속성 컨텍스트를 비우므로 명부·발표자 변경을 먼저 반영한다.
        for (StudyParticipant participant : withdrawals) {
            if (!participant.markWithdrawn(now)) {
                continue;
            }
            for (StudyMeeting meeting : meetings) {
                meeting.releasePresenterAfterWithdrawal(
                        participant.getId(), participant.getLeftAt());
            }
        }
        for (int i = 0; i < upsertRequests.size(); i++) {
            AttendanceUpsertRequest.AttendanceUpsertItem item = upsertRequests.get(i);
            StudyParticipant participant = participantById.get(item.participantId());
            studyAttendanceRepository.upsertStatus(
                    participant.getAccountId(),
                    studyId,
                    participant.getStudyGroupId(),
                    item.meetingId(),
                    validRequestContext.statuses().get(i).name(),
                    now);
        }
        if (!withdrawals.isEmpty()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            for (StudyParticipant participant : withdrawals) {
                                log.info(
                                        "who={} participantId={} action=WITHDRAW at={}",
                                        accountId,
                                        participant.getId(),
                                        now);
                            }
                        }
                    });
        }
    }

    private List<StudyParticipant> validateWithdrawals(
            Study study, Long groupId, List<Long> ids, Long accountId) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Set<Long> distinctIds = new HashSet<>(ids);
        if (distinctIds.contains(null) || distinctIds.size() != ids.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        List<StudyParticipant> participants =
                studyParticipantRepository.findByIdInAndStudyIdForUpdate(
                        distinctIds, study.getId());
        if (participants.size() != distinctIds.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "participantId가 이 스터디에 속하지 않습니다.");
        }
        for (StudyParticipant participant : participants) {
            if (!groupId.equals(participant.getStudyGroupId())) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "참여 중단 대상이 요청한 분반에 속하지 않습니다.");
            }
            participant.assertWithdrawableBy(accountId, study.getCreatedBy());
        }
        study.assertParticipationWithdrawalAllowed();
        return participants;
    }

    private StudyGroup lockGroup(Long studyGroupId) {
        return studyGroupRepository
                .findByIdForUpdate(studyGroupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private ValidRequestContext validateRequests(
            List<AttendanceUpsertRequest.AttendanceUpsertItem> updates) {
        List<AttendanceStatus> statuses = new ArrayList<>(updates.size());
        Set<Long> meetingIds = new HashSet<>();
        Set<Long> participantIds = new HashSet<>();
        Set<Pair<Long, Long>> seenPairs = new HashSet<>();

        for (AttendanceUpsertRequest.AttendanceUpsertItem item : updates) {
            try {
                statuses.add(AttendanceStatus.from(item.status()));
            } catch (IllegalArgumentException e) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, e.getMessage());
            }
            if (!seenPairs.add(Pair.of(item.meetingId(), item.participantId()))) {
                throw new BusinessException(
                        ErrorCode.INVALID_INPUT, "(meetingId, participantId) 조합이 중복되었습니다.");
            }
            meetingIds.add(item.meetingId());
            participantIds.add(item.participantId());
        }

        return new ValidRequestContext(statuses, meetingIds, participantIds);
    }

    private List<StudyMeeting> validateMeetingsBelongToGroup(
            Set<Long> meetingIds, Long studyId, Long studyGroupId) {
        List<StudyMeeting> meetings =
                studyMeetingRepository.findByIdInAndStudyId(meetingIds, studyId);
        if (meetings.size() != meetingIds.size()) {
            throw meetingNotInStudy();
        }
        boolean mixedOrWrongGroup =
                meetings.stream().anyMatch(m -> !studyGroupId.equals(m.getStudyGroupId()));
        if (mixedOrWrongGroup) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "회차가 서로 다른 분반이거나 studyGroupId와 일치하지 않습니다.");
        }
        List<StudyMeeting> lockedMeetings =
                studyMeetingRepository.findByStudyGroupIdForUpdate(studyGroupId);
        Set<Long> lockedIds =
                lockedMeetings.stream().map(StudyMeeting::getId).collect(Collectors.toSet());
        if (!lockedIds.containsAll(meetingIds)) {
            throw meetingNotInStudy();
        }
        return lockedMeetings;
    }

    private static BusinessException meetingNotInStudy() {
        return new BusinessException(
                ErrorCode.INVALID_INPUT, "meetingId가 존재하지 않거나 이 스터디에 속하지 않습니다.");
    }

    private Map<Long, StudyParticipant> loadAndValidateParticipants(
            Set<Long> participantIds, Long studyId) {
        List<StudyParticipant> participants =
                studyParticipantRepository.findByIdInAndStudyId(participantIds, studyId);
        if (participants.size() != participantIds.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "participantId가 이 스터디에 속하지 않습니다.");
        }
        return participants.stream().collect(Collectors.toMap(StudyParticipant::getId, p -> p));
    }

    private record ValidRequestContext(
            List<AttendanceStatus> statuses, Set<Long> meetingIds, Set<Long> participantIds) {}
}
