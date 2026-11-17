package com.studyclub.api.analytics;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.studyclub.api.cleanup.CleanupResult;
import com.studyclub.domain.analytics.AccountAnalyticsRepository;
import java.time.Instant;
import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AnalyticsDeletionCleanupTest {
    @Test
    @DisplayName("앞쪽 100건이 실패해도 뒤쪽 회원의 삭제를 계속 진행한다")
    void noStarvation() {
        var profiles = mock(AccountAnalyticsRepository.class);
        var worker = mock(AnalyticsDeletionWorker.class);
        Instant now = Instant.now();
        when(profiles.findDeletionCandidates(eq(0L), any()))
                .thenReturn(LongStream.rangeClosed(1, 100).boxed().toList());
        when(profiles.findDeletionCandidates(eq(100L), any())).thenReturn(List.of(101L));
        when(profiles.findDeletionCandidates(eq(101L), any())).thenReturn(List.of());
        when(worker.process(anyLong(), eq(now))).thenThrow(new IllegalStateException("test"));
        doReturn(CleanupResult.completed(1, 0)).when(worker).process(101L, now);
        var result = new AnalyticsDeletionCleanup(profiles, worker).cleanUp(now);
        assertThat(result.deleted()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(100);
        verify(worker).process(101L, now);
    }
}
