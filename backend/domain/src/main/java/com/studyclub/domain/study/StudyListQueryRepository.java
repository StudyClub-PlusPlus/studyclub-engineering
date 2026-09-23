package com.studyclub.domain.study;

import java.util.List;

/** 목록 조회 — 필터·정렬·페이징을 DB 에서 한다. {@link StudyRepository} 가 이 조각을 함께 구현한다. */
public interface StudyListQueryRepository {

    List<Study> search(StudyListFilter filter, int offset, int limit);

    long count(StudyListFilter filter);
}
