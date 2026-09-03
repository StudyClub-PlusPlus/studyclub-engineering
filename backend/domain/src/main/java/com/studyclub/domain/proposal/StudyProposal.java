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
        @Index(name = "idx_study_proposal_proposer", columnList = "PROPOSER_USER_ID"),
        @Index(name = "idx_study_proposal_status_created", columnList = "STATUS, CREATED_AT")
    }
)
public class StudyProposal extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "PROPOSER_USER_ID", nullable = false)
    private Long proposerUserId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "PROPOSED_DATE", nullable = false)
    private Instant proposedDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudyProposalStatusEnum status;

    protected StudyProposal() {
    }

    public StudyProposal(Long proposerUserId, String content, Instant proposedDate, StudyProposalStatusEnum status) {
        this.proposerUserId = proposerUserId;
        this.content = content;
        this.proposedDate = proposedDate;
        this.status = status;
    }

    public Long getId() { return id; }
    public Long getProposerUserId() { return proposerUserId; }
    public String getContent() { return content; }
    public Instant getProposedDate() { return proposedDate; }
    public StudyProposalStatusEnum getStatus() { return status; }
}
