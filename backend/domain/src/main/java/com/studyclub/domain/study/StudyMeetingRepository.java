package com.studyclub.domain.study;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyMeetingRepository extends JpaRepository<StudyMeeting, Long> {

    List<StudyMeeting> findByStudyGroupIdOrderByScheduledAt(Long studyGroupId);

    /**
     * 위와 같지만 행을 잠근다. 디스코드 출석 체크는 "회차를 고르고 없으면 시작시킨 뒤 출석을 쓴다" 가 한 덩어리라, 같은 커맨드가 겹쳐 들어오면 두 요청이 같은 회차를
     * 동시에 시작시키거나 같은 (회차, 계정) 행을 동시에 INSERT 한다 (specs/discord-attendance/spec.md). 반 단위로 직렬화해서 막는다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "SELECT m FROM StudyMeeting m WHERE m.studyGroupId = :studyGroupId ORDER BY m.scheduledAt")
    List<StudyMeeting> findByStudyGroupIdForUpdate(@Param("studyGroupId") Long studyGroupId);

    List<StudyMeeting> findByStudyGroupIdInOrderByScheduledAt(Collection<Long> studyGroupIds);

    @Query(
            "SELECT m FROM StudyMeeting m JOIN StudyGroup g ON m.studyGroupId = g.id WHERE m.id IN :ids AND g.studyId = :studyId")
    List<StudyMeeting> findByIdInAndStudyId(
            @Param("ids") Collection<Long> ids, @Param("studyId") Long studyId);
}
