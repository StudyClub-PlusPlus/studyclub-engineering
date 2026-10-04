package com.studyclub.domain.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyApplicationAnswerTest {

    @Test
    @DisplayName("한 줄 값은 줄바꿈·탭을 공백으로 바꾼 뒤 길이를 검사하고 저장한다")
    void normalizesSingleLineBeforeCheckingLength() {
        String nickname = "가".repeat(49) + "\n\t" + "나".repeat(49);

        StudyApplicationAnswer answer =
                StudyApplicationAnswer.create(
                        nickname, List.of("mon"), null, Map.of(), false, List.of());

        assertThat(answer.discordNickname()).isEqualTo("가".repeat(49) + " " + "나".repeat(49));
        assertThat(answer.availableDays()).containsExactly(ApplicationDay.MON);
    }

    @Test
    @DisplayName("요일은 중복되거나 enum 밖이면 거절한다")
    void rejectsInvalidDays() {
        assertThatThrownBy(
                        () ->
                                StudyApplicationAnswer.create(
                                        "별명",
                                        List.of("mon", "mon"),
                                        null,
                                        Map.of(),
                                        false,
                                        List.of()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("availableDays: enum");
        for (String value : List.of("MON", "monday", " mon", "")) {
            assertThatThrownBy(
                            () ->
                                    StudyApplicationAnswer.create(
                                            "별명", List.of(value), null, Map.of(), false, List.of()))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("availableDays: enum");
        }
    }

    @Test
    @DisplayName("참여 가능 요일은 enum으로 보관하고 제출 순서를 유지한다")
    void keepsSelectedDayOrder() {
        StudyApplicationAnswer answer =
                StudyApplicationAnswer.create(
                        "별명", List.of("sun", "mon", "wed"), null, Map.of(), false, List.of());

        assertThat(answer.availableDays())
                .containsExactly(ApplicationDay.SUN, ApplicationDay.MON, ApplicationDay.WED);
    }

    @Test
    @DisplayName("필수 단답은 200자까지 받고 201자는 거절한다")
    void validatesTextBoundary() {
        ApplicationFormQuestion question = question("TEXT", true, List.of(), false);

        StudyApplicationAnswer accepted =
                StudyApplicationAnswer.create(
                        "별명",
                        List.of("mon"),
                        null,
                        Map.of("question", "가".repeat(200)),
                        false,
                        List.of(question));

        assertThat(accepted.answers()).containsEntry("question", "가".repeat(200));
        assertThatThrownBy(
                        () ->
                                StudyApplicationAnswer.create(
                                        "별명",
                                        List.of("mon"),
                                        null,
                                        Map.of("question", "가".repeat(201)),
                                        false,
                                        List.of(question)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("answers.question: max");
    }

    @Test
    @DisplayName("선택형은 저장된 선택지만 받고 RADIO의 기타 답은 100자까지 받는다")
    void validatesSingleChoiceAndOther() {
        ApplicationFormQuestion question = question("RADIO", true, List.of("백엔드", "프론트엔드"), true);

        StudyApplicationAnswer accepted =
                StudyApplicationAnswer.create(
                        "별명",
                        List.of("wed"),
                        null,
                        Map.of("question", "기타 관심사"),
                        false,
                        List.of(question));

        assertThat(accepted.answers()).containsEntry("question", "기타 관심사");
        assertThatThrownBy(
                        () ->
                                StudyApplicationAnswer.create(
                                        "별명",
                                        List.of("wed"),
                                        null,
                                        Map.of("question", "가".repeat(101)),
                                        false,
                                        List.of(question)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("answers.question: other-max");
    }

    @Test
    @DisplayName("체크박스 기타는 하나만 허용하고 중복 선택을 거절한다")
    void rejectsMultipleOtherCheckboxValues() {
        ApplicationFormQuestion question = question("CHECKBOX", true, List.of("백엔드"), true);

        assertThatThrownBy(
                        () ->
                                StudyApplicationAnswer.create(
                                        "별명",
                                        List.of("fri"),
                                        null,
                                        Map.of("question", List.of("기타1", "기타2")),
                                        false,
                                        List.of(question)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("answers.question: enum");
    }

    @Test
    @DisplayName("확정 일정이 있으면 추가 질문 검증 다음에 true 동의를 요구한다")
    void requiresScheduleAgreement() {
        assertThatThrownBy(
                        () ->
                                StudyApplicationAnswer.create(
                                        "별명", List.of("sun"), false, Map.of(), true, List.of()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("scheduleAgreed: empty");
    }

    private ApplicationFormQuestion question(
            String type, boolean required, List<String> options, boolean allowOther) {
        return new ApplicationFormQuestion(
                "question",
                "질문",
                ApplicationFormQuestionType.valueOf(type),
                required,
                null,
                null,
                options,
                allowOther);
    }

    @Test
    @DisplayName("일정이 없으면 false와 null은 무시하고 true는 거절한다")
    void ignoresInactiveScheduleAgreement() {
        for (Boolean value : java.util.Arrays.asList(false, null)) {
            StudyApplicationAnswer answer =
                    StudyApplicationAnswer.create(
                            "별명", List.of("mon"), value, Map.of(), false, List.of());
            assertThat(answer.scheduleAgreed()).isNull();
        }
        assertThatThrownBy(
                        () ->
                                StudyApplicationAnswer.create(
                                        "별명", List.of("mon"), true, Map.of(), false, List.of()))
                .isInstanceOf(BusinessException.class)
                .hasMessage("scheduleAgreed: unexpected");
    }

    @Test
    @DisplayName("체크박스 빈 기타 항목은 선택지와 함께 보내도 거절한다")
    void rejectsEmptyCheckboxChoice() {
        for (boolean required : List.of(true, false)) {
            ApplicationFormQuestion question = question("CHECKBOX", required, List.of("백엔드"), true);
            assertThatThrownBy(
                            () ->
                                    StudyApplicationAnswer.create(
                                            "별명",
                                            List.of("mon"),
                                            null,
                                            Map.of("question", List.of("백엔드", " \n\t ")),
                                            false,
                                            List.of(question)))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("answers.question: other-empty");
        }
    }

    @Test
    @DisplayName("선택적 체크박스는 빈 목록을 허용하지만 빈 문자열 항목은 거절한다")
    void distinguishesUnselectedCheckboxFromBlankEntry() {
        ApplicationFormQuestion question = question("CHECKBOX", false, List.of("백엔드"), false);
        StudyApplicationAnswer empty =
                StudyApplicationAnswer.create(
                        "별명",
                        List.of("mon"),
                        null,
                        Map.of("question", List.of()),
                        false,
                        List.of(question));
        assertThat(empty.answers()).isEmpty();
        assertThatThrownBy(
                        () ->
                                StudyApplicationAnswer.create(
                                        "별명",
                                        List.of("mon"),
                                        null,
                                        Map.of("question", List.of(" ")),
                                        false,
                                        List.of(question)))
                .isInstanceOf(BusinessException.class)
                .hasMessage("answers.question: enum");
    }
}
