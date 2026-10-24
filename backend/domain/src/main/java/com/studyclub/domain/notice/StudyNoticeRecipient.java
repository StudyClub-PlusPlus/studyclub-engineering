package com.studyclub.domain.notice;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 공지를 받는 사람 한 명. {@link StudyNotice} 애그리거트 안에서만 만들고 바꾼다.
 *
 * <p>{@code ACCOUNT_ID} 는 ID 참조다. 회원이 탈퇴해 {@code ACCOUNT} 행이 지워지면 이 값으로는 사람을 되짚을 수 없어 따로 비식별할 것이 없다
 * ({@code STUDY_ATTENDANCE} 와 같은 원칙).
 */
@Entity
@Table(name = "STUDY_NOTICE_RECIPIENT")
public class StudyNoticeRecipient extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    /** 디스코드 글에서 멘션됐는가. 디스코드를 보내기 전에는 false 다. */
    @Column(name = "DISCORD_MENTIONED", nullable = false)
    private boolean discordMentioned;

    protected StudyNoticeRecipient() {}

    StudyNoticeRecipient(Long accountId) {
        this.accountId = accountId;
    }

    public Long getAccountId() {
        return accountId;
    }

    public boolean isDiscordMentioned() {
        return discordMentioned;
    }

    void markMentioned() {
        this.discordMentioned = true;
    }
}
