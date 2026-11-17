package com.studyclub.domain.sitenotice;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteNoticeRepository extends JpaRepository<SiteNotice, Long> {

    /** 삭제된 공지는 없는 것과 같다 — 사이트·콘솔 모두 이걸로 찾는다. */
    Optional<SiteNotice> findByIdAndRemovedAtIsNull(Long id);

    long countByRemovedAtIsNull();

    /** 더 최신 공지(화면의 「다음 공지」) — 살아 있는 것 중 이 ID 보다 큰 가장 작은 ID. */
    Optional<SiteNotice> findFirstByRemovedAtIsNullAndIdGreaterThanOrderByIdAsc(Long id);

    /** 더 오래된 공지(화면의 「이전 공지」) — 살아 있는 것 중 이 ID 보다 작은 가장 큰 ID. */
    Optional<SiteNotice> findFirstByRemovedAtIsNullAndIdLessThanOrderByIdDesc(Long id);
}
