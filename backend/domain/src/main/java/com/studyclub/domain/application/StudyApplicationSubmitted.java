package com.studyclub.domain.application;

/**
 * 스터디 신청이 접수됐다 (STUDY_APPLICATION 저장). 신청 트랜잭션 안에서 발행되고, 구독자는 커밋 뒤에 받는다
 * (specs/domain-events/spec.md). 페이로드는 id 와 표시용 이름뿐 — 답변·연락처는 싣지 않는다.
 */
public record StudyApplicationSubmitted(
        Long applicationId,
        Long studyId,
        String studyTitle,
        Long accountId,
        String applicantNickname) {}
