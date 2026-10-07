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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "STUDY_PROPOSAL",
        indexes = {
            @Index(
                    name = "idx_study_proposal_proposer_account",
                    columnList = "PROPOSER_ACCOUNT_ID"),
            @Index(name = "idx_study_proposal_status_created", columnList = "STATUS, CREATED_AT")
        })
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyProposal extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "PROPOSER_ACCOUNT_ID", nullable = false)
    private Long proposerAccountId;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "PROPOSED_AT", nullable = false)
    private Instant proposedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StudyProposalStatus status;

    /**
     * 제안자 탈퇴 — {@code OPEN} 인 제안만 {@code CLOSED} 로 닫는다. 물리 삭제하지 않는 이유는 다른 회원의 {@code
     * STUDY_PROPOSAL_INTEREST}(관심 표시)를 보호하기 위해서다 — 제안 행을 지우면 그 기록들이 고아가 된다
     * (specs/user-leave/spec.md). {@code ACCEPTED}/{@code REJECTED}/이미 {@code CLOSED} 인 제안은 이미 종결
     * 상태라 건드리지 않는다 — 멱등.
     */
    public void closeDueToProposerLeaving() {
        if (status == StudyProposalStatus.OPEN) {
            this.status = StudyProposalStatus.CLOSED;
        }
    }
}
