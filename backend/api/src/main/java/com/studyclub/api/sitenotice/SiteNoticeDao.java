package com.studyclub.api.sitenotice;

import com.studyclub.domain.sitenotice.SiteNotice;
import java.util.List;

/** offset 이 limit 의 배수가 아닐 수 있어 Spring Data 의 Pageable 로는 안 된다 — JPQL 로 자른다. */
interface SiteNoticeDao {

    /** 사이트 목록 — 살아 있는 공지를 {@code ID DESC} 로. */
    List<SiteNotice> findAlive(int offset, int limit);
}
