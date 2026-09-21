package com.studyclub.domain.discord;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 스터디 하나가 쓰는 디스코드 카테고리·역할 ID. 봇이 아는 식별자는 {@code discordStudyId} 뿐이라 그걸 {@code STUDY.ID} 로 바꾸는 자리다.
 *
 * <p>snowflake 는 문자열로 둔다 — {@code BIGINT} 로 받으면 프론트·봇의 JS 정밀도에서 깨진다.
 */
@Entity
@Table(
        name = "STUDY_DISCORD_LINK",
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_study_discord_link_study", columnNames = "STUDY_ID"),
            @UniqueConstraint(
                    name = "uk_study_discord_link_discord",
                    columnNames = "DISCORD_STUDY_ID")
        })
public class StudyDiscordLink extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "STUDY_ID", nullable = false)
    private Long studyId;

    @Column(name = "DISCORD_STUDY_ID", nullable = false, length = 20)
    private String discordStudyId;

    @Column(name = "DISCORD_ROLE_ID", nullable = false, length = 20)
    private String discordRoleId;

    protected StudyDiscordLink() {}

    public StudyDiscordLink(Long studyId, String discordStudyId, String discordRoleId) {
        this.studyId = studyId;
        this.discordStudyId = discordStudyId;
        this.discordRoleId = discordRoleId;
    }

    public Long getId() {
        return id;
    }

    public Long getStudyId() {
        return studyId;
    }

    public String getDiscordStudyId() {
        return discordStudyId;
    }

    public String getDiscordRoleId() {
        return discordRoleId;
    }
}
