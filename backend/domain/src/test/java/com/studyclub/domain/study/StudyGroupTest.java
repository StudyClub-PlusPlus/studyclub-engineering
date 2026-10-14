package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyGroupTest {

    private static StudyGroup group() {
        return new StudyGroup(1L, "수요일반", null, "Asia/Seoul", null);
    }

    @Test
    @DisplayName("규칙은 줄바꿈을 \\n 으로 맞춰 저장한다")
    void normalizesLineBreaks() {
        StudyGroup group = group();

        group.changeRules("1. 발표\r\n2. 출석\r3. 휴가");

        assertThat(group.getRules()).isEqualTo("1. 발표\n2. 출석\n3. 휴가");
    }

    @Test
    @DisplayName("null·공백이면 규칙을 지운다")
    void blankClears() {
        StudyGroup group = group();
        group.changeRules("규칙");

        group.changeRules("   ");

        assertThat(group.getRules()).isNull();
    }

    @Test
    @DisplayName("500자는 통과, 501자는 INVALID_INPUT — 이모지 하나를 한 글자로 센다")
    void limitsTo500CodePoints() {
        StudyGroup group = group();
        String emoji500 = "😀".repeat(500);

        group.changeRules(emoji500);
        assertThat(group.getRules()).isEqualTo(emoji500);
        assertThatThrownBy(() -> group.changeRules("가".repeat(501)))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("탭·줄바꿈 밖의 제어문자는 INVALID_INPUT")
    void rejectsControlCharacters() {
        StudyGroup group = group();

        assertThatThrownBy(() -> group.changeRules("규칙\u0007"))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    private static void assertCode(Throwable e, ErrorCode code) {
        assertThat(((BusinessException) e).errorCode()).isEqualTo(code);
    }
}
