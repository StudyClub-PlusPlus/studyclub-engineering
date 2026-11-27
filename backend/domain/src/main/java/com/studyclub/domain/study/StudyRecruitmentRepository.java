package com.studyclub.domain.study;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyRecruitmentRepository extends JpaRepository<StudyRecruitment, Long> {

    /** 스터디별 가장 최근(id 최대) 모집 회차 1건씩 반환. 목록 조회 전용. */
    @Query(
            "SELECT sr FROM StudyRecruitment sr WHERE sr.id IN ("
                    + "SELECT MAX(sr2.id) FROM StudyRecruitment sr2"
                    + " WHERE sr2.studyId IN :studyIds GROUP BY sr2.studyId)")
    List<StudyRecruitment> findLatestByStudyIdIn(@Param("studyIds") Collection<Long> studyIds);

    Optional<StudyRecruitment> findFirstByStudyIdOrderByIdDesc(Long studyId);

    /**
     * 수정 전용 — 최신 모집 회차를 처음 읽을 때부터 잠근다. 모집 시간대는 모드(이 행)와 지역(자식 행)으로 나뉘어 있어, 동시 수정 둘이 서로 다른 행만 건드리면 둘
     * 다 커밋돼 모드와 지역이 어긋난다. 같은 트랜잭션에서 잠그지 않고 먼저 읽어 두면 1차 캐시의 옛 엔티티를 그대로 쓰게 되므로 이 조회 하나만 쓴다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "SELECT recruitment FROM StudyRecruitment recruitment"
                    + " WHERE recruitment.studyId = :studyId ORDER BY recruitment.id DESC LIMIT 1")
    Optional<StudyRecruitment> findFirstByStudyIdOrderByIdDescForUpdate(
            @Param("studyId") Long studyId);

    @Query(
            "SELECT recruitment FROM StudyRecruitment recruitment "
                    + "WHERE recruitment.studyId = :studyId "
                    + "AND recruitment.startAt <= CURRENT_TIMESTAMP "
                    + "AND (recruitment.recruitDeadlineAt IS NULL OR recruitment.recruitDeadlineAt > CURRENT_TIMESTAMP) "
                    + "ORDER BY recruitment.startAt DESC, recruitment.id DESC")
    List<StudyRecruitment> findOpenByStudyIdOrderByStartAtDesc(@Param("studyId") Long studyId);

    /**
     * 신청 제출 전용 — 모집 회차 행을 잠그고 읽는다. 신청이 명부를 늘리므로 정원 검사와 명부 insert 사이에 다른 신청이 끼면 마지막 한 자리에 두 명이 들어간다.
     * 같은 회차 신청을 이 행으로 줄 세운다 (specs/study-application/spec.md 신청 제출 1).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT recruitment FROM StudyRecruitment recruitment WHERE recruitment.id = :id")
    Optional<StudyRecruitment> findByIdForUpdate(@Param("id") Long id);

    Optional<StudyRecruitment> findFirstByStudyIdOrderByStartAtDescIdDesc(Long studyId);

    boolean existsByStudyIdAndStartAtLessThanEqual(Long studyId, Instant now);

    List<StudyRecruitment> findByStudyId(Long studyId);

    void deleteByStudyId(Long studyId);
}
