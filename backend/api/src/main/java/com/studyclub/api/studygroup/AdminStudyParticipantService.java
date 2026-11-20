package com.studyclub.api.studygroup;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.AttendanceStatus;
import com.studyclub.domain.attendance.StudyAttendance;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.audit.AdminAuditLog;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 백오피스 참여자 역할·반 일괄 변경 (specs/study-group/spec.md 「반 · 역할 한 번에 바꾸기」). */
@Service
public class AdminStudyParticipantService {

    private final StudyRepository studyRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final AdminAuditRecorder auditRecorder;
    private final ApplicationEventPublisher eventPublisher;

    public AdminStudyParticipantService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            AdminAuditRecorder auditRecorder,
            ApplicationEventPublisher eventPublisher) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.auditRecorder = auditRecorder;
        this.eventPublisher = eventPublisher;
    }

    /**
     * 역할·반 일괄 변경 — all-or-nothing 트랜잭션. 전부 검증한 뒤에 쓴다.
     *
     * <p>잠금은 참여 중단과 같은 「분반 → 명부 행 → 회차」 순서다 (share 10-18 D7). 트랜잭션의 첫 조회로 이 스터디의 분반을 ID 오름차순으로 모두
     * 잠그고, 대상 명부 행을 잠근 채 최신 상태로 읽어 검증한다 — 그 사이 참여 중단이 커밋돼도 이미 읽은 ACTIVE 로 옮기지 않는다. 회차는 옛 반 · 새 반만
     * 분반 ID 오름차순으로 잠근다 — 디스코드 출석과 같은 순서. 「예정 회차」 는 잠근 뒤 시각으로 판정한다.
     *
     * @throws BusinessException INVALID_INPUT — 중복 participantId · 변경 필드 없음 · 다른 스터디의 반 · 반 없는 행을
     *     LEADER 로
     * @throws BusinessException PARTICIPANT_NOT_ACTIVE — 하차 · 탈퇴 · 완주 행
     * @throws BusinessException NOT_FOUND — 없는 스터디 · 명부 행 · 반
     */
    @Transactional
    public BulkUpdateParticipantResponse bulkUpdate(
            Long studyId, BulkUpdateParticipantRequest request, Long actorAccountId) {
        List<BulkUpdateParticipantRequest.ParticipantChange> changes = request.changes();
        Map<Long, StudyGroup> lockedGroups =
                studyGroupRepository.findByStudyIdForUpdate(studyId).stream()
                        .collect(Collectors.toMap(StudyGroup::getId, Function.identity()));
        assertStudyExists(studyId);
        validateChanges(changes);
        validateTargetGroups(changes, lockedGroups);

        Map<Long, StudyParticipant> byId = lockParticipants(changes, studyId);
        assertAllActive(changes, byId);
        assertLeadersHaveGroup(changes, byId);

        List<GroupMove> moves = groupMoves(changes, byId);
        Map<Long, List<StudyMeeting>> meetingsByGroup = lockMeetings(moves);
        Instant now = Instant.now();

        // 한 줄 안에서는 반을 먼저 바꾸고 역할을 본다 (스펙 서버 동작 3)
        applyGroupMoves(moves, meetingsByGroup, now);
        List<StudyParticipantRoleChanged> events = applyRoleChanges(changes, byId, actorAccountId);
        events.forEach(eventPublisher::publishEvent);

        return buildResponse(changes, byId);
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
                throw new BusinessException(
                        ErrorCode.INVALID_INPUT,
                        "participantId " + c.participantId() + ": 같은 참여자가 두 번 있습니다.");
            }
            if (c.participantRole() == null && c.groupId() == null) {
                throw new BusinessException(
                        ErrorCode.INVALID_INPUT,
                        "participantId "
                                + c.participantId()
                                + ": participantRole 또는 groupId 중 하나는 필요합니다.");
            }
        }
    }

    /** 대상 반이 이 스터디의 반인지 — 잠근 분반에 없으면 다른 스터디의 반(400)이거나 없는 반(404). */
    private void validateTargetGroups(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyGroup> lockedGroups) {
        for (var c : changes) {
            Long groupId = c.groupId();
            if (groupId == null || lockedGroups.containsKey(groupId)) {
                continue;
            }
            if (studyGroupRepository.existsById(groupId)) {
                throw new BusinessException(
                        ErrorCode.INVALID_INPUT,
                        "participantId " + c.participantId() + ": 다른 스터디의 반으로 이동할 수 없습니다.");
            }
            throw new BusinessException(
                    ErrorCode.NOT_FOUND, "participantId " + c.participantId() + ": 반을 찾을 수 없습니다.");
        }
    }

    /** 대상 명부 행을 잠그고 최신 값으로 읽는다 — 없거나 다른 스터디 소속이면 404. */
    private Map<Long, StudyParticipant> lockParticipants(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes, Long studyId) {
        List<Long> ids =
                changes.stream()
                        .map(BulkUpdateParticipantRequest.ParticipantChange::participantId)
                        .toList();
        Map<Long, StudyParticipant> byId =
                studyParticipantRepository.findByIdInAndStudyIdForUpdate(ids, studyId).stream()
                        .collect(Collectors.toMap(StudyParticipant::getId, Function.identity()));
        List<Long> missing = ids.stream().filter(id -> !byId.containsKey(id)).toList();
        if (!missing.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.NOT_FOUND, "participantId " + missing + ": 명부 행을 찾을 수 없습니다.");
        }
        return byId;
    }

    private void assertAllActive(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId) {
        for (var c : changes) {
            ParticipantStatus status = byId.get(c.participantId()).getStatus();
            if (status != ParticipantStatus.ACTIVE && status != ParticipantStatus.PAUSED) {
                throw new BusinessException(
                        ErrorCode.PARTICIPANT_NOT_ACTIVE,
                        "participantId " + c.participantId() + ": 활성 상태의 크루만 변경할 수 있습니다.");
            }
        }
    }

    /** 네비게이터는 그 반을 맡는 사람이다 — 바뀐 뒤 반이 없는 행을 LEADER 로 만들지 않는다 (스펙 서버 동작 4). */
    private void assertLeadersHaveGroup(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId) {
        for (var c : changes) {
            if (c.participantRole() != ParticipantRole.LEADER) {
                continue;
            }
            Long groupAfter =
                    c.groupId() != null
                            ? c.groupId()
                            : byId.get(c.participantId()).getStudyGroupId();
            if (groupAfter == null) {
                throw new BusinessException(
                        ErrorCode.INVALID_INPUT,
                        "participantId " + c.participantId() + ": 반이 없는 크루는 네비게이터가 될 수 없습니다.");
            }
        }
    }

    // ── 잠금 ─────────────────────────────────────────────────────────────────

    /** 반이 실제로 달라지는 줄만. 같은 반이면 건너뛴다 (스펙 서버 동작 6). */
    private List<GroupMove> groupMoves(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId) {
        List<GroupMove> moves = new ArrayList<>();
        for (var c : changes) {
            StudyParticipant p = byId.get(c.participantId());
            if (c.groupId() != null && !c.groupId().equals(p.getStudyGroupId())) {
                moves.add(new GroupMove(p, p.getStudyGroupId(), c.groupId()));
            }
        }
        return moves;
    }

    /** 옛 반 · 새 반의 회차를 분반 ID 오름차순으로 잠근다. 반 이동이 없으면 잠그지 않는다. */
    private Map<Long, List<StudyMeeting>> lockMeetings(List<GroupMove> moves) {
        Set<Long> groupIds = new TreeSet<>();
        for (GroupMove move : moves) {
            groupIds.add(move.fromGroupId());
            groupIds.add(move.toGroupId());
        }
        Map<Long, List<StudyMeeting>> meetingsByGroup = new TreeMap<>();
        for (Long groupId : groupIds) {
            meetingsByGroup.put(
                    groupId, studyMeetingRepository.findByStudyGroupIdForUpdate(groupId));
        }
        return meetingsByGroup;
    }

    // ── 변경 적용 ─────────────────────────────────────────────────────────────

    /**
     * 반 이동 (스펙 서버 동작 5). 옛 반 예정 회차의 출석 행을 상태와 상관없이 지우고 발표자 칸을 비운 뒤, 명부 행의 반을 바꾸고 새 반 예정 회차마다 ABSENT
     * 를 만든다. 지난 회차 출석은 옛 반에 그대로 둔다. 쿼리는 반 단위로 묶는다 — 사람 · 회차마다 부르지 않는다.
     */
    private void applyGroupMoves(
            List<GroupMove> moves, Map<Long, List<StudyMeeting>> meetingsByGroup, Instant now) {
        if (moves.isEmpty()) {
            return;
        }
        Map<Long, List<GroupMove>> byFromGroup = groupBy(moves, GroupMove::fromGroupId);
        byFromGroup.forEach(
                (groupId, leaving) -> {
                    List<StudyMeeting> upcoming = upcoming(meetingsByGroup.get(groupId), now);
                    if (upcoming.isEmpty()) {
                        return;
                    }
                    studyAttendanceRepository.deleteByStudyMeetingIdInAndAccountIdIn(
                            upcoming.stream().map(StudyMeeting::getId).toList(),
                            leaving.stream().map(m -> m.participant().getAccountId()).toList());
                    List<Long> leavingIds =
                            leaving.stream().map(m -> m.participant().getId()).toList();
                    upcoming.forEach(meeting -> meeting.releasePresenters(leavingIds, now));
                });

        moves.forEach(move -> move.participant().changeGroup(move.toGroupId()));

        groupBy(moves, GroupMove::toGroupId)
                .forEach(
                        (groupId, arriving) ->
                                createAbsent(
                                        upcoming(meetingsByGroup.get(groupId), now), arriving));
    }

    /** 새 반 예정 회차마다 ABSENT. 이미 행이 있으면(그 반에 있다가 나갔다 돌아온 경우) 건드리지 않는다 — UNIQUE(회차, 계정). */
    private void createAbsent(List<StudyMeeting> upcoming, List<GroupMove> arriving) {
        if (upcoming.isEmpty()) {
            return;
        }
        List<Long> meetingIds = upcoming.stream().map(StudyMeeting::getId).toList();
        List<Long> accountIds = arriving.stream().map(m -> m.participant().getAccountId()).toList();
        Set<String> existing =
                studyAttendanceRepository
                        .findByStudyMeetingIdInAndAccountIdIn(meetingIds, accountIds)
                        .stream()
                        .map(a -> a.getStudyMeetingId() + ":" + a.getAccountId())
                        .collect(Collectors.toSet());
        List<StudyAttendance> rows = new ArrayList<>();
        for (StudyMeeting meeting : upcoming) {
            for (GroupMove move : arriving) {
                StudyParticipant p = move.participant();
                if (existing.contains(meeting.getId() + ":" + p.getAccountId())) {
                    continue;
                }
                rows.add(
                        StudyAttendance.builder()
                                .accountId(p.getAccountId())
                                .studyId(p.getStudyId())
                                .studyGroupId(move.toGroupId())
                                .studyMeetingId(meeting.getId())
                                .status(AttendanceStatus.ABSENT)
                                .build());
            }
        }
        studyAttendanceRepository.saveAll(rows);
    }

    /** 역할이 실제로 달라진 행만 바꾸고 감사 로그를 남긴다. 발행할 이벤트를 돌려준다. */
    private List<StudyParticipantRoleChanged> applyRoleChanges(
            List<BulkUpdateParticipantRequest.ParticipantChange> changes,
            Map<Long, StudyParticipant> byId,
            Long actorAccountId) {
        List<StudyParticipantRoleChanged> events = new ArrayList<>();
        for (var c : changes) {
            StudyParticipant p = byId.get(c.participantId());
            if (c.participantRole() == null || c.participantRole() == p.getParticipantRole()) {
                continue; // 같은 역할이면 no-op
            }
            ParticipantRole previous = p.getParticipantRole();
            p.changeRole(c.participantRole());
            auditRecorder.record(
                    AdminAuditLog.participantRoleChange(
                            actorAccountId, p.getAccountId(), p.getId(), previous));
            events.add(StudyParticipantRoleChanged.of(actorAccountId, p, previous));
        }
        return events;
    }

    private static List<StudyMeeting> upcoming(List<StudyMeeting> meetings, Instant now) {
        return meetings.stream().filter(m -> !m.isStarted(now)).toList();
    }

    private static Map<Long, List<GroupMove>> groupBy(
            List<GroupMove> moves, Function<GroupMove, Long> key) {
        return moves.stream()
                .collect(Collectors.groupingBy(key, LinkedHashMap::new, Collectors.toList()));
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

    /** 반이 실제로 달라지는 한 사람 — 옛 반은 바꾸기 전에 적어 둔다. */
    private record GroupMove(StudyParticipant participant, Long fromGroupId, Long toGroupId) {}
}
