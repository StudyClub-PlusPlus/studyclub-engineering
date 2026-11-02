package com.studyclub.api.study;

import com.studyclub.domain.study.RecruitStatus;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyStatus;

/** 백오피스 스터디 목록 조건. null 이면 그 조건을 걸지 않는다. */
public record BackofficeStudyListFilter(
        StudyCategory category,
        StudyKind studyKind,
        StudyStatus status,
        Long studyId,
        StudyVisibility visibility,
        RecruitStatus recruitStatus,
        BackofficeStudySort sort,
        String keyword,
        Boolean hasApplicationForm,
        AdminStudyRecruitFilter recruitFilter) {

    public BackofficeStudyListFilter(
            StudyCategory category,
            StudyKind studyKind,
            StudyStatus status,
            Long studyId,
            StudyVisibility visibility,
            RecruitStatus recruitStatus,
            BackofficeStudySort sort) {
        this(
                category,
                studyKind,
                status,
                studyId,
                visibility,
                recruitStatus,
                sort,
                null,
                null,
                null);
    }

    public BackofficeStudySort effectiveSort() {
        return sort == null ? BackofficeStudySort.ID_DESC : sort;
    }
}
