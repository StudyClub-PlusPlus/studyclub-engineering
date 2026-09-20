package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyMeetingRepository extends JpaRepository<StudyMeeting, Long> {

    List<StudyMeeting> findByStudyGroupIdOrderByScheduledAt(Long studyGroupId);

    List<StudyMeeting> findByStudyGroupIdInOrderByScheduledAt(Collection<Long> studyGroupIds);
}
