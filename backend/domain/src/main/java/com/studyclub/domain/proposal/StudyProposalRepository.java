package com.studyclub.domain.proposal;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyProposalRepository extends JpaRepository<StudyProposal, Long> {

    /** 회원 탈퇴 — 아직 관심을 모으는 중(OPEN)인 제안만 닫는다. ACCEPTED/REJECTED/CLOSED 는 이미 종결 상태라 대상이 아니다. */
    List<StudyProposal> findByProposerAccountIdAndStatus(
            Long proposerAccountId, StudyProposalStatus status);
}
