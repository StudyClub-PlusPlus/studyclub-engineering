package com.studyclub.domain.proposal;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "STUDY_PROPOSAL_INTEREST",
    uniqueConstraints = @UniqueConstraint(name = "uk_proposal_interest_proposal_account", columnNames = {"PROPOSAL_ID", "ACCOUNT_ID"}),
    indexes = {
        @Index(name = "idx_proposal_interest_proposal", columnList = "PROPOSAL_ID"),
        @Index(name = "idx_proposal_interest_account", columnList = "ACCOUNT_ID")
    }
)
public class StudyProposalInterest extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "PROPOSAL_ID", nullable = false)
    private Long proposalId;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    protected StudyProposalInterest() {
    }

    public StudyProposalInterest(Long proposalId, Long accountId) {
        this.proposalId = proposalId;
        this.accountId = userId;
    }

    public Long getId() { return id; }
    public Long getProposalId() { return proposalId; }
    public Long getAccountId() { return userId; }
}
