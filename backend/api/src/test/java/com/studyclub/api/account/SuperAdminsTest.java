package com.studyclub.api.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SuperAdminsTest {

    private final AccountRepository accountRepository = mock(AccountRepository.class);

    @Test
    @DisplayName("env 읽기 — 콤마 목록 · trim · 소문자 · 빈 칸 · 중복 제거, 비면 최고 관리자 없음")
    void parsesEmailList() {
        assertThat(SuperAdmins.parse(" A@example.com, ,b@example.com,a@EXAMPLE.com "))
                .containsExactly("a@example.com", "b@example.com");
        assertThat(SuperAdmins.parse(null)).isEmpty();
        assertThat(new SuperAdmins(accountRepository, "").isConfigured()).isFalse();
    }

    @Test
    @DisplayName("판정은 계정 이메일 — 대소문자를 가리지 않는다")
    void includesByEmail() {
        SuperAdmins superAdmins = new SuperAdmins(accountRepository, "boss@example.com");
        assertThat(
                        superAdmins.includes(
                                new Account("Boss@Example.com", "b", null, SystemRole.MEMBER)))
                .isTrue();
        assertThat(
                        superAdmins.includes(
                                new Account("crew@example.com", "c", null, SystemRole.ADMIN)))
                .isFalse();
        assertThat(superAdmins.includes(null)).isFalse();
    }

    @Test
    @DisplayName("부팅 동기화 — 목록의 크루는 캡틴으로 올리고, 없는 계정은 건너뛴다")
    void promotesListedAccountsOnBoot() {
        Account crew = new Account("boss@example.com", "b", null, SystemRole.MEMBER);
        when(accountRepository.findByEmail("boss@example.com")).thenReturn(Optional.of(crew));
        when(accountRepository.findByEmail("later@example.com")).thenReturn(Optional.empty());

        new SuperAdmins(accountRepository, "boss@example.com,later@example.com").syncOnBoot();

        assertThat(crew.getSystemRole()).isEqualTo(SystemRole.ADMIN);
    }

    @Test
    @DisplayName("부팅 동기화 — 목록이 비면 아무것도 읽지 않는다")
    void emptyListTouchesNothing() {
        new SuperAdmins(accountRepository, "").syncOnBoot();
        verify(accountRepository, never()).findByEmail(anyString());
    }
}
