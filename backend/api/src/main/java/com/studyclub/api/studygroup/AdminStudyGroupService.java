package com.studyclub.api.studygroup;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 백오피스의 반 — 캡틴이 스터디에 반을 만든다 (specs/study-group/spec.md). */
@Service
public class AdminStudyGroupService {

    private static final String DUPLICATE_NAME = "같은 이름의 반이 이미 있습니다.";

    private final StudyRepository studyRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final StudyMeetingRepository studyMeetingRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;
    private final StudyParticipantRepository studyParticipantRepository;

    public AdminStudyGroupService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            StudyParticipantRepository studyParticipantRepository) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.studyParticipantRepository = studyParticipantRepository;
    }

    /** 반 제목을 바꾼다. 같은 스터디 안에 같은 이름이 있으면 409. */
    @Transactional
    public StudyGroupUpdateResponse update(
            Long studyId, Long groupId, StudyGroupUpdateRequest request) {
        StudyGroup group =
                studyGroupRepository
                        .findById(groupId)
                        .filter(g -> g.getStudyId().equals(studyId))
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다."));
        // 엔티티를 바꾸기 전에 확인한다 — 먼저 바꾸면 조회 직전 자동 flush 가 제약 위반을 500 으로 낸다
        String name = StudyGroup.normalizeName(request.name());
        // 이름 변경 없이 그대로면 중복 확인을 건너뛴다
        if (!name.equalsIgnoreCase(group.getName())
                && studyGroupRepository.existsByStudyIdAndNameIgnoreCase(studyId, name)) {
            throw new BusinessException(ErrorCode.CONFLICT, DUPLICATE_NAME);
        }
        group.changeName(name);
        try {
            studyGroupRepository.flush();
        } catch (DataIntegrityViolationException e) {
            // 확인과 저장 사이에 다른 요청이 같은 이름을 먼저 넣은 경우의 마지막 방어선 (uk_study_group_study_name)
            throw new BusinessException(ErrorCode.CONFLICT, DUPLICATE_NAME);
        }
        return new StudyGroupUpdateResponse(group.getId(), group.getName());
    }

    /** 반을 지운다. 탈퇴(DELETED) 밖의 명부 행이 하나라도 있으면 409 — 수료 · 참여 중단 크루의 반 기록이 끊기지 않게. 회차 · 출석도 함께 지운다. */
    @Transactional
    public void delete(Long studyId, Long groupId) {
        studyGroupRepository
                .findById(groupId)
                .filter(g -> g.getStudyId().equals(studyId))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다."));
        if (studyParticipantRepository.existsByStudyGroupIdAndStatusIn(
                groupId,
                List.of(
                        ParticipantStatus.ACTIVE,
                        ParticipantStatus.PAUSED,
                        ParticipantStatus.COMPLETED,
                        ParticipantStatus.WITHDRAWN))) {
            throw new BusinessException(ErrorCode.GROUP_NOT_EMPTY, "소속 크루가 있어 반을 삭제할 수 없습니다.");
        }
        studyAttendanceRepository.deleteByStudyGroupId(groupId);
        studyMeetingRepository.deleteByStudyGroupIdIn(List.of(groupId));
        studyGroupRepository.deleteById(groupId);
    }

    /** 제목만으로 반을 만든다. 회차·출석은 만들지 않는다 — 회차는 회차 추가 API 로만 생긴다. */
    @Transactional
    public StudyGroupCreateResponse create(Long studyId, StudyGroupCreateRequest request) {
        if (!studyRepository.existsById(studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
        }
        StudyGroup group = StudyGroup.create(studyId, request.name());
        if (studyGroupRepository.existsByStudyIdAndNameIgnoreCase(studyId, group.getName())) {
            throw new BusinessException(ErrorCode.CONFLICT, DUPLICATE_NAME);
        }
        try {
            studyGroupRepository.saveAndFlush(group);
        } catch (DataIntegrityViolationException e) {
            // 확인과 저장 사이에 다른 요청이 같은 이름을 먼저 넣은 경우의 마지막 방어선 (uk_study_group_study_name)
            throw new BusinessException(ErrorCode.CONFLICT, DUPLICATE_NAME);
        }
        return new StudyGroupCreateResponse(group.getId(), group.getName());
    }
}
