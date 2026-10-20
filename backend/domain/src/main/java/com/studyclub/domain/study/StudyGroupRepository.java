package com.studyclub.domain.study;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyGroupRepository extends JpaRepository<StudyGroup, Long> {

    List<StudyGroup> findByStudyId(Long studyId);

    /** 기본 반 — 그 스터디에서 처음 만든 반. 신청자가 여기로 들어간다. */
    Optional<StudyGroup> findFirstByStudyIdOrderByIdAsc(Long studyId);

    List<StudyGroup> findByStudyIdIn(Collection<Long> studyIds);

    /** 같은 스터디에 같은 이름의 반이 있는지. 운영 DB 정렬이 대소문자를 가리지 않아 여기서도 무시한다. */
    boolean existsByStudyIdAndNameIgnoreCase(Long studyId, String name);

    void deleteByStudyId(Long studyId);

    /**
     * 분반 행을 잠근다. 회차 추가·수정·삭제를 분반 단위로 줄 세운다 — 회차가 하나도 없는 분반은 회차 행 잠금으로는 잠글 행이 없어, 두 추가가 함께 INSERT 까지
     * 가다 교착할 수 있다 (specs/study-meeting/spec.md 「잠금」).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM StudyGroup g WHERE g.id = :id")
    Optional<StudyGroup> findByIdForUpdate(@Param("id") Long id);
}
