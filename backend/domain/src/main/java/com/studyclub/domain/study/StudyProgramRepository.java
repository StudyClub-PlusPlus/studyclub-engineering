package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

// TODO: comeback to this repository and usage after get confirmation on cohort register design
public interface StudyProgramRepository extends JpaRepository<StudyProgram, Long> {
    List<StudyProgram> findAllByIdIn(Collection<Long> ids);
}
