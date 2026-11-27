package com.studyclub.domain.account;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.time.TimeZoneIds;
import com.studyclub.domain.participant.ParticipationPeriod;
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
import java.time.temporal.ChronoUnit;
import java.util.List;

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

    /** 운영자 백오피스 헤더 표시 시간대. {@code null} 이면 프로필 → 서울 (specs/timezone §3.4). 프로필과 따로 바뀐다. */
    @Column(name = "ADMIN_DISPLAY_TIME_ZONE", length = 64)
    private String adminDisplayTimeZone;

    @Column(name = "DISCORD_ID", length = 64)
    private String discordId;

    @Column(name = "DISCORD_HANDLE", length = 64)
    private String discordHandle;

    @Column(name = "DISCORD_NICKNAME", length = 100)
    private String discordNickname;

    /** NULL 이면 온보딩 미완료. */
    @Column(name = "ONBOARDING_COMPLETED_AT")
    private Instant onboardingCompletedAt;

    /** 첫 활성화 시각. NULL 이면 아직 스터디 · 행사 신청을 한 번도 성공하지 않았다. */
    @Column(name = "ACTIVATED_AT")
    private Instant activatedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "ACTIVATION_ACTION", length = 20)
    private ActivationAction activationAction;

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

    public String getAdminDisplayTimeZone() {
        return adminDisplayTimeZone;
    }

    /** 헤더 표시 시간대 저장. 검증은 호출자(DTO)가 끝낸 값을 넘긴다. 프로필 {@code TIME_ZONE} 은 바꾸지 않는다. */
    public void changeAdminDisplayTimeZone(String timeZone) {
        this.adminDisplayTimeZone = canonicalTimeZone(timeZone);
    }

    // deprecated 링크(US/Pacific 등)는 정본으로 저장한다. 같은 지역이 두 이름으로 집계되지 않게
    private static String canonicalTimeZone(String timeZone) {
        return TimeZoneIds.normalize(timeZone).orElse(timeZone);
    }

    public String getDiscordId() {
        return discordId;
    }

    public String getDiscordHandle() {
        return discordHandle;
    }

    /** 디스코드 연동 여부. {@code GET /api/me} 의 {@code discordLinked} 와 신청 제출의 403 이 같은 판정을 쓴다. */
    public boolean isDiscordLinked() {
        return discordId != null && !discordId.isBlank();
    }

    /**
     * 디스코드 계정 연동. 값은 서버가 디스코드에서 받은 것만 넘긴다 — 클라이언트가 보낸 ID·핸들을 쓰지 않는다. 다른 계정이 그 ID 를 쓰는지는 호출자가 먼저 본다
     * ({@code UNIQUE(DISCORD_ID)}).
     */
    public void linkDiscord(String discordId, String discordHandle) {
        this.discordId = discordId;
        this.discordHandle = discordHandle;
    }

    /** 디스코드 연결 해제. 신청할 때 받은 서버 별명({@code discordNickname})은 연동과 따로라 남긴다. */
    public void unlinkDiscord() {
        this.discordId = null;
        this.discordHandle = null;
    }

    public String getDiscordNickname() {
        return discordNickname;
    }

    public void changeDiscordNickname(String discordNickname) {
        if (discordNickname == null
                || discordNickname.isBlank()
                || discordNickname.length() > 100) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "discordNickname: invalid");
        }
        this.discordNickname = discordNickname;
    }

    public Instant getOnboardingCompletedAt() {
        return onboardingCompletedAt;
    }

    public Instant getActivatedAt() {
        return activatedAt;
    }

    public ActivationAction getActivationAction() {
        return activationAction;
    }

    /**
     * 첫 활성화 기록 — 이미 활성화된 계정이면 아무것도 바꾸지 않고 {@code false}. 호출자는 이 계정 행을 쓰기 잠금으로 읽은 트랜잭션 안에서 부르고,
     * 반환값으로 {@link AccountActivatedEvent} 를 낼지 정한다. 스터디 신청과 행사 신청이 동시에 와도 계정 잠금으로 한 줄로 서서 한쪽만 true
     * 를 받는다. 취소 · 재신청은 되돌리거나 다시 만들지 않는다 (R4).
     */
    public boolean activate(ActivationAction action, Instant now) {
        if (activatedAt != null) {
            return false;
        }
        this.activatedAt = now.truncatedTo(ChronoUnit.MICROS);
        this.activationAction = action;
        return true;
    }

    /** 최근 180일간 명부 참여와 로그인이 모두 없는 회원. 캡틴도 같고, 기록 미확인은 제외한다. */
    public boolean isDormant(
            Instant lastLoginAt, List<ParticipationPeriod> participationPeriods, Instant asOf) {
        Instant cutoff = asOf.minus(180, ChronoUnit.DAYS);
        return getCreatedAt() != null
                && getCreatedAt().isBefore(cutoff)
                && lastLoginAt != null
                && lastLoginAt.isBefore(cutoff)
                && participationPeriods != null
                && participationPeriods.stream().allMatch(period -> period.endedBefore(cutoff));
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
        this.timeZone = canonicalTimeZone(timeZone);
        this.onboardingCompletedAt = now;
        return true;
    }

    /**
     * 프로필 수정 — 닉네임·타임존을 한 번에 바꾼다. setter 둘로 나누지 않는다 — 닉네임은 중복 검사를 거친 값만 들어와야 하는데 setter 를 열어두면 검사
     * 없이 바꾸는 경로가 생긴다. 형식 검증은 {@link #completeOnboarding} 과 같이 호출자(DTO)가 끝낸 값을 넘긴다고 가정한다.
     */
    public void updateProfile(String nickname, String timeZone) {
        this.nickname = nickname;
        this.timeZone = canonicalTimeZone(timeZone);
    }

    /**
     * 요청자({@code actorId})가 이 계정의 권한을 지금 바꿀 수 없는 이유. 바꿀 수 있으면 {@code null}. 위에서부터 먼저 맞는 것 하나 — 본인이
     * 먼저다.
     *
     * <p><b>판정은 여기 하나다</b> — 백오피스 목록의 배지 잠금과 권한 변경 API 의 거절이 모두 이 메서드를 부른다 (endpoint-convention
     * 「판정은 서버가 내려준다」). 캡틴 수는 계정 하나로 알 수 없어 호출자가 세어 넘긴다 ({@code SYSTEM_ROLE = ADMIN} 행 수 — 목록은 그냥
     * 세고, 변경은 잠그고 센다). 진행 중 담당 스터디가 있는지도 STUDY 를 봐야 알 수 있어 호출자가 넘긴다. 최고 관리자 여부는 env 목록이 정본이라
     * 호출자(SuperAdmins)가 판정해 넘긴다.
     *
     * <p>순서: 본인 → 마지막 캡틴 → 최고 관리자 잠금 → 요청자가 최고 관리자 아님 → 진행 중 담당. 마지막 캡틴을 앞에 두는 건 캡틴 둘이 동시에 서로를 내릴
     * 때의 잠금 판정이 최고 관리자 규칙보다 먼저 보이게 하려는 것이다.
     */
    public RoleChangeBlockedReason roleChangeBlockedReason(
            Long actorId,
            long adminCount,
            boolean ownsOngoingStudy,
            boolean superAdmin,
            boolean actorIsSuperAdmin) {
        if (id.equals(actorId)) {
            return RoleChangeBlockedReason.CANNOT_CHANGE_OWN_ROLE;
        }
        if (systemRole == SystemRole.ADMIN && adminCount <= 1) {
            return RoleChangeBlockedReason.LAST_ADMIN_REQUIRED;
        }
        if (systemRole == SystemRole.ADMIN && superAdmin) {
            return RoleChangeBlockedReason.SUPER_ADMIN_LOCKED;
        }
        if (systemRole == SystemRole.ADMIN && !actorIsSuperAdmin) {
            return RoleChangeBlockedReason.NOT_SUPER_ADMIN;
        }
        if (systemRole == SystemRole.ADMIN && ownsOngoingStudy) {
            return RoleChangeBlockedReason.OWNS_STUDY;
        }
        return null;
    }

    /**
     * 계정 권한 전이. 값이 바뀌었으면 {@code true}, 같은 값이면 아무것도 하지 않고 {@code false}.
     *
     * <p>바꿔도 되는지는 {@link #roleChangeBlockedReason} 이 정하고, 서비스가 이 메서드를 부르기 전에 본다. 여기는 값 전이만 책임진다.
     */
    public boolean changeSystemRole(SystemRole newRole) {
        if (newRole == null) {
            throw new IllegalArgumentException("systemRole must not be null");
        }
        if (this.systemRole == newRole) {
            return false;
        }
        this.systemRole = newRole;
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
