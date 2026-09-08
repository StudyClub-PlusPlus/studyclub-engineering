package com.studyclub.domain.study;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyRepository extends JpaRepository<Study, Long> {
    Optional<Study> findByIdAndIsHiddenFalse(Long id);
}
