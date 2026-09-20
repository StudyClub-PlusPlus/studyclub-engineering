package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyRecruitmentRepository extends JpaRepository<StudyRecruitment, Long> {
    List<StudyRecruitment> findByStudyIdIn(Collection<Long> studyIds);

    Optional<StudyRecruitment> findFirstByStudyIdOrderByIdDesc(Long studyId);

    @Query(
            "SELECT recruitment FROM StudyRecruitment recruitment "
                    + "WHERE recruitment.studyId = :studyId "
                    + "AND recruitment.startAt <= CURRENT_TIMESTAMP "
                    + "AND recruitment.recruitDeadlineAt > CURRENT_TIMESTAMP "
                    + "ORDER BY recruitment.startAt DESC, recruitment.id DESC")
    List<StudyRecruitment> findOpenByStudyIdOrderByStartAtDesc(@Param("studyId") Long studyId);

    Optional<StudyRecruitment> findFirstByStudyIdOrderByStartAtDescIdDesc(Long studyId);
}
