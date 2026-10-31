package com.studyclub.domain.feedback;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FeedbackImageRepository extends JpaRepository<FeedbackImage, Long> {

    List<FeedbackImage> findAllByFeedbackIdOrderByDisplayOrderAsc(Long feedbackId);

    /**
     * 탈퇴 — 그 계정이 낸 문의의 첨부 이미지 행을 지운다. 파일(STORAGE_OBJECT)은 업로드 서비스가 같은 트랜잭션에서 {@code DELETING} 으로
     * 찜하고 커밋 뒤 지운다 (specs/user-leave/spec.md).
     */
    @Modifying(flushAutomatically = true)
    @Query(
            """
            DELETE FROM FeedbackImage i
            WHERE i.feedbackId IN (SELECT f.id FROM Feedback f WHERE f.accountId = :accountId)
            """)
    int deleteAllByFeedbackAccountId(@Param("accountId") Long accountId);
}
