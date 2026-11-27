package com.studyclub.api.timezone;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

class MemberTimeZoneCandidateServiceTest {

    private final AccountRepository accounts = mock(AccountRepository.class);
    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-24T12:00:00Z"));
    private final MemberTimeZoneCandidateService service =
            new MemberTimeZoneCandidateService(accounts, clock);

    @Test
    @DisplayName("집계: 무효 값은 빼고 deprecated 링크는 정본과 합친다. 인원 내림차순 · 동률 IANA 오름차순")
    void aggregates() {
        when(accounts.countOnboardedByTimeZone())
                .thenReturn(
                        List.of(
                                new Object[] {"Asia/Seoul", 3L},
                                new Object[] {"US/Pacific", 1L},
                                new Object[] {"America/Los_Angeles", 2L},
                                new Object[] {"America/Toronto", 3L},
                                new Object[] {"+09:00", 9L}));

        var response = service.candidates();

        assertThat(response.asOf()).isEqualTo(clock.instant());
        assertThat(response.items())
                .containsExactly(
                        new MemberTimeZoneCandidatesResponse.Item("America/Los_Angeles", 3),
                        new MemberTimeZoneCandidatesResponse.Item("America/Toronto", 3),
                        new MemberTimeZoneCandidatesResponse.Item("Asia/Seoul", 3));
    }

    @Test
    @DisplayName("캐시: 60초 안에는 같은 집계 시점을 주고, 60초가 지나거나 무효화되면 다시 센다")
    void cachesForSixtySeconds() {
        when(accounts.countOnboardedByTimeZone()).thenReturn(List.<Object[]>of());

        Instant first = service.candidates().asOf();
        clock.advance(Duration.ofSeconds(59));
        assertThat(service.candidates().asOf()).isEqualTo(first);
        verify(accounts, times(1)).countOnboardedByTimeZone();

        clock.advance(Duration.ofSeconds(1));
        assertThat(service.candidates().asOf()).isAfter(first);
        verify(accounts, times(2)).countOnboardedByTimeZone();

        service.invalidate();
        service.candidates();
        verify(accounts, times(3)).countOnboardedByTimeZone();
    }

    @Test
    @DisplayName("캐시: 집계하는 도중에 무효화가 오면 그 결과는 다음 요청에 쓰지 않고 다시 센다")
    void invalidationDuringAggregationIsNotCached() {
        when(accounts.countOnboardedByTimeZone())
                .thenAnswer(
                        call -> {
                            service.invalidate();
                            return List.<Object[]>of();
                        })
                .thenReturn(List.<Object[]>of());

        service.candidates();
        service.candidates();

        verify(accounts, times(2)).countOnboardedByTimeZone();
    }

    @Test
    @DisplayName("조회 실패는 빈 집계가 아니라 503 TIME_ZONE_CANDIDATES_UNAVAILABLE. 다음 요청은 다시 시도한다")
    void failureIs503() {
        when(accounts.countOnboardedByTimeZone())
                .thenThrow(new DataAccessResourceFailureException("db down"))
                .thenReturn(List.<Object[]>of(new Object[] {"Asia/Seoul", 1L}));

        assertThatThrownBy(service::candidates)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(ErrorCode.TIME_ZONE_CANDIDATES_UNAVAILABLE);
        assertThat(ErrorCode.TIME_ZONE_CANDIDATES_UNAVAILABLE.status()).isEqualTo(503);
        assertThat(service.candidates().items()).hasSize(1);
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
