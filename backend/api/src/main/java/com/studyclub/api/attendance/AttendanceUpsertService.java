package com.studyclub.api.attendance;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
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
@Transactional
public class AttendanceUpsertService {

    private final StudyRepository studyRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;

    public AttendanceUpsertService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
    }

    public void upsert(Long studyId, Long callerAccountId, AttendanceUpsertRequest request) {
        validateStudyExists(studyId);
        validateCallerIsCaptain(callerAccountId, studyId);

        List<AttendanceUpsertRequest.AttendanceUpsertItem> upsertRequests = request.updates();
        ValidRequestContext validRequestContext = validateRequests(upsertRequests);

        validateMeetingsBelongToStudy(validRequestContext.meetingIds(), studyId);
        Map<Long, StudyParticipant> participantById =
                loadAndValidateParticipants(validRequestContext.participantIds(), studyId);
        Map<Pair<Long, Long>, StudyAttendance> existingAttendances =
                loadExistingAttendances(validRequestContext.meetingIds());

        studyAttendanceRepository.saveAll(
                buildToSave(
                        upsertRequests,
                        validRequestContext.statuses(),
                        participantById,
                        existingAttendances,
                        studyId));
    }

    private void validateStudyExists(Long studyId) {
        studyRepository
                .findById(studyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private void validateCallerIsCaptain(Long callerAccountId, Long studyId) {
        boolean isCaptain =
                studyParticipantRepository.existsByAccountIdAndStudyIdAndParticipantRoleIn(
                        callerAccountId,
                        studyId,
                        List.of(ParticipantRole.LEADER, ParticipantRole.CO_LEADER));
        if (!isCaptain) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
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

    private void validateMeetingsBelongToStudy(Set<Long> meetingIds, Long studyId) {
        int found = studyMeetingRepository.findByIdInAndStudyId(meetingIds, studyId).size();
        if (found != meetingIds.size()) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "meetingId가 존재하지 않거나 이 스터디에 속하지 않습니다.");
        }
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

    private Map<Pair<Long, Long>, StudyAttendance> loadExistingAttendances(Set<Long> meetingIds) {
        return studyAttendanceRepository.findByStudyMeetingIdIn(meetingIds).stream()
                .collect(
                        Collectors.toMap(
                                a -> Pair.of(a.getStudyMeetingId(), a.getAccountId()), a -> a));
    }

    private List<StudyAttendance> buildToSave(
            List<AttendanceUpsertRequest.AttendanceUpsertItem> updates,
            List<AttendanceStatus> statuses,
            Map<Long, StudyParticipant> participantById,
            Map<Pair<Long, Long>, StudyAttendance> existingAttendances,
            Long studyId) {
        List<StudyAttendance> toSave = new ArrayList<>();

        for (int i = 0; i < updates.size(); i++) {
            AttendanceUpsertRequest.AttendanceUpsertItem item = updates.get(i);
            AttendanceStatus status = statuses.get(i);
            StudyParticipant participant = participantById.get(item.participantId());
            Long accountId = participant.getAccountId();

            StudyAttendance existing =
                    existingAttendances.get(Pair.of(item.meetingId(), accountId));

            if (existing != null) {
                existing.updateStatus(status);
                toSave.add(existing);
            } else {
                toSave.add(
                        StudyAttendance.builder()
                                .accountId(accountId)
                                .studyId(studyId)
                                .studyGroupId(participant.getStudyGroupId())
                                .studyMeetingId(item.meetingId())
                                .status(status)
                                .build());
            }
        }

        return toSave;
    }

    private record ValidRequestContext(
            List<AttendanceStatus> statuses, Set<Long> meetingIds, Set<Long> participantIds) {}
}
