package com.studyclub.domain.bookmark;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface StudyBookmarkRepository extends JpaRepository<StudyBookmark, Long> {
    @Query(value = """
            SELECT s.TITLE AS title, s.CATEGORY AS category
            FROM STUDY_BOOKMARK sb
            JOIN STUDY_COHORT sc ON sb.STUDY_COHORT_ID = sc.ID
            JOIN STUDY s ON sc.STUDY_ID = s.ID
            WHERE sb.ACCOUNT_ID = :accountId
            ORDER BY sb.ID ASC
            LIMIT :limit OFFSET :offset
            """, nativeQuery = true)
    List<StudyBookmarkSummary> findBookmarkItems(@Param("accountId") Long accountId,
                                                   @Param("offset") int offset,
                                                   @Param("limit") int limit);

    long countByAccountId(Long accountId);

    @Transactional
    void deleteByAccountId(Long accountId);
}
