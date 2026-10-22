package com.studyclub.api.participant;

import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.participant.StudyParticipantWithdrawn;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 출석부의 참여 중단 (specs/study-participant/spec.md). 출석 저장과 <b>한 트랜잭션</b>이라 {@link #prepare} 로 전부 검증한 뒤
 * 출석을 쓰고, 마지막에 {@link #apply} 로 반영한다 — 하나라도 거절되면 출석도 중단도 남지 않는다.
 */
@Service
public class ParticipantWithdrawalService {

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final AdminAuditLogRepository adminAuditLogRepository;
    private final StudyCaptainGuard studyCaptainGuard;
    private final ApplicationEventPublisher eventPublisher;

    public ParticipantWithdrawalService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyMeetingRepository studyMeetingRepository,
            AdminAuditLogRepository adminAuditLogRepository,
            StudyCaptainGuard studyCaptainGuard,
            ApplicationEventPublisher eventPublisher) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.adminAuditLogRepository = adminAuditLogRepository;
        this.studyCaptainGuard = studyCaptainGuard;
        this.eventPublisher = eventPublisher;
    }

    /**
     * 판정 순서는 스펙 그대로다 — 권한 없는 호출자가 403 · 404 차이로 다른 스터디의 명부 행을 알아내지 못하게, 호출자 판정(403)을 대상 판정(400)보다
     * 먼저 한다.
     *
     * <p>잠금은 회차 수정 · 발표 신청과 같은 「분반 잠금 → 권한 판정 → 회차 잠금」 순서다 (specs/study-meeting/spec.md 「잠금」, share
     * 10-18 D7). 그래야 동시에 들어온 발표 신청이 중단자를 다시 넣지 못한다. 담당 캡틴은 다른 분반의 행도 중단하므로, 요청한 분반과 대상이 속한 분반을
     * <b>ID 오름차순</b>으로 모두 잠근다 — 회원 탈퇴 · 디스코드 출석도 여러 분반을 같은 순서로 잠가 서로 교착하지 않는다.
     */
    @Transactional
    public Prepared prepare(
            Long actorAccountId, Long studyId, Long studyGroupId, List<Long> participantIds) {
        Set<Long> lockedGroupIds = lockGroups(studyId, studyGroupId, participantIds);
        StudyGroup group =
                studyGroupRepository
                        .findById(studyGroupId)
                        .filter(g -> lockedGroupIds.contains(g.getId()))
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "분반을 찾을 수 없습니다."));
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!studyId.equals(group.getStudyId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "studyGroupId가 이 스터디에 속하지 않습니다.");
        }
        boolean ownerCaptain =
                studyCaptainGuard.assertCanWithdrawInGroup(
                        actorAccountId, study.getCreatedBy(), studyGroupId, "참여를 중단시킬 권한이 없습니다.");

        if (new HashSet<>(participantIds).size() != participantIds.size()) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "withdrawals 에 같은 명부 행이 두 번 있습니다.");
        }
        Map<Long, StudyParticipant> byId =
                studyParticipantRepository
                        .findByIdInAndStudyIdForUpdate(participantIds, studyId)
                        .stream()
                        .collect(Collectors.toMap(StudyParticipant::getId, Function.identity()));
        if (byId.size() != participantIds.size()) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "withdrawals 의 명부 행이 이 스터디에 속하지 않습니다.");
        }
        List<StudyParticipant> targets = participantIds.stream().map(byId::get).toList();
        // 분반을 잠그기 전에 읽은 소속과 달라졌다 — 그 사이 반을 옮겼다. 잠그지 않은 분반은 건드리지 않는다
        if (targets.stream()
                .map(StudyParticipant::getStudyGroupId)
                .anyMatch(id -> id != null && !lockedGroupIds.contains(id))) {
            throw new BusinessException(ErrorCode.CONFLICT, "명부가 바뀌었습니다. 다시 불러와 주세요.");
        }
        if (!ownerCaptain
                && targets.stream().anyMatch(p -> !studyGroupId.equals(p.getStudyGroupId()))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "다른 분반의 참여자는 중단시킬 수 없습니다.");
        }

        if (study.isEnded()) {
            throw new BusinessException(ErrorCode.STUDY_ENDED);
        }
        for (StudyParticipant target : targets) {
            assertWithdrawable(target, actorAccountId, study.getCreatedBy());
        }
        // 회차도 분반과 같은 순서로 미리 잠근다 — 출석 쓰기 · 발표자 비우기가 뒤에서 다시 잠가도 기다리지 않는다
        for (Long groupId : lockedGroupIds) {
            studyMeetingRepository.findByStudyGroupIdForUpdate(groupId);
        }
        return new Prepared(actorAccountId, targets);
    }

    // 요청한 분반 + 대상이 속한 이 스터디의 분반. 대상 소속은 잠그기 전에 읽으므로, 잠근 뒤 prepare 가 다시 확인한다
    private Set<Long> lockGroups(Long studyId, Long studyGroupId, List<Long> participantIds) {
        Set<Long> groupIds = new TreeSet<>();
        groupIds.add(studyGroupId);
        groupIds.addAll(
                studyParticipantRepository.findStudyGroupIdsByIdInAndStudyId(
                        participantIds, studyId));
        Set<Long> locked = new TreeSet<>();
        for (Long groupId : groupIds) {
            studyGroupRepository.findByIdForUpdate(groupId).ifPresent(g -> locked.add(g.getId()));
        }
        return locked;
    }

    /** 이미 중단된 행은 건너뛴다 — {@code LEFT_AT} · 감사 로그 · 이벤트 모두 이번에 바뀐 행에만. */
    @Transactional
    public void apply(Prepared prepared) {
        Instant now = Instant.now();
        List<StudyParticipant> withdrawn =
                prepared.targets().stream()
                        .filter(target -> withdrawOne(prepared.actorAccountId(), target, now))
                        .toList();
        releasePresenterSlots(withdrawn, now);
        for (StudyParticipant participant : withdrawn) {
            eventPublisher.publishEvent(
                    StudyParticipantWithdrawn.of(prepared.actorAccountId(), participant));
        }
    }

    private boolean withdrawOne(Long actorAccountId, StudyParticipant target, Instant now) {
        ParticipantStatus before = target.getStatus();
        if (!target.withdraw(now)) {
            return false;
        }
        studyParticipantRepository.save(target);
        adminAuditLogRepository.save(
                AdminAuditLog.withdraw(
                        actorAccountId, target.getAccountId(), target.getId(), before));
        return true;
    }

    // 중단 시각 뒤에 시작하는 회차의 발표자 칸을 비운다 — 이미 시작한 회차의 발표 기록은 남는다 (share 10-18 D7).
    // 회차는 잠그고 읽는다. 디스코드 출석이 같은 잠금으로 회차를 시작하므로, 잠근 뒤에 「시작한 회차」 를 판정해야 한다
    private void releasePresenterSlots(List<StudyParticipant> withdrawn, Instant now) {
        List<Long> ids = withdrawn.stream().map(StudyParticipant::getId).toList();
        List<Long> groupIds =
                withdrawn.stream()
                        .map(StudyParticipant::getStudyGroupId)
                        .filter(Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
        for (Long groupId : groupIds) {
            for (StudyMeeting meeting :
                    studyMeetingRepository.findByStudyGroupIdForUpdate(groupId)) {
                for (Long id : ids) {
                    meeting.releasePresenter(id, now);
                }
            }
        }
    }

    private static void assertWithdrawable(
            StudyParticipant target, Long actorAccountId, Long studyCreatedBy) {
        if (target.getAccountId().equals(actorAccountId)) {
            throw new BusinessException(ErrorCode.CANNOT_WITHDRAW_SELF);
        }
        // 운영진의 역할 · 참여는 백오피스에서 캡틴이 바꾼다
        if (target.getParticipantRole() == ParticipantRole.LEADER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "네비게이터는 출석부에서 중단시킬 수 없습니다.");
        }
        if (studyCreatedBy != null && studyCreatedBy.equals(target.getAccountId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "담당 캡틴은 출석부에서 중단시킬 수 없습니다.");
        }
        if (target.getStatus() == ParticipantStatus.DELETED
                || target.getStatus() == ParticipantStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.PARTICIPANT_NOT_ACTIVE);
        }
    }

    /** 검증을 마친 중단 대상 — {@link #apply} 에 그대로 넘긴다. */
    public record Prepared(Long actorAccountId, List<StudyParticipant> targets) {}
}
