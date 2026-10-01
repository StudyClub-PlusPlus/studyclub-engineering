package com.studyclub.domain.study;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyRepository extends JpaRepository<Study, Long> {
    List<Study> findByProgramIdInAndStatus(Collection<Long> programIds, StudyStatus status);

    Optional<Study> findFirstByProgramIdOrderByIdDesc(Long programId);

    /**
     * 스터디 삭제와 디스코드 연결 저장을 직렬화한다. 둘 다 이 행을 먼저 잠가야, 봇을 기다리던 연결 저장이 이미 지워진 스터디에 행을 만들지 않는다
     * (specs/discord-study-link/spec.md).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Study s where s.id = :id")
    Optional<Study> findByIdForUpdate(@Param("id") Long id);

    /** 프로그램별 가장 최근(id 가 큰) 스터디를 가져온다. */
    @Query(
            "SELECT s FROM Study s WHERE s.id = "
                    + "(SELECT MAX(s2.id) FROM Study s2 WHERE s2.programId = s.programId) "
                    + "AND s.programId IN :programIds")
    List<Study> findLatestByProgramIds(@Param("programIds") Collection<Long> programIds);

    Optional<Study> findFirstByProgramIdAndIsHiddenFalseOrderByIdDesc(Long programId);
}
