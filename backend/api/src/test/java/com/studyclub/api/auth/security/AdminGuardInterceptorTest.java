package com.studyclub.api.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;

class AdminGuardInterceptorTest {
    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private final AdminGuardInterceptor adminGuardInterceptor =
            new AdminGuardInterceptor(accountRepository);

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("애너테이션 없는 핸들러는 통과한다 — 기존 API에 관리자 권한을 강제하지 않는다")
    void bypassesUnprotectedHandler() throws Exception {
        assertThat(
                        adminGuardInterceptor.preHandle(
                                null,
                                null,
                                new HandlerMethod(
                                        new Handler(), Handler.class.getMethod("publicEndpoint"))))
                .isTrue();
        assertThat(adminGuardInterceptor.preHandle(null, null, new Object())).isTrue();
        verifyNoInteractions(accountRepository);
    }

    @Test
    @DisplayName("메서드의 RequireAdmin 도 적용한다 — 클래스 수준 가드와 같은 계약")
    void protectsMethodAnnotation() throws Exception {
        HandlerMethod handlerMethod =
                new HandlerMethod(new Handler(), Handler.class.getMethod("adminEndpoint"));
        assertThatThrownBy(() -> adminGuardInterceptor.preHandle(null, null, handlerMethod))
                .isInstanceOf(BusinessException.class);
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken("admin@example.com", null));
        when(accountRepository.findByEmail("admin@example.com"))
                .thenReturn(
                        Optional.of(
                                new Account("admin@example.com", "홍길동", null, SystemRole.ADMIN)));
        assertThat(adminGuardInterceptor.preHandle(null, null, handlerMethod)).isTrue();
    }

    static class Handler {
        public void publicEndpoint() {}

        @RequireAdmin
        public void adminEndpoint() {}
    }
}
