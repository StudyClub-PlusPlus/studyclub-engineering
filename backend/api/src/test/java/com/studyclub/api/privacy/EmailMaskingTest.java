package com.studyclub.api.privacy;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.common.privacy.EmailMasking;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EmailMaskingTest {

    @Test
    @DisplayName("앞 1자만 남기고 @ 앞을 가린다 — 도메인은 그대로")
    void masksLocalPart() {
        assertThat(EmailMasking.mask("haneul@example.com")).isEqualTo("h***@example.com");
    }

    @Test
    @DisplayName("로컬파트가 1자여도 같은 모양이다")
    void masksSingleCharLocalPart() {
        assertThat(EmailMasking.mask("a@example.com")).isEqualTo("a***@example.com");
    }

    @Test
    @DisplayName("@ 가 없으면 전부 가린다")
    void masksFullyWithoutAt() {
        assertThat(EmailMasking.mask("not-an-email")).isEqualTo("***");
    }

    @Test
    @DisplayName("@ 가 맨 앞이면 전부 가린다 — 보여 줄 로컬파트가 없다")
    void masksFullyWhenAtIsFirst() {
        assertThat(EmailMasking.mask("@example.com")).isEqualTo("***");
    }

    @Test
    @DisplayName("null 이면 전부 가린다")
    void masksNull() {
        assertThat(EmailMasking.mask(null)).isEqualTo("***");
    }
}
