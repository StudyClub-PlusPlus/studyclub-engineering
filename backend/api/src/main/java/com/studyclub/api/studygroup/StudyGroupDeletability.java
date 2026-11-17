package com.studyclub.api.studygroup;

import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 반을 지울 수 있는지 — 「반 삭제」와 참여 명단 {@code groups[].canDelete} 가 이 판정 하나를 쓴다 (specs/study-group/spec.md
 * 「반 삭제」). 둘이 따로 세면 버튼은 켜졌는데 삭제가 409 로 막히는 일이 생긴다.
 */
@Component
class StudyGroupDeletability {

    /** 반 삭제를 막는 명부 상태 — 탈퇴(DELETED) 밖 전부. 수료 · 참여 중단 크루의 반 기록이 끊기지 않게. */
    static final List<ParticipantStatus> BLOCKING_STATUSES =
            List.of(
                    ParticipantStatus.ACTIVE,
                    ParticipantStatus.PAUSED,
                    ParticipantStatus.COMPLETED,
                    ParticipantStatus.WITHDRAWN);

    /** 지우지 못하는 이유. 검사 순서대로 — 앞의 것이 걸리면 뒤는 세지 않는다. */
    enum Blocker {
        /** 기본 반(그 스터디에서 처음 만든 반) — 신청자가 들어가는 반이다. */
        DEFAULT_GROUP,
        /** 탈퇴 밖의 명부 행이 있다. */
        ROSTER,
        /** 탈퇴 회원 밖의 출석 행이 있다 — 반을 옮긴 크루의 지난 출석은 옛 반에 남는다. */
        ATTENDANCE
    }

    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyAttendanceRepository studyAttendanceRepository;

    StudyGroupDeletability(
            StudyParticipantRepository studyParticipantRepository,
            StudyAttendanceRepository studyAttendanceRepository) {
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyAttendanceRepository = studyAttendanceRepository;
    }

    /** 지우지 못하는 이유. 지울 수 있으면 empty. {@code defaultGroupId} 는 그 스터디의 첫 반(ID 최소). */
    Optional<Blocker> blocker(Long groupId, Long defaultGroupId) {
        if (groupId.equals(defaultGroupId)) {
            return Optional.of(Blocker.DEFAULT_GROUP);
        }
        if (studyParticipantRepository.existsByStudyGroupIdAndStatusIn(
                groupId, BLOCKING_STATUSES)) {
            return Optional.of(Blocker.ROSTER);
        }
        if (studyAttendanceRepository.existsKeptByStudyGroupId(groupId)) {
            return Optional.of(Blocker.ATTENDANCE);
        }
        return Optional.empty();
    }

    boolean canDelete(Long groupId, Long defaultGroupId) {
        return blocker(groupId, defaultGroupId).isEmpty();
    }
}
