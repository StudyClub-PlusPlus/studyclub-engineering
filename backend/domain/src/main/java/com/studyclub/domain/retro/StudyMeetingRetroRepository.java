package com.studyclub.domain.retro;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyMeetingRetroRepository extends JpaRepository<StudyMeetingRetro, Long> {

    Optional<StudyMeetingRetro> findByMeetingIdAndParticipantId(Long meetingId, Long participantId);

    List<StudyMeetingRetro> findByMeetingIdOrderByCreatedAtAsc(Long meetingId);

    /** ID 만 필요한 뷰어 컨텍스트용 — 엔티티 전체를 SELECT 하지 않는다. */
    @Query(
            "SELECT r.id FROM StudyMeetingRetro r WHERE r.meetingId = :meetingId ORDER BY r.createdAt ASC")
    List<Long> findIdsByMeetingIdOrderByCreatedAtAsc(@Param("meetingId") Long meetingId);

    /** 여러 회차 중 participantId 가 회고를 작성한 meetingId 집합 — N+1 방지. */
    @Query(
            "SELECT r.meetingId FROM StudyMeetingRetro r"
                    + " WHERE r.meetingId IN :meetingIds AND r.participantId = :participantId")
    Set<Long> findMeetingIdsByMeetingIdInAndParticipantId(
            @Param("meetingIds") List<Long> meetingIds, @Param("participantId") Long participantId);
}
