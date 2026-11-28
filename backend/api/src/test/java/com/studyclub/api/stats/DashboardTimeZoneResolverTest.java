package com.studyclub.api.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.api.timezone.DisplayTimeZoneResolver;
import com.studyclub.common.error.BusinessException;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataAccessResourceFailureException;

/** 대시보드 집계 시간대 — 헤더(Query) → 저장된 헤더 → 프로필 → 서울 (specs/dashboard/spec.md §2.2.1). */
class DashboardTimeZoneResolverTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final Account account = mock(Account.class);
    private final DashboardTimeZoneResolver resolver =
            new DashboardTimeZoneResolver(new DisplayTimeZoneResolver(accounts));

    private void account(String header, String profile) {
        when(accounts.findById(1L)).thenReturn(Optional.of(account));
        when(account.getAdminDisplayTimeZone()).thenReturn(header);
        when(account.getTimeZone()).thenReturn(profile);
    }

    @Test
    @DisplayName("유효한 Query(헤더)는 프로필 · 저장된 헤더로 덮어쓰지 않는다")
    void queryWinsOverProfileAndStoredHeader() {
        account("Europe/London", "Asia/Seoul");
        assertThat(resolver.resolve("America/Toronto", 1L)).isEqualTo(ZoneId.of("America/Toronto"));
    }

    @Test
    @DisplayName("Query 가 없으면 저장된 헤더 → 프로필 → 서울. 요청마다 계정을 다시 읽는다")
    void fallbackOrder() {
        account("Europe/London", "Asia/Seoul");
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("Europe/London"));
        account(null, "America/Los_Angeles");
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("America/Los_Angeles"));
        account(null, null);
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("Asia/Seoul"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "Not/AZone", "+09:00"})
    @DisplayName("저장값이 비었거나 무효면 다음 순서로 넘어간다")
    void invalidStoredValuesFallThrough(String stored) {
        account(stored, stored);
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("Asia/Seoul"));
    }

    @Test
    @DisplayName("계정이 없으면 Query → 서울. UTC 는 받는다")
    void missingAccount() {
        when(accounts.findById(1L)).thenReturn(Optional.empty());
        assertThat(resolver.resolve("UTC", 1L)).isEqualTo(ZoneId.of("UTC"));
        assertThat(resolver.resolve(null, 1L)).isEqualTo(ZoneId.of("Asia/Seoul"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "Not/AZone", "+09:00", "GMT+9"})
    @DisplayName("명시한 Query 가 빈 값 · 무효 · 오프셋이면 프로필이 있어도 400")
    void explicitInvalidQueryFails(String query) {
        account(null, "Asia/Seoul");
        assertThatThrownBy(() -> resolver.resolve(query, 1L)).isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("계정 조회 실패는 Query 가 없을 때 서울로 대체하지 않고 전파한다")
    void accountLookupFailurePropagates() {
        var failure = new DataAccessResourceFailureException("profile unavailable");
        when(accounts.findById(1L)).thenThrow(failure);
        assertThatThrownBy(() -> resolver.resolve(null, 1L)).isSameAs(failure);
    }
}
