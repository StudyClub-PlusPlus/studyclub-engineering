package com.studyclub.api.attendance;

import com.studyclub.api.participant.ParticipantWithdrawalService;
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
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttendanceUpsertService {

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final ParticipantWithdrawalService participantWithdrawalService;

    public AttendanceUpsertService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            ParticipantWithdrawalService participantWithdrawalService) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.participantWithdrawalService = participantWithdrawalService;
    }

    /**
     * 사용자 사이트 출석부 저장 — 출석 고치기와 참여 중단이 <b>한 트랜잭션</b>이다 (specs/study-participant/spec.md). 중단이 있으면 중단
     * 권한·대상을 먼저 다 본 뒤 출석을 쓰고 중단을 반영한다. 중단이 없으면 권한은 호출자(컨트롤러)가 출석 쓰기 가드로 본다.
     *
     * <p>{@code READ_COMMITTED} — 참여 중단은 대상의 분반을 알아낸 뒤 여러 분반을 잠근다. 기본 격리 수준이면 그 첫 조회의 스냅샷이 남아, 잠금을
     * 기다리는 동안 커밋된 스터디 종료 · 역할 변경을 뒤 판정이 못 본다 ({@link ParticipantWithdrawalService#prepare}).
     */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void saveFromSite(Long actorAccountId, Long studyId, AttendanceUpsertRequest request) {
        if (!request.hasWithdrawals()) {
            upsert(studyId, request.studyGroupId(), request);
            return;
        }
        ParticipantWithdrawalService.Prepared withdrawals =
                participantWithdrawalService.prepare(
                        actorAccountId, studyId, request.studyGroupId(), request.withdrawals());
        if (!request.updates().isEmpty()) {
            writeUpdates(studyId, request.studyGroupId(), request.updates());
        }
        participantWithdrawalService.apply(withdrawals);
    }

    /**
     * 권한은 호출자(컨트롤러)가 검사한다. 어드민 경로는 {@code @RequireAdmin}, 사용자 경로는 {@code
     * studyCaptainGuard.assertCaptainOrNavigatorOfGroup} 으로 각각 처리한다. 참여 중단({@code withdrawals})은 받지
     * 않는다 — 사용자 사이트는 {@link #saveFromSite} 를 쓴다.
     */
    @Transactional
    public void upsert(Long studyId, Long studyGroupId, AttendanceUpsertRequest request) {
        if (request.hasWithdrawals()) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "이 경로는 참여 중단(withdrawals)을 받지 않습니다.");
        }
        if (request.updates().isEmpty()) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "updates 와 withdrawals 가 모두 비었습니다.");
        }
        writeUpdates(studyId, studyGroupId, request.updates());
    }

    private void writeUpdates(
            Long studyId,
            Long studyGroupId,
            List<AttendanceUpsertRequest.AttendanceUpsertItem> upsertRequests) {
        validateStudyExists(studyId);
        validateGroupBelongsToStudy(studyId, studyGroupId);

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
            throw new BusinessException(ErrorCode.INVALID_INPUT, "studyGroupId가 이 스터디에 속하지 않습니다.");
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
