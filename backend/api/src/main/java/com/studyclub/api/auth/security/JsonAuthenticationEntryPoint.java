package com.studyclub.api.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.error.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;

/**
 * 미인증 요청의 401 도 {@link ErrorResponse} 모양으로 내보낸다.
 *
 * <p>시큐리티 필터는 {@code @RestControllerAdvice} 보다 앞에서 응답을 끝내므로
 * {@code GlobalExceptionHandler} 가 못 잡는다. 여기서 같은 모양을 직접 써 주지 않으면
 * <b>인증 실패만 빈 바디</b>가 되어 프론트가 이 경로만 따로 처리하게 된다.
 */
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper mapper;

    public JsonAuthenticationEntryPoint(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
            throws IOException {
        response.setStatus(ErrorCode.UNAUTHORIZED.status());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getWriter(), ErrorResponse.of(ErrorCode.UNAUTHORIZED));
    }
}
