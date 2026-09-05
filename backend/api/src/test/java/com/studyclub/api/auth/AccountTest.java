package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.account.Account;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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

        assertThat(new Account("a@b.com", "n", ok, SystemRole.MEMBER).getProfileImgUrl()).isEqualTo(ok);
    }

    @Test
    @DisplayName("닉네임이 255 를 넘으면 잘라서라도 남긴다 — 잘린 이름도 사람을 알아보는 데 쓸모가 있다")
    void clipsOverlongNickname() {
        Account account = new Account("a@b.com", repeat('가', 300), null, SystemRole.MEMBER);

        assertThat(account.getNickname()).hasSize(255);
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
        account.setNickname(repeat('나', 300));

        assertThat(account.getProfileImgUrl()).isNull();
        assertThat(account.getNickname()).hasSize(255);
    }
}
