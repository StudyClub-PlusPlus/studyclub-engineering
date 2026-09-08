package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyCohortRepository extends JpaRepository<StudyCohort, Long> {
    List<StudyCohort> findByStudyIdInAndStatus(Collection<Long> studyIds, StudyCohortStatus status);

    Optional<StudyCohort> findFirstByStudyIdOrderByIdDesc(Long studyId);
}
