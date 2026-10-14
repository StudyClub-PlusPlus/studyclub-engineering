package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.RoleChangeBlockedReason;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 구글이 주는 프로필 문자열이 컬럼보다 길어도 로그인이 죽지 않아야 한다.
 *
 * <p>2026-08-24 사고: picture 가 varchar(2048) 를 넘겨 INSERT 가 터지고 /auth/social-login 이 500 을 냈다.
 * USER.md 에 PROFILE_IMG_URL VARCHAR(2048) 로 확정됐다. 아래 가드는 그래도 넘칠 때의 backstop 이다.
 */
class AccountTest {

    private static String repeat(char c, int n) {
        return String.valueOf(c).repeat(n);
    }

    @Test
    @DisplayName("사진 URL 이 컬럼(2048)을 넘으면 버린다 — 잘린 URL 은 깨진 이미지라 없느니만 못하다")
    void dropsOverlongPicture() {
        String tooLong = "https://lh3.googleusercontent.com/" + repeat('x', 2100);

        Account account = new Account("a@b.com", "홍길동", tooLong, SystemRole.MEMBER);

        assertThat(account.getProfileImgUrl()).isNull();
        assertThat(account.getEmail()).isEqualTo("a@b.com");
    }

    @Test
    @DisplayName("2048 이하 사진 URL 은 그대로 둔다 — 사고를 낸 그 길이(600자)도 이제 살아남는다")
    void keepsNormalPicture() {
        String ok = "https://lh3.googleusercontent.com/a/" + repeat('x', 600);

        assertThat(new Account("a@b.com", "n", ok, SystemRole.MEMBER).getProfileImgUrl())
                .isEqualTo(ok);
    }

    @Test
    @DisplayName("닉네임이 20 을 넘으면 잘라서라도 남긴다 — 잘린 이름도 사람을 알아보는 데 쓸모가 있다")
    void clipsOverlongNickname() {
        Account account = new Account("a@b.com", repeat('가', 30), null, SystemRole.MEMBER);

        assertThat(account.getNickname()).hasSize(20);
    }

    @Test
    @DisplayName("null 은 그대로 통과 — 사진 없는 계정이 있다")
    void allowsNull() {
        Account account = new Account("a@b.com", null, null, SystemRole.MEMBER);

        assertThat(account.getNickname()).isNull();
        assertThat(account.getProfileImgUrl()).isNull();
    }

    @Test
    @DisplayName("setter 도 같은 방어를 한다 — 생성자만 막으면 나중에 새는 자리가 생긴다")
    void settersGuardToo() {
        Account account = new Account("a@b.com", "n", null, SystemRole.MEMBER);

        account.setProfileImgUrl("https://x/" + repeat('y', 2100));
        account.setNickname(repeat('나', 30));

        assertThat(account.getProfileImgUrl()).isNull();
        assertThat(account.getNickname()).hasSize(20);
    }

    @Test
    @DisplayName("온보딩 완료 - 최초 호출이면 닉네임·타임존·완료시각을 반영하고 true 를 돌려준다")
    void completesOnboardingOnFirstCall() {
        Account account = new Account("a@b.com", "account_temp12345678", null, SystemRole.MEMBER);
        Instant now = Instant.now();

        boolean result = account.completeOnboarding("honggildong", "Asia/Seoul", now);

        assertThat(result).isTrue();
        assertThat(account.getNickname()).isEqualTo("honggildong");
        assertThat(account.getTimeZone()).isEqualTo("Asia/Seoul");
        assertThat(account.getOnboardingCompletedAt()).isEqualTo(now);
    }

    @Test
    @DisplayName("온보딩 완료 - 이미 완료된 계정은 재호출해도 아무것도 바꾸지 않고 false 를 돌려준다 (멱등)")
    void secondCompleteOnboardingCallIsNoop() {
        Account account = new Account("a@b.com", "account_temp12345678", null, SystemRole.MEMBER);
        Instant firstCompletedAt = Instant.now();
        account.completeOnboarding("honggildong", "Asia/Seoul", firstCompletedAt);

        boolean result =
                account.completeOnboarding("kimcheolsu", "America/New_York", Instant.now());

        assertThat(result).isFalse();
        assertThat(account.getNickname()).isEqualTo("honggildong");
        assertThat(account.getTimeZone()).isEqualTo("Asia/Seoul");
        assertThat(account.getOnboardingCompletedAt()).isEqualTo(firstCompletedAt);
    }

