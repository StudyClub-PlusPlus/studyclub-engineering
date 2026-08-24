package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 구글이 주는 프로필 문자열이 컬럼보다 길어도 로그인이 죽지 않아야 한다.
 *
 * <p>2026-08-24 사고: picture 가 varchar(512) 를 넘겨 INSERT 가 터지고 /auth/social-login 이 500 을 냈다.
 * 컬럼은 2048 로 넓혔고, 아래 가드는 그래도 넘칠 때의 backstop 이다.
 * 이 테스트가 깨지면 그 사고가 되돌아온 것이다.
 */
class UserTest {

    private static String repeat(char c, int n) {
        return String.valueOf(c).repeat(n);
    }

    @Test
    @DisplayName("사진 URL 이 컬럼(2048)을 넘으면 버린다 — 잘린 URL 은 깨진 이미지라 없느니만 못하다")
    void dropsOverlongPicture() {
        String tooLong = "https://lh3.googleusercontent.com/" + repeat('x', 2100);

        User user = new User("a@b.com", "홍길동", tooLong, "sub", Role.STUDENT);

        assertThat(user.getPicture()).isNull();
        assertThat(user.getEmail()).isEqualTo("a@b.com");
    }

    @Test
    @DisplayName("2048 이하 사진 URL 은 그대로 둔다 — 사고를 낸 그 길이(600자)도 이제 살아남는다")
    void keepsNormalPicture() {
        String ok = "https://lh3.googleusercontent.com/a/" + repeat('x', 600);

        assertThat(new User("a@b.com", "n", ok, "sub", Role.STUDENT).getPicture()).isEqualTo(ok);
    }

    @Test
    @DisplayName("이름이 255 를 넘으면 잘라서라도 남긴다 — 잘린 이름은 여전히 쓸모가 있다")
    void clipsOverlongName() {
        User user = new User("a@b.com", repeat('가', 300), null, "sub", Role.STUDENT);

        assertThat(user.getName()).hasSize(255);
    }

    @Test
    @DisplayName("null 은 그대로 통과 — 사진 없는 계정이 있다")
    void allowsNull() {
        User user = new User("a@b.com", null, null, "sub", Role.STUDENT);

        assertThat(user.getName()).isNull();
        assertThat(user.getPicture()).isNull();
    }

    @Test
    @DisplayName("setter 도 같은 방어를 한다 — 생성자만 막으면 나중에 새는 자리가 생긴다")
    void settersGuardToo() {
        User user = new User("a@b.com", "n", null, "sub", Role.STUDENT);

        user.setPicture("https://x/" + repeat('y', 2100));
        user.setName(repeat('나', 300));

        assertThat(user.getPicture()).isNull();
        assertThat(user.getName()).hasSize(255);
    }
}
