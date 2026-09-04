package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.error.ErrorResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 에러 계약의 세부. 통합 테스트가 "한 모양으로 나온다"를 지킨다면, 여기서는
 * <b>매핑 규칙 자체</b>를 지킨다 — 특히 모르는 상태가 들어왔을 때 조용히 500 이 되지 않는 것.
 */
class ErrorCodeTest {

    @Test
    @DisplayName("아는 상태 코드는 그대로 되돌린다")
    void mapsKnownStatus() {
        assertThat(ErrorCode.fromStatus(404)).isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(ErrorCode.fromStatus(409)).isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    @DisplayName("모르는 4xx 는 INVALID_INPUT — 클라이언트 잘못을 서버 오류로 보고하지 않는다")
    void unknownClientErrorIsNotServerError() {
        assertThat(ErrorCode.fromStatus(418)).isEqualTo(ErrorCode.INVALID_INPUT);
        assertThat(ErrorCode.fromStatus(429)).isEqualTo(ErrorCode.INVALID_INPUT);
    }

    @Test
    @DisplayName("모르는 5xx 는 INTERNAL_ERROR")
    void unknownServerError() {
        assertThat(ErrorCode.fromStatus(502)).isEqualTo(ErrorCode.INTERNAL_ERROR);
    }

    @Test
    @DisplayName("메시지가 비면 기본 문구로 채운다 — errorMessage 가 null 인 응답은 만들지 않는다")
    void blankMessageFallsBackToDefault() {
        assertThat(ErrorResponse.of(ErrorCode.NOT_FOUND, null).errorMessage())
                .isEqualTo(ErrorCode.NOT_FOUND.defaultMessage());
        assertThat(ErrorResponse.of(ErrorCode.NOT_FOUND, "  ").errorMessage())
                .isEqualTo(ErrorCode.NOT_FOUND.defaultMessage());
    }

    @Test
    @DisplayName("errorCode 는 enum 이름 그대로 — 프론트가 이 문자열로 분기한다")
    void codeIsEnumName() {
        assertThat(ErrorResponse.of(ErrorCode.UNAUTHORIZED).errorCode()).isEqualTo("UNAUTHORIZED");
    }
}
