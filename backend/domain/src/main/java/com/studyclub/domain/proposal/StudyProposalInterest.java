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
    uniqueConstraints = @UniqueConstraint(name = "uk_proposal_interest_proposal_user", columnNames = {"PROPOSAL_ID", "USER_ID"}),
    indexes = {
        @Index(name = "idx_proposal_interest_proposal", columnList = "PROPOSAL_ID"),
        @Index(name = "idx_proposal_interest_user", columnList = "USER_ID")
    }
)
public class StudyProposalInterest extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "PROPOSAL_ID", nullable = false)
    private Long proposalId;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    protected StudyProposalInterest() {
    }

    public StudyProposalInterest(Long proposalId, Long userId) {
        this.proposalId = proposalId;
        this.userId = userId;
    }

    public Long getId() { return id; }
    public Long getProposalId() { return proposalId; }
    public Long getUserId() { return userId; }
}
