package com.studyclub.domain.feedback;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 목록 · 검색은 api 모듈의 조회 DAO 가 한다 — 오프셋이 페이지 경계에 맞지 않아도 되도록 (specs/feedback/spec.md). */
public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    /** 내 문의 상세 — 남의 것과 없는 번호를 가르지 않는다. */
    Optional<Feedback> findByIdAndAccountId(Long id, Long accountId);

    /** 운영 처리 — 두 캡틴이 동시에 첫 회신을 보내도 완료 처리자 · 회신 시각이 한 번만 정해지게 행을 잠근다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Feedback f where f.id = :id")
    Optional<Feedback> findByIdForUpdate(@Param("id") Long id);

    /** rate limit — 이 계정이 {@code after} 뒤에 보낸 건수. */
    long countByAccountIdAndCreatedAtAfter(Long accountId, Instant after);
}
