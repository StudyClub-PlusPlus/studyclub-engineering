package com.studyclub.api.timezone;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminDisplayTimeZoneServiceTest {

    private final AccountRepository accounts = mock(AccountRepository.class);
    private final AdminDisplayTimeZoneService service = new AdminDisplayTimeZoneService(accounts);

    @Test
    @DisplayName("헤더 저장은 계정 행을 잠가 읽는다 — 프로필 수정과 줄 세워 서로의 칸을 옛 값으로 덮지 않는다")
    void changeLocksAccountRow() {
        Account account = new Account("lock@example.com", "lock_admin", null, SystemRole.ADMIN);
        account.completeOnboarding("lock_admin", "Asia/Seoul", Instant.now());
        when(accounts.findByIdForUpdate(1L)).thenReturn(Optional.of(account));

        var response = service.change(1L, new AdminDisplayTimeZoneRequest("America/Toronto"));

        verify(accounts).findByIdForUpdate(1L);
        verify(accounts, never()).findById(1L);
        assertThat(response.timeZone()).isEqualTo("America/Toronto");
        assertThat(account.getTimeZone()).isEqualTo("Asia/Seoul");
    }
}
