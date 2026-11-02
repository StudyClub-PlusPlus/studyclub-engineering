package com.studyclub.api.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataAccessResourceFailureException;

class DashboardTimeZoneResolverTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final Account account = mock(Account.class);
    private final DashboardTimeZoneResolver resolver = new DashboardTimeZoneResolver(accounts);

    private void profile(String zone) {
        when(accounts.findById(1L)).thenReturn(Optional.of(account));
        when(account.getTimeZone()).thenReturn(zone);
    }

    @Test
    void currentProfileWinsOverBrowserAndIsReadAgainOnNextRequest() {
        profile("Asia/Seoul");
        assertThat(resolver.resolve("America/Toronto", 1L)).isEqualTo(ZoneId.of("Asia/Seoul"));
        profile("America/Los_Angeles");
        assertThat(resolver.resolve("America/Toronto", 1L))
                .isEqualTo(ZoneId.of("America/Los_Angeles"));
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("America/Los_Angeles"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "Not/AZone"})
    void missingOrInvalidProfileUsesBrowserThenSeoul(String profileZone) {
        profile(profileZone);
        assertThat(resolver.resolve("America/Toronto", 1L)).isEqualTo(ZoneId.of("America/Toronto"));
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("Asia/Seoul"));
    }

    @Test
    void missingAccountUsesBrowserThenSeoul() {
        when(accounts.findById(1L)).thenReturn(Optional.empty());
        assertThat(resolver.resolve("UTC", 1L)).isEqualTo(ZoneId.of("UTC"));
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("Asia/Seoul"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "Not/AZone"})
    void explicitInvalidQueryStillFailsEvenWithValidProfile(String browserZone) {
        profile("Asia/Seoul");
        assertThatThrownBy(() -> resolver.resolve(browserZone, 1L))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void profileLookupFailureDoesNotFallBackToBrowser() {
        var failure = new DataAccessResourceFailureException("profile unavailable");
        when(accounts.findById(1L)).thenThrow(failure);
        assertThatThrownBy(() -> resolver.resolve("America/Toronto", 1L)).isSameAs(failure);
        assertThatThrownBy(() -> resolver.resolve(null, 1L)).isSameAs(failure);
    }
}
