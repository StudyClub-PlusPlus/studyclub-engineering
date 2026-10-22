package com.studyclub.api.studygroup;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.participant.StudyParticipantRoleChanged;
import com.studyclub.domain.study.StudyRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 백오피스 참여자 역할 지정 (specs/study-group/spec.md). */
@Service
public class AdminStudyParticipantService {

    private final StudyRepository studyRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final ApplicationEventPublisher eventPublisher;

    public AdminStudyParticipantService(
            StudyRepository studyRepository,
            StudyParticipantRepository studyParticipantRepository,
            ApplicationEventPublisher eventPublisher) {
        this.studyRepository = studyRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * 역할 일괄 변경 — all-or-nothing 트랜잭션. ACTIVE·PAUSED 상태만 허용한다.
     *
     * @throws BusinessException INVALID_INPUT — 중복 참여자 ID
     * @throws BusinessException PARTICIPANT_NOT_ACTIVE — 하차·탈퇴 행
     * @throws BusinessException NOT_FOUND — 없는 스터디·명부 행
     */
    @Transactional
    public BulkUpdateParticipantResponse bulkUpdateRoles(
            Long studyId, BulkUpdateParticipantRequest request, Long actorAccountId) {
        if (!studyRepository.existsById(studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
        }

        // 중복 participantId 거부
        Set<Long> seenIds = new HashSet<>();
        for (var c : request.changes()) {
            if (!seenIds.add(c.participantId())) {
                throw new BusinessException(ErrorCode.INVALID_INPUT, "중복된 참여자 ID가 있습니다.");
            }
        }

        // 참여자 일괄 조회 — 없거나 다른 스터디 소속이면 404
        List<Long> participantIds =
                request.changes().stream()
                        .map(BulkUpdateParticipantRequest.ParticipantChange::participantId)
                        .toList();
        List<StudyParticipant> participants =
                studyParticipantRepository.findByIdInAndStudyId(participantIds, studyId);
        if (participants.size() != participantIds.size()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "명부 행을 찾을 수 없습니다.");
        }
        Map<Long, StudyParticipant> byParticipantId =
                participants.stream().collect(Collectors.toMap(StudyParticipant::getId, p -> p));

        // all-or-nothing: 변경 전에 전체를 검증한다. 두 루프를 합치면 일부만 변경된 채 트랜잭션이 롤백된다.
        for (var c : request.changes()) {
            ParticipantStatus status = byParticipantId.get(c.participantId()).getStatus();
            if (status != ParticipantStatus.ACTIVE && status != ParticipantStatus.PAUSED) {
                throw new BusinessException(
                        ErrorCode.PARTICIPANT_NOT_ACTIVE, "활성 상태의 크루만 변경할 수 있습니다.");
            }
        }

        List<StudyParticipantRoleChanged> events = new ArrayList<>();
        for (var c : request.changes()) {
            StudyParticipant p = byParticipantId.get(c.participantId());
            ParticipantRole previous = p.getParticipantRole();
            p.changeRole(c.participantRole());
            if (!previous.equals(c.participantRole())) {
                events.add(StudyParticipantRoleChanged.of(actorAccountId, p, previous));
            }
        }
        events.forEach(eventPublisher::publishEvent);

        List<BulkUpdateParticipantResponse.ParticipantResult> results =
                request.changes().stream()
                        .map(
                                c -> {
                                    StudyParticipant p = byParticipantId.get(c.participantId());
                                    return new BulkUpdateParticipantResponse.ParticipantResult(
                                            p.getId(), p.getParticipantRole());
                                })
                        .toList();
        return new BulkUpdateParticipantResponse(results);
    }
}
