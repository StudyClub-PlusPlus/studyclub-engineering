package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyRecruitmentRepository extends JpaRepository<StudyRecruitment, Long> {
    List<StudyRecruitment> findByStudyIdIn(Collection<Long> studyIds);

    Optional<StudyRecruitment> findFirstByStudyIdOrderByIdDesc(Long studyId);
}
