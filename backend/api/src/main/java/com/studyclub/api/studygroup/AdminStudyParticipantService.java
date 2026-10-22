package com.studyclub.api.studygroup;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.participant.StudyParticipantRoleChanged;
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
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 백오피스 참여자 역할·반 일괄 변경 (specs/study-group/spec.md). */
@Service
public class AdminStudyParticipantService {

    private final StudyRepository studyRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final ApplicationEventPublisher eventPublisher;

    public AdminStudyParticipantService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            ApplicationEventPublisher eventPublisher) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * 역할·반 일괄 변경 — all-or-nothing 트랜잭션. ACTIVE·PAUSED 상태만 허용한다.
     *
     * @throws BusinessException INVALID_INPUT — 중복 participantId · 변경 필드 없음 · 다른 스터디의 반
     * @throws BusinessException PARTICIPANT_NOT_ACTIVE — 하차·탈퇴 행
     * @throws BusinessException NOT_FOUND — 없는 스터디·명부 행·반
     */
    @Transactional
    public BulkUpdateParticipantResponse bulkUpdate(
            Long studyId, BulkUpdateParticipantRequest request, Long actorAccountId) {
        assertStudyExists(studyId);
        validateChanges(request.changes());

        Map<Long, StudyParticipant> byId = loadParticipants(request.changes(), studyId);
        validateTargetGroups(request.changes(), studyId);
        assertAllActive(request.changes(), byId);

        Instant now = Instant.now();
        List<StudyParticipantRoleChanged> events =
                applyRoleChanges(request.changes(), byId, actorAccountId);
        applyGroupChanges(request.changes(), byId, now);
        events.forEach(eventPublisher::publishEvent);

        return buildResponse(request.changes(), byId);
    }

    // ── 검증 ─────────────────────────────────────────────────────────────────

    private void assertStudyExists(Long studyId) {
        if (!studyRepository.existsById(studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
        }
    }

    /** 중복 participantId 거부, 변경 필드 최소 1개 확인. */
    private void validateChanges(List<BulkUpdateParticipantRequest.ParticipantChange> changes) {
        Set<Long> seen = new HashSet<>();
        for (var c : changes) {
            if (!seen.add(c.participantId())) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "중복된 참여자 ID가 있습니다.");
            }
            if (c.participantRole() == null && c.groupId() == null) {
                throw new BusinessException(
                        ErrorCode.INVALID_INPUT, "participantRole 또는 groupId 중 하나는 필요합니다.");
            }
        }
    }

    /** 대상 반 존재 + 같은 스터디 소속 확인. groupId 없는 change 는 건너뛴다. */
    private void validateTargetGroups(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes, Long studyId) {
        Set<Long> groupIds =
                changes.stream()
                        .map(BulkUpdateParticipantRequest.ParticipantChange::groupId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
        if (groupIds.isEmpty()) {
            return;
        }
        Map<Long, StudyGroup> groupById =
                studyGroupRepository.findAllById(groupIds).stream()
                        .collect(Collectors.toMap(StudyGroup::getId, g -> g));
        for (Long groupId : groupIds) {
            StudyGroup group = groupById.get(groupId);
            if (group == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다.");
            }
            if (!studyId.equals(group.getStudyId())) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "다른 스터디의 반으로 이동할 수 없습니다.");
            }
        }
    }

    /** all-or-nothing: 전체를 검증한 뒤에 변경한다. */
    private void assertAllActive(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId) {
        for (var c : changes) {
            ParticipantStatus status = byId.get(c.participantId()).getStatus();
            if (status != ParticipantStatus.ACTIVE && status != ParticipantStatus.PAUSED) {
                throw new BusinessException(
                        ErrorCode.PARTICIPANT_NOT_ACTIVE, "활성 상태의 크루만 변경할 수 있습니다.");
            }
        }
    }

    // ── 데이터 로드 ───────────────────────────────────────────────────────────

    /** 참여자 일괄 조회 — 없거나 다른 스터디 소속이면 404. */
    private Map<Long, StudyParticipant> loadParticipants(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes, Long studyId) {
        List<Long> ids =
                changes.stream()
                        .map(BulkUpdateParticipantRequest.ParticipantChange::participantId)
                        .toList();
        List<StudyParticipant> participants =
                studyParticipantRepository.findByIdInAndStudyId(ids, studyId);
        if (participants.size() != ids.size()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "명부 행을 찾을 수 없습니다.");
        }
        return participants.stream().collect(Collectors.toMap(StudyParticipant::getId, p -> p));
    }

    // ── 변경 적용 ─────────────────────────────────────────────────────────────

    /** 역할이 실제로 달라진 행만 바꾸고, 이벤트 목록을 반환한다. */
    private List<StudyParticipantRoleChanged> applyRoleChanges(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId,
            Long actorAccountId) {
        List<StudyParticipantRoleChanged> events = new ArrayList<>();
        for (var c : changes) {
            if (c.participantRole() == null) {
                continue;
            }
            StudyParticipant p = byId.get(c.participantId());
            if (c.participantRole().equals(p.getParticipantRole())) {
                continue; // 같은 역할이면 no-op
            }
            ParticipantRole previous = p.getParticipantRole();
            p.changeRole(c.participantRole());
            events.add(StudyParticipantRoleChanged.of(actorAccountId, p, previous));
        }
        return events;
    }

    /** 반이 실제로 달라진 행에 대해 발표자 정리 + ABSENT 생성 + 반 이동을 적용한다. */
    private void applyGroupChanges(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId,
            Instant now) {
        List<BulkUpdateParticipantRequest.ParticipantChange> groupChanges =
                changes.stream()
                        .filter(c -> c.groupId() != null)
                        .filter(
                                c ->
                                        !c.groupId()
                                                .equals(
                                                        byId.get(c.participantId())
                                                                .getStudyGroupId()))
                        .toList();
        if (groupChanges.isEmpty()) {
            return;
        }
        releasePresenterSlots(groupChanges, byId, now);
        for (var c : groupChanges) {
            StudyParticipant p = byId.get(c.participantId());
            createAbsentForNewGroup(p, c.groupId(), now);
            p.changeGroup(c.groupId());
        }
    }

    /** 반을 옮기는 크루들이 맡은 옛 반 예정 회차의 발표자 칸을 비운다. */
    private void releasePresenterSlots(
            List<BulkUpdateParticipantRequest.ParticipantChange> groupChanges,
            Map<Long, StudyParticipant> byId,
            Instant now) {
        Set<Long> movingIdSet =
                groupChanges.stream()
                        .map(c -> byId.get(c.participantId()).getId())
                        .collect(Collectors.toSet());
        for (StudyMeeting meeting : studyMeetingRepository.findByPresenterIn(movingIdSet)) {
            // 해당 meeting의 실제 발표자 칸만 해제 — 비발표자 ID에 releasePresenter를 호출하지 않는다.
            if (movingIdSet.contains(meeting.getPresenter1ParticipantId())) {
                meeting.releasePresenter(meeting.getPresenter1ParticipantId(), now);
            }
            if (movingIdSet.contains(meeting.getPresenter2ParticipantId())) {
                meeting.releasePresenter(meeting.getPresenter2ParticipantId(), now);
            }
        }
    }

    /** 새 반의 예정 회차마다 ABSENT 출석 행을 만든다. 이미 행이 있으면 건너뛴다 (재이동·수동 생성 시 중복 방지). */
    private void createAbsentForNewGroup(StudyParticipant p, Long newGroupId, Instant now) {
        studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(newGroupId).stream()
                .filter(m -> !m.isStarted(now))
                .filter(
                        m ->
                                studyAttendanceRepository
                                        .findByStudyMeetingIdAndAccountId(
                                                m.getId(), p.getAccountId())
                                        .isEmpty())
                .forEach(
                        m ->
                                studyAttendanceRepository.save(
                                        StudyAttendance.builder()
                                                .accountId(p.getAccountId())
                                                .studyId(p.getStudyId())
                                                .studyGroupId(newGroupId)
                                                .studyMeetingId(m.getId())
                                                .status(AttendanceStatus.ABSENT)
                                                .build()));
    }

    // ── 응답 조립 ─────────────────────────────────────────────────────────────

    private BulkUpdateParticipantResponse buildResponse(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId) {
        List<BulkUpdateParticipantResponse.ParticipantResult> results =
                changes.stream()
                        .map(
                                c -> {
                                    StudyParticipant p = byId.get(c.participantId());
                                    return new BulkUpdateParticipantResponse.ParticipantResult(
                                            p.getId(), p.getParticipantRole(), p.getStudyGroupId());
                                })
                        .toList();
        return new BulkUpdateParticipantResponse(results);
    }
}