    @Test
    @DisplayName("프로필 수정 - 닉네임·타임존을 한 번에 바꾸고 온보딩 완료시각은 건드리지 않는다")
    void updatesProfile() {
        Account account = new Account("a@b.com", "account_temp12345678", null, SystemRole.MEMBER);
        Instant completedAt = Instant.now();
        account.completeOnboarding("honggildong", "Asia/Seoul", completedAt);

        account.updateProfile("kimcheolsu", "America/Vancouver");

        assertThat(account.getNickname()).isEqualTo("kimcheolsu");
        assertThat(account.getTimeZone()).isEqualTo("America/Vancouver");
        assertThat(account.getOnboardingCompletedAt()).isEqualTo(completedAt);
    }

    @Test
    @DisplayName("권한 전이 - 다른 값이면 바꾸고 true 를 돌려준다")
    void changeSystemRoleChangesValue() {
        Account account = new Account("a@b.com", "n", null, SystemRole.MEMBER);

        boolean changed = account.changeSystemRole(SystemRole.ADMIN);

        assertThat(changed).isTrue();
        assertThat(account.getSystemRole()).isEqualTo(SystemRole.ADMIN);
    }

    @Test
    @DisplayName("권한 전이 - 같은 값이면 아무것도 바꾸지 않고 false 를 돌려준다 (감사 로그를 남기지 않는 근거)")
    void changeSystemRoleSameValueIsNoop() {
        Account account = new Account("a@b.com", "n", null, SystemRole.ADMIN);

        boolean changed = account.changeSystemRole(SystemRole.ADMIN);

        assertThat(changed).isFalse();
        assertThat(account.getSystemRole()).isEqualTo(SystemRole.ADMIN);
    }

    @Test
    @DisplayName("권한 전이 - null 은 예외 — 권한을 비울 수 없다")
    void changeSystemRoleRejectsNull() {
        Account account = new Account("a@b.com", "n", null, SystemRole.MEMBER);

        assertThatThrownBy(() -> account.changeSystemRole(null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(account.getSystemRole()).isEqualTo(SystemRole.MEMBER);
    }

    private static Account accountWithId(long id, SystemRole role) {
        Account account = new Account("a" + id + "@b.com", "회원" + id, null, role);
        ReflectionTestUtils.setField(account, "id", id);
        return account;
    }

    @Test
    @DisplayName("권한 변경 가능 여부 — 본인이면 마지막 캡틴이어도 「본인」이 먼저다")
    void ownAccountComesFirst() {
        Account me = accountWithId(1L, SystemRole.ADMIN);
        assertThat(me.roleChangeBlockedReason(1L, 1))
                .isEqualTo(RoleChangeBlockedReason.CANNOT_CHANGE_OWN_ROLE);
    }

    @Test
    @DisplayName("권한 변경 가능 여부 — 남의 계정이 마지막 캡틴이면 막고, 캡틴이 둘 이상이면 연다")
    void lastAdminIsBlocked() {
        Account other = accountWithId(2L, SystemRole.ADMIN);
        assertThat(other.roleChangeBlockedReason(1L, 1))
                .isEqualTo(RoleChangeBlockedReason.LAST_ADMIN_REQUIRED);
        assertThat(other.roleChangeBlockedReason(1L, 2)).isNull();
    }

    @Test
    @DisplayName("권한 변경 가능 여부 — 크루는 캡틴 수와 상관없이 올릴 수 있다")
    void memberIsNeverBlockedByAdminCount() {
        Account crew = accountWithId(3L, SystemRole.MEMBER);
        assertThat(crew.roleChangeBlockedReason(1L, 1)).isNull();
    }
}
