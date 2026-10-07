package com.studyclub.domain.proposal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.params.provider.EnumSource.Mode.EXCLUDE;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class StudyProposalTest {

    private StudyProposal proposalWith(StudyProposalStatus status) {
        return StudyProposal.builder()
                .proposerAccountId(1L)
                .content("이런 스터디 열어주세요")
                .proposedAt(Instant.now())
                .status(status)
                .build();
    }

    @Test
    @DisplayName("제안자 탈퇴 - OPEN 이면 CLOSED 로 전환한다")
    void closesOpenProposal() {
        StudyProposal proposal = proposalWith(StudyProposalStatus.OPEN);

        proposal.closeDueToProposerLeaving();

        assertThat(proposal.getStatus()).isEqualTo(StudyProposalStatus.CLOSED);
    }

    @ParameterizedTest
    @EnumSource(value = StudyProposalStatus.class, names = "OPEN", mode = EXCLUDE)
    @DisplayName("제안자 탈퇴 - 이미 종결 상태(ACCEPTED/REJECTED/CLOSED)면 건드리지 않는다 - 멱등")
    void leavesAlreadyResolvedProposalUntouched(StudyProposalStatus status) {
        StudyProposal proposal = proposalWith(status);

        proposal.closeDueToProposerLeaving();

        assertThat(proposal.getStatus()).isEqualTo(status);
    }
}
