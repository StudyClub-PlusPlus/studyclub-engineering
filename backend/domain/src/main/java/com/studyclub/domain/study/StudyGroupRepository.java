package com.studyclub.domain.study;

import jakarta.persistence.LockModeType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyGroupRepository extends JpaRepository<StudyGroup, Long> {

    List<StudyGroup> findByStudyId(Long studyId);

    void deleteByStudyId(Long studyId);

    /**
     * 분반 행을 잠근다. 회차 추가·수정·삭제를 분반 단위로 줄 세운다 — 회차가 하나도 없는 분반은 회차 행 잠금으로는 잠글 행이 없어, 두 추가가 함께 INSERT 까지
     * 가다 교착할 수 있다 (specs/study-meeting/spec.md 「잠금」).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM StudyGroup g WHERE g.id = :id")
    Optional<StudyGroup> findByIdForUpdate(@Param("id") Long id);
}
