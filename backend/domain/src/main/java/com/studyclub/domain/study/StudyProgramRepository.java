package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyProgramRepository extends JpaRepository<StudyProgram, Long> {
    List<StudyProgram> findAllByIdIn(Collection<Long> ids);

    /** 등록 모달의 「기존 클럽의 새 기수」 드롭다운 — 종류로 거른 프로그램을 제목 순으로. */
    List<StudyProgram> findAllByStudyKindOrderByTitleAsc(StudyKind studyKind);
}
