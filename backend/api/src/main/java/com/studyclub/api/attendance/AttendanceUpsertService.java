package com.studyclub.api.attendance;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttendanceUpsertService {

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;

    public AttendanceUpsertService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
    }

    /** 권한은 {@code @RequireCaptainOrNavigator(GROUP)} 가 검사한다. */
    @Transactional
    public void upsert(Long studyId, Long studyGroupId, AttendanceUpsertRequest request) {
        validateStudyExists(studyId);
        validateGroupBelongsToStudy(studyId, studyGroupId);

        List<AttendanceUpsertRequest.AttendanceUpsertItem> upsertRequests = request.updates();
        ValidRequestContext validRequestContext = validateRequests(upsertRequests);

        validateMeetingsBelongToGroup(validRequestContext.meetingIds(), studyId, studyGroupId);
        Map<Long, StudyParticipant> participantById =
                loadAndValidateParticipants(validRequestContext.participantIds(), studyId);

        Instant now = Instant.now();
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
    }

    private void validateStudyExists(Long studyId) {
        studyRepository
                .findById(studyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private void validateGroupBelongsToStudy(Long studyId, Long studyGroupId) {
        StudyGroup group =
                studyGroupRepository
                        .findById(studyGroupId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!studyId.equals(group.getStudyId())) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "studyGroupId가 이 스터디에 속하지 않습니다.");
        }
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

    private void validateMeetingsBelongToGroup(
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
        Set<Long> lockedIds =
                studyMeetingRepository.findByStudyGroupIdForUpdate(studyGroupId).stream()
                        .map(StudyMeeting::getId)
                        .collect(Collectors.toSet());
        if (!lockedIds.containsAll(meetingIds)) {
            throw meetingNotInStudy();
        }
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
