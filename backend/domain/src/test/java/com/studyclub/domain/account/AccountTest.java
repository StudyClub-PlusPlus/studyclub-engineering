package com.studyclub.domain.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AccountTest {

    @Test
    @DisplayName("디스코드 서버 별명은 1~100자만 계정에 남긴다")
    void changesOnlyValidDiscordNickname() {
        Account account = new Account("account@example.com", "닉네임", null, SystemRole.MEMBER);

        account.changeDiscordNickname("가".repeat(100));

        assertThat(account.getDiscordNickname()).isEqualTo("가".repeat(100));
        assertThatThrownBy(() -> account.changeDiscordNickname("가".repeat(101)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> account.changeDiscordNickname("   "))
                .isInstanceOf(BusinessException.class);
    }
}
