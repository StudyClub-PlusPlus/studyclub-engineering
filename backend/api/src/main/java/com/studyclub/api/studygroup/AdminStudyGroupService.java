package com.studyclub.api.studygroup;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.study.MeetingSchedule;
import com.studyclub.domain.study.MeetingType;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
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
    private final StudyGroupDeletability studyGroupDeletability;

    public AdminStudyGroupService(
            StudyRepository studyRepository,
            StudyGroupRepository studyGroupRepository,
            StudyMeetingRepository studyMeetingRepository,
            StudyAttendanceRepository studyAttendanceRepository,
            StudyGroupDeletability studyGroupDeletability) {
        this.studyRepository = studyRepository;
        this.studyGroupRepository = studyGroupRepository;
        this.studyMeetingRepository = studyMeetingRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
        this.studyGroupDeletability = studyGroupDeletability;
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

    /**
     * 반을 지운다. 기본 반(스터디의 첫 반)은 명부가 비어 있어도 409 — 신청자가 들어가는 반이다. 탈퇴(DELETED) 밖의 명부 행이 하나라도 있으면 409 —
     * 수료 · 참여 중단 크루의 반 기록이 끊기지 않게. 명부가 비어도 탈퇴 회원 밖의 출석 행이 남았으면 409 — 반을 옮긴 크루의 지난 출석은 옛 반에 남는다. 회차와
     * 탈퇴 회원의 출석 행만 함께 지운다.
     */
    @Transactional
    public void delete(Long studyId, Long groupId) {
        studyGroupRepository
                .findById(groupId)
                .filter(g -> g.getStudyId().equals(studyId))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다."));
        Long defaultGroupId =
                studyGroupRepository
                        .findFirstByStudyIdOrderByIdAsc(studyId)
                        .map(StudyGroup::getId)
                        .orElse(null);
        // 참여 명단 groups[].canDelete 와 같은 판정 — 버튼과 삭제가 어긋나지 않게
        studyGroupDeletability
                .blocker(groupId, defaultGroupId)
                .ifPresent(
                        blocker -> {
                            throw switch (blocker) {
                                case DEFAULT_GROUP ->
                                        new BusinessException(
                                                ErrorCode.DEFAULT_GROUP_NOT_DELETABLE,
                                                "기본 반은 삭제할 수 없습니다.");
                                case ROSTER ->
                                        new BusinessException(
                                                ErrorCode.GROUP_NOT_EMPTY,
                                                "소속 크루가 있어 반을 삭제할 수 없습니다.");
                                case ATTENDANCE ->
                                        new BusinessException(
                                                ErrorCode.GROUP_NOT_EMPTY,
                                                "출석 기록이 남아 있어 반을 삭제할 수 없습니다.");
                            };
                        });
        studyAttendanceRepository.deleteByStudyGroupId(groupId);
        studyMeetingRepository.deleteByStudyGroupIdIn(List.of(groupId));
        studyGroupRepository.deleteById(groupId);
    }

    /**
     * 반의 킥오프(0회차)를 정하거나 옮긴다 (specs/study-meeting/spec.md 결정 11). 없으면 만들고, 있으면 일자만 바꾼다. 지난 시각도 받는다 —
     * 이미 운영 중인 반의 킥오프를 나중에 적는다. 출석 행은 깔지 않는다 — 킥오프는 기록이 없으면 빈 칸이고, 디스코드 출석·출석부 저장이 행을 만든다.
     */
    @Transactional
    public void setKickoff(Long studyId, Long groupId, Instant scheduledAt) {
        // 회차 API 와 같은 순서로 잠근다 — 분반 먼저, 트랜잭션의 첫 조회로
        StudyGroup group =
                studyGroupRepository
                        .findByIdForUpdate(groupId)
                        .filter(g -> g.getStudyId().equals(studyId))
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "반을 찾을 수 없습니다."));
        // 옮길 때만 회차 행을 잠근다 — 디스코드가 같은 킥오프를 시작시키며 쓴 시작 시각을 옛 값으로 덮지 않게. 처음 만들 때는 잠그지 않는다: 회차 없는 두
        // 반이 같은 gap 을 잡고 서로의 INSERT 를 기다리다 교착한다 (회차 추가와 같은 이유)
        List<StudyMeeting> meetings =
                studyMeetingRepository.existsByStudyGroupIdAndMeetingType(
                                groupId, MeetingType.KICKOFF)
                        ? studyMeetingRepository.findByStudyGroupIdForUpdate(groupId)
                        : studyMeetingRepository.findByStudyGroupIdOrderByScheduledAt(groupId);
        StudyMeeting kickoff =
                meetings.stream().filter(StudyMeeting::isKickoff).findFirst().orElse(null);
        new MeetingSchedule(group.getTimezone(), meetings).checkKickoff(kickoff, scheduledAt);
        if (kickoff == null) {
            studyMeetingRepository.save(StudyMeeting.kickoff(groupId, scheduledAt));
        } else {
            kickoff.rescheduleKickoff(scheduledAt);
        }
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
