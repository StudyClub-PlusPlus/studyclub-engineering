package com.studyclub.domain.account;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 회원. 프로필·지역·디스코드 연결. 인증 수단은 AccountIdentity 로 분리.
 *
 * <p>구글 프로필 URL 은 길이를 믿지 않는다. 컬럼(512)보다 길면 아바타를 포기하고 로그인은
 * 통과시킨다 — 잘린 URL 은 깨진 이미지라 없느니만 못하다.
 */
@Entity
@Table(
    name = "ACCOUNT",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_users_email", columnNames = "EMAIL"),
        @UniqueConstraint(name = "uk_users_discord_id", columnNames = "DISCORD_ID")
    }
)
public class Account extends BaseEntity {

    private static final int NICKNAME_MAX = 255;
    private static final int PROFILE_IMG_URL_MAX = 2048;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 255)
    private String nickname;

    @Column(name = "PROFILE_IMG_URL", length = 2048)
    private String profileImgUrl;

    @Column(name = "JOB_TITLE", length = 100)
    private String jobTitle;

    @Column(name = "COUNTRY_CODE", columnDefinition = "char(2)")
    private String countryCode;

    @Column(length = 100)
    private String city;

    @Column(name = "REGION_GROUP", length = 20)
    private String regionGroup;

    @Enumerated(EnumType.STRING)
    @Column(name = "SYSTEM_ROLE", nullable = false, length = 20)
    private SystemRole systemRole = SystemRole.MEMBER;

    @Column(name = "TIME_ZONE", length = 64)
    private String timeZone;

    @Column(name = "DISCORD_ID", length = 64)
    private String discordId;

    @Column(name = "DISCORD_HANDLE", length = 64)
    private String discordHandle;

    protected Account() {
    }

    public Account(String email, String nickname, String profileImgUrl, SystemRole systemRole) {
        this.email = email;
        this.nickname = clip(nickname, NICKNAME_MAX);
        this.profileImgUrl = dropIfTooLong(profileImgUrl, PROFILE_IMG_URL_MAX);
        this.systemRole = systemRole != null ? systemRole : SystemRole.MEMBER;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getNickname() { return nickname; }
    public String getProfileImgUrl() { return profileImgUrl; }
    public String getJobTitle() { return jobTitle; }
    public String getCountryCode() { return countryCode; }
    public String getCity() { return city; }
    public String getRegionGroup() { return regionGroup; }
    public SystemRole getSystemRole() { return systemRole; }
    public String getTimeZone() { return timeZone; }
    public String getDiscordId() { return discordId; }
    public String getDiscordHandle() { return discordHandle; }

    public void setNickname(String nickname) {
        this.nickname = clip(nickname, NICKNAME_MAX);
    }

    public void setProfileImgUrl(String profileImgUrl) {
        this.profileImgUrl = dropIfTooLong(profileImgUrl, PROFILE_IMG_URL_MAX);
    }

    /** 이름은 잘라서라도 남긴다 — 잘린 이름도 사람을 알아보는 데 쓸모가 있다. */
    static String clip(String v, int max) {
        return v == null || v.length() <= max ? v : v.substring(0, max);
    }

    /** URL 은 자르지 않고 버린다 — 잘린 URL 은 깨진 이미지라 없느니만 못하다. */
    static String dropIfTooLong(String v, int max) {
        return v == null || v.length() <= max ? v : null;
    }
}
