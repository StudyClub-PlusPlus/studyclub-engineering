package com.studyclub.domain.attendance;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyAttendanceRepository extends JpaRepository<StudyAttendance, Long> {

    /** 미팅 목록에 속하는 모든 출석 레코드. uk_study_attendance_meeting_account 인덱스 활용. */
    List<StudyAttendance> findByStudyMeetingIdIn(Collection<Long> studyMeetingIds);

    Optional<StudyAttendance> findByStudyMeetingIdAndAccountId(Long studyMeetingId, Long accountId);

    /** 스터디 내 특정 계정들의 전체 출석 이력. idx_study_attendance_study_account 인덱스 활용. */
    List<StudyAttendance> findByStudyIdAndAccountIdIn(Long studyId, Collection<Long> accountIds);

    void deleteByStudyId(Long studyId);
}
