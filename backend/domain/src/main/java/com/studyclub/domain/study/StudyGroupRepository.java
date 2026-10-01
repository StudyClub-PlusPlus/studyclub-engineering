package com.studyclub.domain.study;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyGroupRepository extends JpaRepository<StudyGroup, Long> {

    List<StudyGroup> findByStudyId(Long studyId);

    Optional<StudyGroup> findFirstByStudyIdOrderByIdAsc(Long studyId);

    void deleteByStudyId(Long studyId);
}
