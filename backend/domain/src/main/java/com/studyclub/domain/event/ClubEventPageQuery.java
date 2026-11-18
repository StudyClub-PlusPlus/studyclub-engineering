package com.studyclub.domain.event;

import java.util.List;

/** 운영 목록의 페이지 쿼리 — 오프셋이 페이지 크기의 배수가 아니어도 되게 저장소 조각으로 둔다. */
public interface ClubEventPageQuery {

    /**
     * {@code ORDER BY STARTS_AT DESC, ID DESC} 로 {@code offset} 부터 {@code limit} 개의 행사 ID. 같은 시각이면
     * 나중에 만든 행사가 위다 (Q6).
     */
    List<Long> findPageIds(int offset, int limit);
}
