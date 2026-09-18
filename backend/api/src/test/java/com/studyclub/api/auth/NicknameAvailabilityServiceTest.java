package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class NicknameAvailabilityServiceTest {

    private final AccountRepository accounts = mock(AccountRepository.class);
    private final NicknameAvailabilityService service = new NicknameAvailabilityService(accounts);

    @Test
    @DisplayName("공백 제거 후 원래 대소문자로 DB 비교에 넘긴다 — 가입 완료와 같은 기준")
    void trimsBeforeCheckingAvailability() {
        when(accounts.existsByNicknameIgnoreCase("Journey")).thenReturn(false);

        assertThat(service.isAvailable("  Journey  ")).isTrue();

        verify(accounts).existsByNicknameIgnoreCase("Journey");
    }

    @Test
    @DisplayName("이미 사용 중인 유효한 닉네임은 오류 대신 사용 불가로 반환한다")
    void returnsFalseForTakenNickname() {
        when(accounts.existsByNicknameIgnoreCase("Journey")).thenReturn(true);

        assertThat(service.isAvailable("Journey")).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(
            strings = {
                " ",
                "a",
                "abcdefghijklmnopqrstu",
                "홍 길동",
                "name!",
                "😀",
                "__",
                "ADMIN",
                "account_crew"
            })
    @DisplayName("형식이 잘못된 값은 DB 조회 전에 거절한다 — 중복과 형식 오류를 구분한다")
    void rejectsInvalidInputBeforeQuerying(String value) {
        assertThatThrownBy(() -> service.isAvailable(value))
                .isInstanceOfSatisfying(
                        BusinessException.class,
                        error -> {
                            assertThat(error.errorCode()).isEqualTo(ErrorCode.INVALID_INPUT);
                            assertThat(error.getMessage()).startsWith("value: ");
                        });

        verifyNoInteractions(accounts);
    }
}
