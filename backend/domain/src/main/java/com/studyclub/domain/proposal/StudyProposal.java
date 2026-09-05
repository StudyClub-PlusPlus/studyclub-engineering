package com.studyclub.domain.proposal;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
    name = "STUDY_PROPOSAL",
    indexes = {
        @Index(name = "idx_study_proposal_proposer_account", columnList = "PROPOSER_ACCOUNT_ID"),
        @Index(name = "idx_study_proposal_status_created", columnList = "STATUS, CREATED_AT")
    }
)
public class StudyProposal extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "PROPOSER_ACCOUNT_ID", nullable = false)
    private Long proposerAccountId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "PROPOSED_DATE", nullable = false)
    private Instant proposedDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudyProposalStatusEnum status;

    protected StudyProposal() {
    }

    public StudyProposal(Long proposerAccountId, String content, Instant proposedDate, StudyProposalStatusEnum status) {
        this.proposerAccountId = proposerAccountId;
        this.content = content;
        this.proposedDate = proposedDate;
        this.status = status;
    }

    public Long getId() { return id; }
    public Long getProposerAccountId() { return proposerAccountId; }
    public String getContent() { return content; }
    public Instant getProposedDate() { return proposedDate; }
    public StudyProposalStatusEnum getStatus() { return status; }
}
