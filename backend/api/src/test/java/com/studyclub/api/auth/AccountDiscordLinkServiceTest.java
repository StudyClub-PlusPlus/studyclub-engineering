package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.api.auth.DiscordOAuthClient.DiscordUser;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import java.util.Optional;
import java.util.function.Consumer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

/** 언제 저장하고 언제 안 하는지. 디스코드 HTTP 는 {@link DiscordOAuthClientTest} 가 본다. */
@ExtendWith(MockitoExtension.class)
class AccountDiscordLinkServiceTest {

    private static final Long ACCOUNT_ID = 1L;
    private static final DiscordUser USER = new DiscordUser("1327394882193880001", "jiwon_dev");

    @Mock DiscordOAuthClient discordOAuthClient;
    @Mock AccountRepository accountRepository;
    @Mock TransactionTemplate transactionTemplate;

    @InjectMocks AccountDiscordLinkService service;

    private void runTransactions() {
        doAnswer(
                        inv -> {
                            inv.<Consumer<TransactionStatus>>getArgument(0).accept(null);
                            return null;
                        })
                .when(transactionTemplate)
                .executeWithoutResult(any());
    }

    private Account givenAccount() {
        Account account = mock(Account.class);
        when(accountRepository.findByIdForUpdate(ACCOUNT_ID)).thenReturn(Optional.of(account));
        return account;
    }

    private static Account otherAccount(Long id) {
        Account other = mock(Account.class);
        when(other.getId()).thenReturn(id);
        return other;
    }

    @Test
    @DisplayName("디스코드에서_받은_ID_와_핸들을_저장한다")
    void 디스코드에서_받은_ID_와_핸들을_저장한다() {
        when(discordOAuthClient.exchange("code")).thenReturn(USER);
        runTransactions();
        Account account = givenAccount();
        when(accountRepository.findByDiscordId(USER.id())).thenReturn(Optional.empty());

        service.link(ACCOUNT_ID, "code");

        verify(account).linkDiscord(USER.id(), USER.handle());
        verify(accountRepository).saveAndFlush(account);
    }

    @Test
    @DisplayName("같은_계정이_같은_ID_로_다시_연동하면_성공한다")
    void 같은_계정이_같은_ID_로_다시_연동하면_성공한다() {
        when(discordOAuthClient.exchange("code")).thenReturn(USER);
        runTransactions();
        Account account = givenAccount();
        Account self = otherAccount(ACCOUNT_ID);
        when(accountRepository.findByDiscordId(USER.id())).thenReturn(Optional.of(self));

        assertThatCode(() -> service.link(ACCOUNT_ID, "code")).doesNotThrowAnyException();
        verify(account).linkDiscord(USER.id(), USER.handle());
    }

    @Test
    @DisplayName("다른_계정이_그_ID_를_쓰면_409_이고_저장하지_않는다")
    void 다른_계정이_그_ID_를_쓰면_409_이고_저장하지_않는다() {
        when(discordOAuthClient.exchange("code")).thenReturn(USER);
        runTransactions();
        Account account = givenAccount();
        Account other = otherAccount(2L);
        when(accountRepository.findByDiscordId(USER.id())).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.link(ACCOUNT_ID, "code"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONFLICT);
        verify(account, never()).linkDiscord(any(), any());
        verify(accountRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("길드_멤버가_아니면_트랜잭션을_열지_않는다")
    void 길드_멤버가_아니면_트랜잭션을_열지_않는다() {
        when(discordOAuthClient.exchange("code"))
                .thenThrow(new BusinessException(ErrorCode.FORBIDDEN));

        assertThatThrownBy(() -> service.link(ACCOUNT_ID, "code"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
        verify(transactionTemplate, never()).executeWithoutResult(any());
    }

    @Test
    @DisplayName("디스코드가_실패하면_트랜잭션을_열지_않는다")
    void 디스코드가_실패하면_트랜잭션을_열지_않는다() {
        when(discordOAuthClient.exchange("code"))
                .thenThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR));

        assertThatThrownBy(() -> service.link(ACCOUNT_ID, "code"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR);
        verify(transactionTemplate, never()).executeWithoutResult(any());
    }
}
