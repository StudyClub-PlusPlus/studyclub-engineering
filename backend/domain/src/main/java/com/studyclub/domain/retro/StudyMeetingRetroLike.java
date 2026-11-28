package com.studyclub.domain.retro;

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
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "STUDY_MEETING_RETRO_LIKE",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_retro_like",
                        columnNames = {"RETRO_ID", "SECTION", "ACCOUNT_ID"}),
        indexes = @Index(name = "idx_retro_like_account", columnList = "ACCOUNT_ID"))
public class StudyMeetingRetroLike extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 같은 애그리거트 — FK(CASCADE DELETE)로 연결
    @Column(name = "RETRO_ID", nullable = false)
    private Long retroId;

    @Enumerated(EnumType.STRING)
    @Column(name = "SECTION", nullable = false, length = 16)
    private RetroSection section;

    // 다른 애그리거트라 FK 없이 ID 참조
    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    protected StudyMeetingRetroLike() {}

    public static StudyMeetingRetroLike of(Long retroId, RetroSection section, Long accountId) {
        StudyMeetingRetroLike like = new StudyMeetingRetroLike();
        like.retroId = retroId;
        like.section = section;
        like.accountId = accountId;
        return like;
    }

    public Long getId() {
        return id;
    }

    public Long getRetroId() {
        return retroId;
    }

    public RetroSection getSection() {
        return section;
    }

    public Long getAccountId() {
        return accountId;
    }
}
