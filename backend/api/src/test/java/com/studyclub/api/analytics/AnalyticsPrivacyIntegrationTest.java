package com.studyclub.api.analytics;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.studyclub.api.auth.*;
import com.studyclub.domain.account.*;
import com.studyclub.domain.analytics.*;
import com.studyclub.domain.audit.*;
import com.studyclub.domain.feedback.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:analyticsPrivacy;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "analytics.hmac-key=analytics-test-key-not-for-production-0123456789"
        })
@org.springframework.context.annotation.Import(AnalyticsPrivacyIntegrationTest.ListenerConfig.class)
@AutoConfigureTestRestTemplate
class AnalyticsPrivacyIntegrationTest {
    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accounts;
    @Autowired AccountAnalyticsRepository profiles;
    @Autowired org.springframework.scheduling.TaskScheduler initialScheduler;
    @Autowired AnalyticsPrivacyService privacy;
    @Autowired FeedbackRepository feedbacks;
    @Autowired AdminAuditLogRepository audits;
    @Autowired AccountDeletionService deletion;
    @Autowired AnalyticsDeletionWorker worker;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean AnalyticsDeletionGateway gateway;

    @BeforeEach
    void setup() {
        reset(initialScheduler);
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    Account account(SystemRole role) {
        String suffix = UUID.randomUUID().toString().substring(0, 12);
        return accounts.save(new Account(suffix + "@example.test", suffix, null, role));
    }

    HttpEntity<?> request(Account actor, Object body) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(jwt.issueAccess(String.valueOf(actor.getId()), actor.getEmail()));
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    Feedback inquiry(Account a) {
        return feedbacks.save(
                new Feedback(
                        a.getId(),
                        FeedbackType.QUESTION,
                        "분석 중단 요청",
                        "GA4와 Amplitude 분석 중단을 요청합니다.",
                        "test",
                        null,
                        null));
    }

    @Test
    @DisplayName("ID는 한 번 저장되고 브라우저 식별자는 중복 등록되지 않는다")
    void identityAndBrowsers() {
        Account a = account(SystemRole.MEMBER);
        var first = privacy.current(a.getId());
        assertThat(first.userId()).matches("v1_[0-9a-f]{64}");
        assertThat(privacy.current(a.getId())).isEqualTo(first);
        privacy.registerBrowser(a.getId(), "123.456");
        privacy.registerBrowser(a.getId(), "123.456");
        assertThat(profiles.findById(a.getId()).orElseThrow().clientIds())
                .containsExactly("123.456");
        assertThat(
                        rest.exchange(
                                        "/api/me/analytics/browser",
                                        HttpMethod.POST,
                                        request(a, Map.of("clientId", "bad")),
                                        Map.class)
                                .getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("관리자만 문의 작성자를 중단한다 — 반복 요청은 작업과 감사 기록을 늘리지 않는다")
    void adminOptOut() {
        Account member = account(SystemRole.MEMBER), admin = account(SystemRole.ADMIN);
        Feedback f = inquiry(member);
        privacy.current(member.getId());
        String endpoint = "/api/admin/feedbacks/" + f.getId() + "/analytics-opt-out";
        assertThat(rest.getForEntity("/api/me/analytics", Map.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(
                        rest.exchange(endpoint, HttpMethod.POST, request(member, null), Map.class)
                                .getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        long auditBefore = audits.count();
        var response = rest.exchange(endpoint, HttpMethod.POST, request(admin, null), Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("enabled", false);
        rest.exchange(endpoint, HttpMethod.POST, request(admin, null), Map.class);
        Instant stoppedAt = profiles.findById(member.getId()).orElseThrow().getOptedOutAt();
        assertThat(stoppedAt).isNotNull();
        assertThat(response.getBody())
                .doesNotContainKeys("userId", "analyticsUserId", "gaClientIds");
        var detail =
                rest.exchange(
                        "/api/admin/feedbacks/" + f.getId(),
                        HttpMethod.GET,
                        request(admin, null),
                        Map.class);
        assertThat(((Map<?, ?>) detail.getBody().get("analytics")).get("canOptOut"))
                .isEqualTo(false);
        assertThat(feedbacks.findById(f.getId()).orElseThrow().getContent())
                .isEqualTo(f.getContent());
        assertThat(audits.count()).isEqualTo(auditBefore + 1);
        AtomicBoolean sent = new AtomicBoolean();
        privacy.whenAllowed(member.getId(), null, id -> sent.set(true));
        assertThat(sent).isFalse();
        assertThat(
                        rest.exchange(
                                        "/api/admin/feedbacks/99999999/analytics-opt-out",
                                        HttpMethod.POST,
                                        request(admin, null),
                                        Map.class)
                                .getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("탈퇴 뒤에도 삭제 식별자는 남고 트랜잭션 롤백 시 중단도 취소된다")
    void withdrawalKeepsProfile() {
        Account a = account(SystemRole.MEMBER);
        String id = privacy.current(a.getId()).userId();
        privacy.registerBrowser(a.getId(), "100.200");
        new TransactionTemplate(transactions)
                .executeWithoutResult(
                        tx -> {
                            privacy.onAccountDeletion(a.getId());
                            tx.setRollbackOnly();
                        });
        assertThat(profiles.findById(a.getId()).orElseThrow().getOptedOutAt()).isNull();
        deletion.deleteAccount(a.getId(), LeaveReason.OTHER);
        assertThat(accounts.existsById(a.getId())).isFalse();
        assertThat(profiles.findById(a.getId()).orElseThrow().getAnalyticsUserId()).isEqualTo(id);
        AtomicBoolean sent = new AtomicBoolean();
        privacy.whenAllowed(a.getId(), null, ignored -> sent.set(true));
        assertThat(sent).isFalse();
    }

    @Test
    @DisplayName("한 서비스의 실패는 다른 서비스 접수를 막지 않고 외부 호출은 DB 트랜잭션 밖에서 실행한다")
    void retryAndCompletion() {
        Account a = account(SystemRole.MEMBER), admin = account(SystemRole.ADMIN);
        String id = privacy.current(a.getId()).userId();
        privacy.registerBrowser(a.getId(), "100.200");
        privacy.optOut(admin.getId(), inquiry(a).getId());
        Instant ready = profiles.findById(a.getId()).orElseThrow().deletionReadyAt();
        doAnswer(
                        inv -> {
                            assertThat(
                                            org.springframework.transaction.support
                                                    .TransactionSynchronizationManager
                                                    .isActualTransactionActive())
                                    .isFalse();
                            throw new IllegalStateException("DELETION_NOT_CONFIGURED");
                        })
                .doNothing()
                .when(gateway)
                .submitGa4(eq(id), anyList());
        when(gateway.submitAmplitude(id))
                .thenAnswer(
                        inv -> {
                            assertThat(
                                            org.springframework.transaction.support
                                                    .TransactionSynchronizationManager
                                                    .isActualTransactionActive())
                                    .isFalse();
                            return Optional.of("[123]");
                        });
        worker.process(a.getId(), ready.minusSeconds(1));
        verifyNoInteractions(gateway);
        assertThat(worker.process(a.getId(), ready).failed()).isEqualTo(1);
        var p = profiles.findById(a.getId()).orElseThrow();
        assertThat(p.getGa4DeletionStatus()).isEqualTo(AnalyticsDeletionStatus.NOT_REQUESTED);
        assertThat(p.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.REQUESTED);
        when(gateway.amplitudeDone(eq("[123]"), any())).thenReturn(false);
        worker.process(a.getId(), ready.plusSeconds(86400));
        p = profiles.findById(a.getId()).orElseThrow();
        assertThat(p.getGa4DeletionStatus()).isEqualTo(AnalyticsDeletionStatus.REQUESTED);
        assertThat(p.getAnalyticsUserId()).isEqualTo(id);
        when(gateway.amplitudeDone(eq("[123]"), any())).thenReturn(true);
        worker.process(a.getId(), ready.plusSeconds(172800));
        p = profiles.findById(a.getId()).orElseThrow();
        assertThat(p.getAnalyticsUserId()).isNull();
        assertThat(p.clientIds()).isEmpty();
        assertThat(p.getGa4DeletionStatus()).isEqualTo(AnalyticsDeletionStatus.REQUESTED);
        assertThat(p.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.DONE);
        assertThat(p.getOptedOutAt()).isNotNull();
        assertThat(privacy.current(a.getId()).enabled()).isFalse();
        assertThat(privacy.current(a.getId()).userId()).isNull();
        verify(gateway, times(1)).submitAmplitude(id);
        verify(gateway, times(2))
                .submitGa4(id, List.of("100.200", AnalyticsIdentity.serverClientId(id)));
    }

    @Test
    @DisplayName("탈퇴 회원의 처리 행은 GA 접수와 Amplitude 완료 후 자동으로 제거된다")
    void withdrawnProfileRemoved() {
        Account a = account(SystemRole.MEMBER);
        String id = privacy.current(a.getId()).userId();
        deletion.deleteAccount(a.getId(), LeaveReason.OTHER);
        Instant ready = profiles.findById(a.getId()).orElseThrow().deletionReadyAt();
        when(gateway.submitAmplitude(id)).thenReturn(Optional.of("[456]"));
        worker.process(a.getId(), ready);
        assertThat(profiles.existsById(a.getId())).isTrue();
        when(gateway.amplitudeDone(eq("[456]"), any())).thenReturn(true);
        worker.process(a.getId(), ready.plusSeconds(86400));
        assertThat(profiles.existsById(a.getId())).isFalse();
    }

    @Test
    @DisplayName("Amplitude 기록이 없는 탈퇴 회원도 24시간 뒤 재확인하면 자동 정리한다")
    void withdrawnWithoutAmplitudeData() {
        Account a = account(SystemRole.MEMBER);
        String id = privacy.current(a.getId()).userId();
        deletion.deleteAccount(a.getId(), LeaveReason.OTHER);
        Instant ready = profiles.findById(a.getId()).orElseThrow().deletionReadyAt();
        when(gateway.submitAmplitude(id)).thenReturn(Optional.empty());
        assertThat(worker.process(a.getId(), ready).failed()).isZero();
        var p = profiles.findById(a.getId()).orElseThrow();
        Instant firstAbsence = p.getAmplitudeDeletionRequestedAt();
        assertThat(p.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.NOT_REQUESTED);
        assertThat(p.getAnalyticsUserId()).isEqualTo(id);
        worker.process(a.getId(), firstAbsence.plusSeconds(86399));
        assertThat(profiles.existsById(a.getId())).isTrue();
        worker.process(a.getId(), firstAbsence.plusSeconds(86400));
        assertThat(profiles.existsById(a.getId())).isFalse();
        verify(gateway, times(3)).submitAmplitude(id);
        verify(gateway, never()).amplitudeDone(any(), any());
    }

    @Test
    @DisplayName("대상 없음 재확인 중 오류는 완료가 아니며 늦게 발견된 데이터는 정상 삭제한다")
    void absentThenFailureThenData() {
        Account a = account(SystemRole.MEMBER);
        String id = privacy.current(a.getId()).userId();
        deletion.deleteAccount(a.getId(), LeaveReason.OTHER);
        Instant ready = profiles.findById(a.getId()).orElseThrow().deletionReadyAt();
        when(gateway.submitAmplitude(id))
                .thenReturn(Optional.empty())
                .thenThrow(new IllegalStateException("DELETION_NOT_CONFIGURED"))
                .thenReturn(Optional.of("[789]"));
        worker.process(a.getId(), ready);
        Instant firstAbsence =
                profiles.findById(a.getId()).orElseThrow().getAmplitudeDeletionRequestedAt();
        assertThat(worker.process(a.getId(), firstAbsence.plusSeconds(86400)).failed())
                .isEqualTo(1);
        assertThat(profiles.findById(a.getId()).orElseThrow().getAmplitudeDeletionStatus())
                .isEqualTo(AnalyticsDeletionStatus.NOT_REQUESTED);
        Instant submittedAt = firstAbsence.plusSeconds(172800);
        worker.process(a.getId(), submittedAt);
        var p = profiles.findById(a.getId()).orElseThrow();
        assertThat(p.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.REQUESTED);
        assertThat(p.getAmplitudeDeletionRequestedAt()).isEqualTo(submittedAt);
        when(gateway.amplitudeDone("[789]", submittedAt)).thenReturn(true);
        worker.process(a.getId(), submittedAt.plusSeconds(86400));
        assertThat(profiles.existsById(a.getId())).isFalse();
    }

    @Test
    @DisplayName("대상 없는 중단 회원은 GA 접수까지 기다리고 식별자만 비워 거부를 유지한다")
    void absentOptedOutMemberWaitsForGa4() {
        Account a = account(SystemRole.MEMBER), admin = account(SystemRole.ADMIN);
        String id = privacy.current(a.getId()).userId();
        privacy.optOut(admin.getId(), inquiry(a).getId());
        Instant ready = profiles.findById(a.getId()).orElseThrow().deletionReadyAt();
        when(gateway.submitAmplitude(id)).thenReturn(Optional.empty());
        doThrow(new IllegalStateException("DELETION_NOT_CONFIGURED"))
                .doThrow(new IllegalStateException("DELETION_NOT_CONFIGURED"))
                .doNothing()
                .when(gateway)
                .submitGa4(eq(id), anyList());
        worker.process(a.getId(), ready);
        Instant firstAbsence =
                profiles.findById(a.getId()).orElseThrow().getAmplitudeDeletionRequestedAt();
        worker.process(a.getId(), firstAbsence.plusSeconds(86400));
        var waiting = profiles.findById(a.getId()).orElseThrow();
        assertThat(waiting.getAmplitudeDeletionStatus()).isEqualTo(AnalyticsDeletionStatus.DONE);
        assertThat(waiting.getAnalyticsUserId()).isEqualTo(id);
        worker.process(a.getId(), firstAbsence.plusSeconds(172800));
        assertThat(accounts.existsById(a.getId())).isTrue();
        var completed = profiles.findById(a.getId()).orElseThrow();
        assertThat(completed.getAnalyticsUserId()).isNull();
        assertThat(completed.getOptedOutAt()).isNotNull();
        assertThat(privacy.current(a.getId()).enabled()).isFalse();
        verify(gateway, times(2)).submitAmplitude(id);
    }

    @Test
    @DisplayName("삭제 대상 조회는 정상 회원을 제외하고 중단·탈퇴 회원을 포함한다")
    void cleanupCandidates() {
        Account normal = account(SystemRole.MEMBER),
                stopped = account(SystemRole.MEMBER),
                left = account(SystemRole.MEMBER),
                admin = account(SystemRole.ADMIN);
        privacy.current(normal.getId());
        privacy.current(stopped.getId());
        privacy.current(left.getId());
        privacy.optOut(admin.getId(), inquiry(stopped).getId());
        deletion.deleteAccount(left.getId(), LeaveReason.OTHER);
        var ids =
                profiles.findDeletionCandidates(
                        0L, org.springframework.data.domain.PageRequest.of(0, 10000));
        assertThat(ids).contains(stopped.getId(), left.getId()).doesNotContain(normal.getId());
        assertThat(
                        profiles.findDeletionCandidates(
                                left.getId(),
                                org.springframework.data.domain.PageRequest.of(0, 100)))
                .allMatch(id -> id > left.getId());
    }

    @Test
    @DisplayName("분석을 시작한 적 없는 회원은 중단 처리에서 식별자를 새로 만들지 않는다")
    void noIdentityOnOptOut() {
        Account a = account(SystemRole.MEMBER), admin = account(SystemRole.ADMIN);
        privacy.optOut(admin.getId(), inquiry(a).getId());
        var p = profiles.findById(a.getId()).orElseThrow();
        assertThat(p.getAnalyticsUserId()).isNull();
        assertThat(p.canReleaseIdentifiers()).isTrue();
        deletion.deleteAccount(a.getId(), LeaveReason.OTHER);
        worker.process(a.getId(), p.deletionReadyAt());
        assertThat(profiles.existsById(a.getId())).isFalse();
        verifyNoInteractions(gateway);
    }

    @Test
    @DisplayName("전송 도중 중단 요청은 계정 잠금을 기다리고 이후 전송은 막힌다")
    void serializeStopAndSend() throws Exception {
        Account a = account(SystemRole.MEMBER), admin = account(SystemRole.ADMIN);
        Feedback f = inquiry(a);
        privacy.current(a.getId());
        CountDownLatch sending = new CountDownLatch(1), release = new CountDownLatch(1);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<?> send =
                    executor.submit(
                            () ->
                                    privacy.whenAllowed(
                                            a.getId(),
                                            null,
                                            id -> {
                                                sending.countDown();
                                                try {
                                                    release.await(5, TimeUnit.SECONDS);
                                                } catch (InterruptedException e) {
                                                    Thread.currentThread().interrupt();
                                                }
                                            }));
            assertThat(sending.await(5, TimeUnit.SECONDS)).isTrue();
            Future<?> stop = executor.submit(() -> privacy.optOut(admin.getId(), f.getId()));
            release.countDown();
            send.get(5, TimeUnit.SECONDS);
            stop.get(5, TimeUnit.SECONDS);
            AtomicBoolean later = new AtomicBoolean();
            privacy.whenAllowed(a.getId(), null, id -> later.set(true));
            assertThat(later).isFalse();
        } finally {
            release.countDown();
        }
    }

    @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods = false)
    static class ListenerConfig {
        @org.springframework.context.annotation.Bean
        org.springframework.scheduling.TaskScheduler initialScheduler() {
            return mock(org.springframework.scheduling.TaskScheduler.class);
        }

        @org.springframework.context.annotation.Bean
        AnalyticsDeletionListener testDeletionListener(
                org.springframework.scheduling.TaskScheduler initialScheduler,
                AnalyticsDeletionWorker worker) {
            return new AnalyticsDeletionListener(initialScheduler, worker);
        }
    }

    @Test
    @DisplayName("첫 삭제는 커밋 후에만 예약하고 롤백하면 예약하지 않는다")
    void afterCommitOnly() {
        Account a = account(SystemRole.MEMBER), admin = account(SystemRole.ADMIN);
        privacy.current(a.getId());
        Feedback f = inquiry(a);
        new TransactionTemplate(transactions)
                .executeWithoutResult(
                        tx -> {
                            privacy.optOut(admin.getId(), f.getId());
                            verifyNoInteractions(initialScheduler);
                            tx.setRollbackOnly();
                        });
        verifyNoInteractions(initialScheduler);
        assertThat(profiles.findById(a.getId()).orElseThrow().getOptedOutAt()).isNull();
        long before = audits.count();
        new TransactionTemplate(transactions)
                .executeWithoutResult(
                        tx -> {
                            privacy.optOut(admin.getId(), f.getId());
                            verifyNoInteractions(initialScheduler);
                        });
        var times = org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(initialScheduler).schedule(any(Runnable.class), times.capture());
        Instant storedReady = profiles.findById(a.getId()).orElseThrow().deletionReadyAt();
        assertThat(Duration.between(storedReady, times.getValue()).abs())
                .isLessThan(Duration.ofMillis(1));
        assertThat(audits.count()).isEqualTo(before + 1);
        privacy.optOut(admin.getId(), f.getId());
        verifyNoMoreInteractions(initialScheduler);
    }
}
