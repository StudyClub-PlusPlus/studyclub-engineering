package com.studyclub.api.attendance;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
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

    public List<ParticipantRate> upsert(
            Long studyId, Long callerAccountId, AttendanceUpsertRequest request) {
        studyRepository
                .findById(studyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        boolean isCaptain =
                studyParticipantRepository.existsByAccountIdAndStudyIdAndParticipantRoleIn(
                        callerAccountId,
                        studyId,
                        List.of(ParticipantRole.LEADER, ParticipantRole.CO_LEADER));
        if (!isCaptain) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }

        List<AttendanceUpsertRequest.AttendanceUpsertItem> updates = request.updates();

        // Parse and validate status values
        List<AttendanceStatus> parsedStatuses =
                updates.stream()
                        .map(
                                item -> {
                                    try {
                                        return AttendanceStatus.valueOf(
                                                item.status().toUpperCase());
                                    } catch (IllegalArgumentException e) {
                                        throw new BusinessException(
                                                ErrorCode.INVALID_INPUT,
                                                "유효하지 않은 status: " + item.status());
                                    }
                                })
                        .toList();

        // Check for duplicate (meetingId, participantId) pairs in request
        long distinctPairs =
                updates.stream()
                        .map(i -> i.meetingId() + ":" + i.participantId())
                        .distinct()
                        .count();
        if (distinctPairs != updates.size()) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "(meetingId, participantId) 조합이 중복되었습니다.");
        }

        List<Long> groupIds =
                studyGroupRepository.findByStudyId(studyId).stream()
                        .map(StudyGroup::getId)
                        .toList();

        List<StudyMeeting> allMeetings =
                groupIds.isEmpty()
                        ? List.of()
                        : studyMeetingRepository.findByStudyGroupIdInOrderByScheduledAt(groupIds);

        Set<Long> validMeetingIds =
                allMeetings.stream().map(StudyMeeting::getId).collect(Collectors.toSet());

        // Validate meetingIds belong to this study
        for (AttendanceUpsertRequest.AttendanceUpsertItem item : updates) {
            if (!validMeetingIds.contains(item.meetingId())) {
                throw new BusinessException(
                        ErrorCode.INVALID_INPUT,
                        "meetingId " + item.meetingId() + "는 이 스터디에 속하지 않습니다.");
            }
        }

        // Validate and load participants
        Set<Long> requestParticipantIds =
                updates.stream()
                        .map(AttendanceUpsertRequest.AttendanceUpsertItem::participantId)
                        .collect(Collectors.toSet());
        List<StudyParticipant> requestParticipants =
                studyParticipantRepository.findByIdInAndStudyId(requestParticipantIds, studyId);
        if (requestParticipants.size() != requestParticipantIds.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "participantId가 이 스터디에 속하지 않습니다.");
        }

        Map<Long, StudyParticipant> participantById =
                requestParticipants.stream()
                        .collect(Collectors.toMap(StudyParticipant::getId, p -> p));

        // Load existing attendance records for request meetings (batch)
        Set<Long> requestMeetingIds =
                updates.stream()
                        .map(AttendanceUpsertRequest.AttendanceUpsertItem::meetingId)
                        .collect(Collectors.toSet());
        Map<String, StudyAttendance> existingByKey =
                studyAttendanceRepository.findByStudyMeetingIdIn(requestMeetingIds).stream()
                        .collect(
                                Collectors.toMap(
                                        a -> a.getStudyMeetingId() + ":" + a.getAccountId(),
                                        a -> a));

        List<StudyAttendance> toSave = new ArrayList<>();
        Set<Long> affectedAccountIds = new java.util.HashSet<>();

        for (int i = 0; i < updates.size(); i++) {
            AttendanceUpsertRequest.AttendanceUpsertItem item = updates.get(i);
            AttendanceStatus status = parsedStatuses.get(i);
            StudyParticipant participant = participantById.get(item.participantId());
            Long itemAccountId = participant.getAccountId();

            affectedAccountIds.add(itemAccountId);

            String key = item.meetingId() + ":" + itemAccountId;
            StudyAttendance existing = existingByKey.get(key);

            if (existing != null) {
                existing.updateStatus(status);
                toSave.add(existing);
            } else {
                toSave.add(
                        StudyAttendance.builder()
                                .accountId(itemAccountId)
                                .studyId(studyId)
                                .studyGroupId(participant.getStudyGroupId())
                                .studyMeetingId(item.meetingId())
                                .status(status)
                                .build());
            }
        }

        studyAttendanceRepository.saveAll(toSave);

        // Re-query after flush to get complete picture for rate calculation
        List<StudyAttendance> affectedAttendances =
                studyAttendanceRepository.findByStudyIdAndAccountIdIn(studyId, affectedAccountIds);
        Map<Long, Map<Long, StudyAttendance>> byAccount =
                affectedAttendances.stream()
                        .collect(
                                Collectors.groupingBy(
                                        StudyAttendance::getAccountId,
                                        Collectors.toMap(
                                                StudyAttendance::getStudyMeetingId, a -> a)));

        Instant now = Instant.now();

        return requestParticipants.stream()
                .map(
                        p -> {
                            double[] rc =
                                    AttendanceRateCalculator.components(
                                            p,
                                            allMeetings,
                                            byAccount.getOrDefault(p.getAccountId(), Map.of()),
                                            now);
                            return new ParticipantRate(
                                    p.getId(), AttendanceRateCalculator.rate(rc));
                        })
                .toList();
    }
}
