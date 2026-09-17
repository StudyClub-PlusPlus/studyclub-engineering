package com.studyclub.api.bookmark;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyBookmarkControllerTest {

    private StudyBookmarkController controller;

    @BeforeEach
    void setUp() {
        controller = new StudyBookmarkController(mock(StudyBookmarkService.class));
    }

    @Test
    @DisplayName("실패 - offset이 음수이면 INVALID_INPUT 예외를 던진다")
    void rejectsNegativeOffset() {
        assertThatThrownBy(() -> controller.getBookmarks(-1, 20, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("실패 - limit이 0이면 INVALID_INPUT 예외를 던진다")
    void rejectsZeroLimit() {
        assertThatThrownBy(() -> controller.getBookmarks(0, 0, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("실패 - limit이 100 초과이면 INVALID_INPUT 예외를 던진다")
    void rejectsLimitExceedingMax() {
        assertThatThrownBy(() -> controller.getBookmarks(0, 101, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }
}
