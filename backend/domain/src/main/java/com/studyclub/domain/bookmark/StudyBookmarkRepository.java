package com.studyclub.domain.bookmark;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyBookmarkRepository extends JpaRepository<StudyBookmark, Long> {
    Page<StudyBookmark> findByAccountId(Long accountId, Pageable pageable);
}