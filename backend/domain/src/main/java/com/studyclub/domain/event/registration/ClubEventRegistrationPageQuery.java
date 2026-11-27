package com.studyclub.domain.event.registration;

import java.util.List;

/** 참가자 목록 한 페이지 — 메서드 이름 쿼리로는 offset 이 limit 의 배수가 아닌 페이지를 못 읽어 조각으로 둔다. */
public interface ClubEventRegistrationPageQuery {

    /** 그 행사의 신청을 최신 신청순({@code CREATED_AT DESC, ID DESC})으로 {@code offset} 부터 {@code limit} 건. */
    List<ClubEventRegistration> findPageByClubEventId(Long clubEventId, int offset, int limit);
}
