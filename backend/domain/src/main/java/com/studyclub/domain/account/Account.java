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
import java.time.Instant;

/**
 * 회원. 프로필·지역·디스코드 연결. 인증 수단은 AccountIdentity 로 분리.
 *
 * <p>구글 프로필 URL 은 길이를 믿지 않는다. 컬럼(2048)보다 길면 아바타를 포기하고 로그인은 통과시킨다 — 잘린 URL 은 깨진 이미지라 없느니만 못하다.
 */
@Entity
@Table(
        name = "ACCOUNT",
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_account_email", columnNames = "EMAIL"),
            @UniqueConstraint(name = "uk_account_discord_id", columnNames = "DISCORD_ID"),
            @UniqueConstraint(name = "uk_account_nickname", columnNames = "NICKNAME")
        })
public class Account extends BaseEntity {

    /** 온보딩 스펙·ERD: 2~20자. */
    private static final int NICKNAME_MAX = 20;

    private static final int PROFILE_IMG_URL_MAX = 2048;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 20)
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

    /** NULL 이면 온보딩 미완료. */
    @Column(name = "ONBOARDING_COMPLETED_AT")
    private Instant onboardingCompletedAt;

    protected Account() {}

    public Account(String email, String nickname, String profileImgUrl, SystemRole systemRole) {
        this.email = email;
        this.nickname = clip(nickname, NICKNAME_MAX);
        this.profileImgUrl = dropIfTooLong(profileImgUrl, PROFILE_IMG_URL_MAX);
        this.systemRole = systemRole != null ? systemRole : SystemRole.MEMBER;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getNickname() {
        return nickname;
    }

    public String getProfileImgUrl() {
        return profileImgUrl;
    }

    public String getJobTitle() {
        return jobTitle;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public String getCity() {
        return city;
    }

    public String getRegionGroup() {
        return regionGroup;
    }

    public SystemRole getSystemRole() {
        return systemRole;
    }

    public String getTimeZone() {
        return timeZone;
    }

    public String getDiscordId() {
        return discordId;
    }

    public String getDiscordHandle() {
        return discordHandle;
    }

    public Instant getOnboardingCompletedAt() {
        return onboardingCompletedAt;
    }

    public void setNickname(String nickname) {
        this.nickname = clip(nickname, NICKNAME_MAX);
    }

    /**
     * 온보딩 완료 — 닉네임·타임존 확정 + 완료 시각 기록. 멱등: 이미 완료된 계정은 아무것도 바꾸지 않고 {@code false} 를 돌려준다. 호출자는 이 반환값으로
     * {@code UserRegisteredEvent}를 낼지 판단한다 — ACCOUNT 당 한 번만 실제로 전이가 일어나야 하기 때문이다.
     *
     * <p>닉네임·타임존 형식 검증은 호출자(DTO 의 {@code @Valid})가 이미 끝낸 값을 넘긴다고 가정한다 — 이 메서드는 "온보딩을 완료했는가"라는 상태
     * 전이만 책임진다.
     */
    public boolean completeOnboarding(String nickname, String timeZone, Instant now) {
        if (onboardingCompletedAt != null) {
            return false;
        }
        this.nickname = nickname;
        this.timeZone = timeZone;
        this.onboardingCompletedAt = now;
        return true;
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
