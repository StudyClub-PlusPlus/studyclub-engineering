package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyRepository extends JpaRepository<Study, Long> {
    List<Study> findByProgramIdInAndStatus(Collection<Long> programIds, StudyStatus status);

    Optional<Study> findFirstByProgramIdOrderByIdDesc(Long programId);

    Optional<Study> findByIdAndIsHiddenFalse(Long id);

    /** 프로그램별 가장 최근(id 가 큰) 스터디를 가져온다. */
    @Query(
            "SELECT s FROM Study s WHERE s.id = "
                    + "(SELECT MAX(s2.id) FROM Study s2 WHERE s2.programId = s.programId) "
                    + "AND s.programId IN :programIds")
    List<Study> findLatestByProgramIds(@Param("programIds") Collection<Long> programIds);
}
