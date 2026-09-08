package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.account.NicknamePolicy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 온보딩 스펙(specs/user-onboarding/spec.md)의 닉네임 형식 규칙을 분기마다 못 박는다.
 * 중복 검사(DB 조회)는 여기 대상이 아니다 — {@code AccountOnboardingIntegrationTest} 가 본다.
 */
class NicknamePolicyTest {

    @Test
    @DisplayName("trim 후 2자 이상 20자 이하면 통과한다 — 경계값 2/20")
    void acceptsBoundaryLengths() {
        assertThat(NicknamePolicy.violation("ab")).isNull();
        assertThat(NicknamePolicy.violation("a".repeat(20))).isNull();
    }

    @Test
    @DisplayName("trim 후 1자면 막는다 — 경계값 1")
    void rejectsTooShort() {
        assertThat(NicknamePolicy.violation("a")).isEqualTo("2~20자여야 합니다");
    }

    @Test
    @DisplayName("trim 후 21자면 막는다 — 경계값 21")
    void rejectsTooLong() {
        assertThat(NicknamePolicy.violation("a".repeat(21))).isEqualTo("2~20자여야 합니다");
    }

    @Test
    @DisplayName("앞뒤 공백은 trim 후 판정한다 — 원문이 22자라도 trim 하면 20자면 통과")
    void normalizesBeforeValidating() {
        String withSpaces = "  " + "a".repeat(20) + "  ";

        assertThat(NicknamePolicy.violation(NicknamePolicy.normalize(withSpaces))).isNull();
    }

    @Test
    @DisplayName("한글·영문·숫자·밑줄은 언어 상관없이 허용한다")
    void acceptsLettersDigitsUnderscoreAcrossLanguages() {
        assertThat(NicknamePolicy.violation("홍길동_123")).isNull();
        assertThat(NicknamePolicy.violation("honggildong_1")).isNull();
    }

    @Test
    @DisplayName("공백이 포함되면 막는다")
    void rejectsInternalSpace() {
        assertThat(NicknamePolicy.violation("hong gildong")).isEqualTo("글자·숫자·밑줄(_)만 사용할 수 있습니다");
    }

    @Test
    @DisplayName("특수문자가 포함되면 막는다")
    void rejectsSpecialCharacters() {
        assertThat(NicknamePolicy.violation("hong@gildong")).isEqualTo("글자·숫자·밑줄(_)만 사용할 수 있습니다");
    }

    @Test
    @DisplayName("밑줄만으로 구성하면 막는다 — 형식은 통과하지만 별도 규칙")
    void rejectsAllUnderscore() {
        assertThat(NicknamePolicy.violation("____")).isEqualTo("밑줄만으로 구성할 수 없습니다");
    }

    @Test
    @DisplayName("운영진·관리자·admin 은 대소문자 상관없이 막는다")
    void rejectsReservedNamesIgnoringCase() {
        assertThat(NicknamePolicy.violation("운영진")).isEqualTo("사용할 수 없는 닉네임입니다");
        assertThat(NicknamePolicy.violation("관리자")).isEqualTo("사용할 수 없는 닉네임입니다");
        assertThat(NicknamePolicy.violation("admin")).isEqualTo("사용할 수 없는 닉네임입니다");
        assertThat(NicknamePolicy.violation("Admin")).isEqualTo("사용할 수 없는 닉네임입니다");
        assertThat(NicknamePolicy.violation("ADMIN")).isEqualTo("사용할 수 없는 닉네임입니다");
    }

    @Test
    @DisplayName("account_ 접두사는 대소문자 상관없이 막는다 — 임시 닉네임과 겹치지 않게")
    void rejectsAccountPrefixIgnoringCase() {
        assertThat(NicknamePolicy.violation("account_abc123456789")).isEqualTo("사용할 수 없는 닉네임입니다");
        assertThat(NicknamePolicy.violation("ACCOUNT_abc123456789")).isEqualTo("사용할 수 없는 닉네임입니다");
    }

    @Test
    @DisplayName("null 은 필수 위반으로 취급한다")
    void rejectsNull() {
        assertThat(NicknamePolicy.violation(null)).isEqualTo("닉네임은 필수입니다");
    }

    @Test
    @DisplayName("isValid 는 violation 이 없을 때만 true 다")
    void isValidMirrorsViolation() {
        assertThat(NicknamePolicy.isValid("honggildong")).isTrue();
        assertThat(NicknamePolicy.isValid("a")).isFalse();
    }
}
