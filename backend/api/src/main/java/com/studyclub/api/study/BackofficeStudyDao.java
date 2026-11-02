package com.studyclub.api.study;

import com.studyclub.domain.study.Study;
import java.time.Instant;
import java.util.List;

interface BackofficeStudyDao {

    /** 검색·모집·신청 폼을 포함한 모든 조건과 정렬을 DB에서 적용한 페이지. */
    List<Study> getStudies(BackofficeStudyListFilter filter, Instant asOf, int offset, int limit);

    long count(BackofficeStudyListFilter filter, Instant asOf);
}
