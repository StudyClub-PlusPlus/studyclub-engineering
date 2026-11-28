package com.studyclub.domain.retro;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyMeetingRetroLikeRepository
        extends JpaRepository<StudyMeetingRetroLike, Long> {

    Optional<StudyMeetingRetroLike> findByRetroIdAndSectionAndAccountId(
            Long retroId, RetroSection section, Long accountId);

    /** 한 회차의 여러 회고에 대해 계정이 누른 공감 목록 — 뷰어 컨텍스트 조회용. */
    List<StudyMeetingRetroLike> findByRetroIdInAndAccountId(List<Long> retroIds, Long accountId);

    /** 한 회차의 여러 회고에 달린 공감 전체 — 목록 화면의 집계용. */
    List<StudyMeetingRetroLike> findByRetroIdIn(List<Long> retroIds);

    int countByRetroIdAndSection(Long retroId, RetroSection section);

    void deleteByRetroIdAndSectionAndAccountId(Long retroId, RetroSection section, Long accountId);
}
