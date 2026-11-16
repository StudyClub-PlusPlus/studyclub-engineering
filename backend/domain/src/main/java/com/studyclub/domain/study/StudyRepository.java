package com.studyclub.domain.study;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyRepository extends JpaRepository<Study, Long> {
    List<Study> findByProgramIdInAndStatus(Collection<Long> programIds, StudyStatus status);

    List<Study> findByStatus(StudyStatus status);

    List<Study> findByStatusIn(Collection<StudyStatus> statuses);

    Optional<Study> findFirstByProgramIdOrderByIdDesc(Long programId);

    /**
     * 스터디 삭제와 디스코드 연결 저장을 직렬화한다. 둘 다 이 행을 먼저 잠가야, 봇을 기다리던 연결 저장이 이미 지워진 스터디에 행을 만들지 않는다
     * (specs/discord-study-link/spec.md).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Study s where s.id = :id")
    Optional<Study> findByIdForUpdate(@Param("id") Long id);

    /** 계정 탈퇴 시 등록자 기록을 비운다 — 탈퇴한 계정을 가리키는 값을 남기지 않는다. */
    @Modifying
    @Query("UPDATE Study s SET s.createdBy = null WHERE s.createdBy = :accountId")
    void clearCreatedBy(@Param("accountId") Long accountId);

    /**
     * 계정 탈퇴 시 담당 캡틴을 비운다 — {@code OWNER_CAPTAIN_ID = null} 이면 ADMIN 누구나 담당 캡틴의 일을 한다
     * (StudyCaptainGuard.isOwnerCaptain).
     */
    @Modifying
    @Query("UPDATE Study s SET s.ownerCaptainId = null WHERE s.ownerCaptainId = :accountId")
    void clearOwnerCaptain(@Param("accountId") Long accountId);

    /** 캡틴 권한 해제 시 — 끝난 스터디의 담당 캡틴만 비운다. 진행 중인 스터디가 있으면 해제를 먼저 막는다 (specs/admin-users). */
    @Modifying
    @Query(
            "UPDATE Study s SET s.ownerCaptainId = null WHERE s.ownerCaptainId = :accountId"
                    + " AND s.status IN :statuses")
    void clearOwnerCaptainIn(
            @Param("accountId") Long accountId,
            @Param("statuses") Collection<StudyStatus> statuses);

    /** 이 계정이 담당 캡틴인 스터디 중 상태가 {@code statuses} 밖인 것 — 진행 중 담당 스터디(OWNS_STUDY). */
    List<Study> findByOwnerCaptainIdAndStatusNotIn(
            Long ownerCaptainId, Collection<StudyStatus> statuses);

    /** 진행 중 담당 스터디가 있는 계정 — 회원 목록 한 페이지분을 한 번에 본다. */
    @Query(
            "SELECT DISTINCT s.ownerCaptainId FROM Study s WHERE s.ownerCaptainId IN :accountIds"
                    + " AND s.status NOT IN :statuses")
    List<Long> findOwnerCaptainIdsWithStatusNotIn(
            @Param("accountIds") Collection<Long> accountIds,
            @Param("statuses") Collection<StudyStatus> statuses);

    /** 프로그램별 가장 최근(id 가 큰) 스터디를 가져온다. */
    @Query(
            "SELECT s FROM Study s WHERE s.id = "
                    + "(SELECT MAX(s2.id) FROM Study s2 WHERE s2.programId = s.programId) "
                    + "AND s.programId IN :programIds")
    List<Study> findLatestByProgramIds(@Param("programIds") Collection<Long> programIds);
}
