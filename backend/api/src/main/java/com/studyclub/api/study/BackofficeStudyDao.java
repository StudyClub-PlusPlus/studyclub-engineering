package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import java.util.List;

interface BackofficeStudyDao {

    /** DB 에서 페이지를 자른다. 모집 상태 필터·RECRUITMENT 정렬은 서비스가 메모리에서 한다. */
    List<Study> getStudies(BackofficeStudyListFilter filter, int offset, int limit);

    long count(BackofficeStudyListFilter filter);

    /** 모집 상태·RECRUITMENT 정렬용 — 필터만 걸고 전체를 가져온다. */
    List<Study> getAllMatching(BackofficeStudyListFilter filter);
}
