package com.studyclub.api.bookmark;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

class StudyBookmarkControllerTest {

    private StudyBookmarkService service;
    private StudyBookmarkController controller;
    private Authentication auth;

    @BeforeEach
    void setUp() {
        service = mock(StudyBookmarkService.class);
        controller = new StudyBookmarkController(service);

        var token = new UsernamePasswordAuthenticationToken("user@example.com", null, List.of());
        token.setDetails("100");
        auth = token;

        when(service.getStudyBookmarks(anyLong(), anyInt(), anyInt()))
                .thenReturn(new StudyBookmarkService.Result(
                        new StudyBookmarkResponse(List.of(), 0, 0, 20), HttpStatus.OK));
    }

    @Test
    @DisplayName("실패 - offset이 음수이면 INVALID_INPUT 예외를 던진다")
    void rejectsNegativeOffset() {
        assertThatThrownBy(() -> controller.getBookmarks(-1, 20, auth))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).errorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("실패 - limit이 0이면 INVALID_INPUT 예외를 던진다")
    void rejectsZeroLimit() {
        assertThatThrownBy(() -> controller.getBookmarks(0, 0, auth))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).errorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("실패 - limit이 100 초과이면 INVALID_INPUT 예외를 던진다")
    void rejectsLimitExceedingMax() {
        assertThatThrownBy(() -> controller.getBookmarks(0, 101, auth))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).errorCode())
                        .isEqualTo(ErrorCode.INVALID_INPUT));
    }
}
