package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyProgramRepository extends JpaRepository<StudyProgram, Long> {
    List<StudyProgram> findAllByIdIn(Collection<Long> ids);

    List<StudyProgram> findAllByIsHiddenFalse();

    List<StudyProgram> findAllByIsHiddenFalseAndCategory(StudyCategory category);
}
