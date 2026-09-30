package com.studyclub.api.study;

import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;

/** 백오피스 스터디 목록 조건. null 이면 그 조건을 걸지 않는다. */
public record BackofficeStudyListFilter(StudyCategory category, StudyKind studyKind) {}
