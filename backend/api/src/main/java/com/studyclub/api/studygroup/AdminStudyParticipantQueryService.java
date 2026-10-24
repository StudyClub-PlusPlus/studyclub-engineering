package com.studyclub.api.studygroup;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 백오피스 참여 명단 조회 (specs/study-group/spec.md 「참여 명단」). */
@Service
public class AdminStudyParticipantQueryService {

    /** 기본 명단 — 참여 중인 행. 인원(participantCount)도 이 상태만 센다. */
    private static final List<ParticipantStatus> CURRENT_STATUSES =
            List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);

    /** includeLeft — 하차(WITHDRAWN)까지. 탈퇴(DELETED)는 늘 뺀다. */
    private static final List<ParticipantStatus> WITH_LEFT_STATUSES =
            List.of(
                    ParticipantStatus.ACTIVE,
                    ParticipantStatus.PAUSED,
                    ParticipantStatus.WITHDRAWN);

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyRecruitmentRepository studyRecruitmentRepository;
    private final AccountRepository accountRepository;
    private final StudyGroupDeletability studyGroupDeletability;

    public AdminStudyParticipantQueryService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyRecruitmentRepository studyRecruitmentRepository,
            AccountRepository accountRepository,
            StudyGroupDeletability studyGroupDeletability) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyRecruitmentRepository = studyRecruitmentRepository;
        this.accountRepository = accountRepository;
        this.studyGroupDeletability = studyGroupDeletability;
    }

    /**
     * 그 스터디의 명부. 정렬은 네비게이터 → 반 이름 → 닉네임.
     *
     * @throws BusinessException NOT_FOUND — 없는 스터디
     */
    @Transactional(readOnly = true)
    public StudyParticipantsResponse list(Long studyId, boolean includeLeft) {
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));

        // 만든 순서 — 첫 반이 기본 반이다 (findFirstByStudyIdOrderByIdAsc 와 같은 기준)
        List<StudyGroup> groups =
                studyGroupRepository.findByStudyId(studyId).stream()
                        .sorted(Comparator.comparing(StudyGroup::getId))
                        .toList();
        Long defaultGroupId = groups.isEmpty() ? null : groups.getFirst().getId();
        // 반 삭제와 같은 판정 — 반은 스터디마다 몇 개라 반마다 센다
        List<StudyParticipantsResponse.Group> groupResponses =
                groups.stream()
                        .map(
                                g ->
                                        new StudyParticipantsResponse.Group(
                                                g.getId(),
                                                g.getName(),
                                                g.getId().equals(defaultGroupId),
                                                studyGroupDeletability.canDelete(
                                                        g.getId(), defaultGroupId)))
                        .toList();

        List<StudyParticipant> rows =
                studyParticipantRepository.findByStudyIdAndStatusIn(
                        studyId, includeLeft ? WITH_LEFT_STATUSES : CURRENT_STATUSES);
        int participantCount =
                (int) rows.stream().filter(p -> CURRENT_STATUSES.contains(p.getStatus())).count();
        Map<Long, Account> accounts =
                accountRepository
                        .findAllById(rows.stream().map(StudyParticipant::getAccountId).toList())
                        .stream()
                        .collect(Collectors.toMap(Account::getId, Function.identity()));
        Map<Long, String> groupNames =
                groups.stream().collect(Collectors.toMap(StudyGroup::getId, StudyGroup::getName));

        List<StudyParticipantsResponse.Participant> participants =
                rows.stream()
                        .map(p -> toParticipant(p, accounts.get(p.getAccountId()), study))
                        .sorted(
                                Comparator.comparing(
                                                (StudyParticipantsResponse.Participant p) ->
                                                        p.participantRole()
                                                                != ParticipantRole.LEADER)
                                        .thenComparing(
                                                p -> groupNames.get(p.groupId()),
                                                Comparator.nullsLast(Comparator.naturalOrder()))
                                        .thenComparing(
                                                StudyParticipantsResponse.Participant::nickname,
                                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .toList();

        // 정원은 스터디 상세와 같은 「최신 모집 회차」(ID 최대)
        Integer recruitmentCapacity =
                studyRecruitmentRepository
                        .findFirstByStudyIdOrderByIdDesc(studyId)
                        .map(StudyRecruitment::getRecruitmentCapacity)
                        .orElse(null);

        return new StudyParticipantsResponse(
                studyId, participantCount, recruitmentCapacity, groupResponses, participants);
    }

    private static StudyParticipantsResponse.Participant toParticipant(
            StudyParticipant p, Account account, Study study) {
        return new StudyParticipantsResponse.Participant(
                p.getId(),
                p.getAccountId(),
                account != null ? account.getNickname() : null,
                account != null ? account.getDiscordNickname() : null,
                account != null ? account.getEmail() : null,
                account != null ? account.getRegionGroup() : null,
                p.getStudyGroupId(),
                p.getParticipantRole(),
                p.getStatus(),
                p.getAccountId().equals(study.getCreatedBy()),
                p.getJoinedAt());
    }
}
