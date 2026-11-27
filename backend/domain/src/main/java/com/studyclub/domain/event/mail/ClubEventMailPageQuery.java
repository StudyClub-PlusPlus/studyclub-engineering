package com.studyclub.domain.event.mail;

import java.util.List;

/** 메일 이력 한 페이지 — offset 이 limit 의 배수가 아닌 페이지도 읽으려고 조각으로 둔다. */
public interface ClubEventMailPageQuery {

    /** 그 행사의 발송을 최신순({@code CREATED_AT DESC, ID DESC})으로 {@code offset} 부터 {@code limit} 건. */
    List<ClubEventMail> findPageByClubEventId(Long clubEventId, int offset, int limit);
}
