package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyMeetingRepository extends JpaRepository<StudyMeeting, Long> {

    List<StudyMeeting> findByStudyGroupIdOrderByScheduledAt(Long studyGroupId);

    List<StudyMeeting> findByStudyGroupIdInOrderByScheduledAt(Collection<Long> studyGroupIds);

    @Query(
            "SELECT m FROM StudyMeeting m JOIN StudyGroup g ON m.studyGroupId = g.id WHERE m.id IN :ids AND g.studyId = :studyId")
    List<StudyMeeting> findByIdInAndStudyId(
            @Param("ids") Collection<Long> ids, @Param("studyId") Long studyId);

    void deleteByStudyGroupIdIn(Collection<Long> studyGroupIds);
}
