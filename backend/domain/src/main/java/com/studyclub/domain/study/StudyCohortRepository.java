package com.studyclub.domain.study;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyCohortRepository extends JpaRepository<StudyCohort, Long> {
    Optional<StudyCohort> findFirstByStudyIdOrderByIdDesc(Long studyId);
}
