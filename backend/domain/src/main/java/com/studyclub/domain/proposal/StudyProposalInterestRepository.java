package com.studyclub.domain.proposal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

public interface StudyProposalInterestRepository
        extends JpaRepository<StudyProposalInterest, Long> {

    /** 회원 탈퇴 — 관심 표시 파기 (specs/user-leave/spec.md). */
    @Transactional
    void deleteByAccountId(Long accountId);
}
