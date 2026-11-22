package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.auth.JwtService;
import com.studyclub.api.feedback.AdminFeedbackService;
import com.studyclub.domain.account.*;
import com.studyclub.domain.feedback.*;
import com.studyclub.notification.*;
import com.studyclub.notification.mail.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:feedback-email;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
            "notification.site-base-url=https://stage.studyclub.life/"
        })
@AutoConfigureTestRestTemplate
class FeedbackReplyEmailIntegrationTest {
    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accounts;
    @Autowired FeedbackRepository feedbacks;
    @Autowired NotificationTemplateRepository templates;
    @MockitoSpyBean NotificationRepository notifications;
    @Autowired AdminFeedbackService feedbackService;
    @Autowired AccountDeletionService deletionService;
    @Autowired NotificationPollingScheduler poller;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean MailClient mailClient;
    private Account crew;
    private Account captain;
    private Feedback feedback;
    private String html;
    private String seedSql;

    @BeforeEach
    void setUp() throws Exception {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        notifications.deleteAll();
        templates.deleteAll();
        html =
                Files.readString(
                        Path.of(
                                "../../frontend/apps/playground/src/proto/mail/templates/feedback-replied-email.html"));
        seedSql =
                Files.readString(
                        Path.of(
                                "../notification/src/main/resources/db/migration/V52__feedback_replied_email.sql"));
        jdbc.execute(seedSql);
        crew = account(SystemRole.MEMBER);
        captain = account(SystemRole.ADMIN);
        feedback =
                feedbacks.save(
                        new Feedback(
                                crew.getId(),
                                FeedbackType.BUG,
                                "비공개 문의 제목",
                                "문의 본문은 메일에 포함하지 않는다.",
                                null,
                                null,
                                null));
    }

    private Account account(SystemRole role) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Account account = new Account(suffix + "@example.com", "n" + suffix, null, role);
        account.completeOnboarding("n" + suffix, "Asia/Seoul", Instant.now());
        return accounts.save(account);
    }

    private HttpEntity<Map<String, Object>> auth(Account account, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return new HttpEntity<>(body, headers);
    }

    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> patch(Account actor, Map<String, Object> body) {
        return rest.exchange(
                "/api/admin/feedbacks/" + feedback.getId(),
                HttpMethod.PATCH,
                auth(actor, body),
                Map.class);
    }

    private List<Notification> rows() {
        return notifications.findAll().stream()
                .filter(n -> feedback.getId().equals(n.getReferenceId()))
                .toList();
    }

    private Feedback reload() {
        return feedbacks.findById(feedback.getId()).orElseThrow();
    }

    @Test
    @DisplayName("첫 회신 API → DONE·알림 예약 → HTML 발송 — 원문 답변은 메일에 싣지 않는다")
    void firstReplyQueuesAndSendsHtml() {
        feedbackService.patch(captain.getId(), feedback.getId(), Map.of("adminMemo", "내부용 메모"));
        assertThat(patch(captain, Map.of("reply", "문의하신 오류를 수정했습니다.")).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(reload().getStatus()).isEqualTo(FeedbackStatus.DONE);
        assertThat(rows()).hasSize(1);
        Notification row = rows().getFirst();
        assertThat(row.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(row.getEventType()).isEqualTo(NotificationEventType.FEEDBACK_REPLIED);
        assertThat(row.getRecipientUserId()).isEqualTo(crew.getId());
        assertThat(row.getPayload())
                .containsExactlyInAnyOrderEntriesOf(
                        Map.of(
                                "nickname",
                                crew.getNickname(),
                                "feedbackUrl",
                                "https://stage.studyclub.life/ko/my/feedbacks/"
                                        + feedback.getId()));
        verifyNoInteractions(mailClient);
        poller.poll();
        poller.poll();
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mailClient)
                .send(
                        eq(MailCategory.NOTIFY),
                        eq(crew.getEmail()),
                        eq("[StudyClub] 문의에 답변이 등록됐어요"),
                        body.capture());
        assertThat(body.getValue())
                .startsWith("<!DOCTYPE html>")
                .contains(
                        "안녕하세요, " + crew.getNickname(),
                        "href=\"https://stage.studyclub.life/ko/my/feedbacks/"
                                + feedback.getId()
                                + "\"",
                        "답변 확인하기")
                .doesNotContain("{{", "문의하신 오류", "내부용 메모", "비공개 문의 제목", "문의 본문은");
        assertThat(rows().getFirst().getStatus()).isEqualTo(NotificationStatus.SENT);
    }

    @Test
    @DisplayName("수정·같은 요청 재시도·메모 저장은 새 회신이 아니다 — 알림은 한 건을 유지한다")
    void editsNeverQueueAgain() {
        var first =
                feedbackService.patch(
                        captain.getId(), feedback.getId(), Map.of("reply", "문의하신 오류를 수정했습니다."));
        feedbackService.patch(
                captain.getId(), feedback.getId(), Map.of("reply", "문의하신 오류를 수정했습니다."));
        templates.deleteAll();
        feedbackService.patch(
                captain.getId(), feedback.getId(), Map.of("reply", "수정한 답변으로 다시 안내합니다."));
        feedbackService.patch(captain.getId(), feedback.getId(), Map.of("adminMemo", "수정 확인"));
        assertThat(rows()).hasSize(1);
        assertThat(reload().getRepliedAt()).isEqualTo(first.reply().repliedAt());
        assertThat(reload().getDoneByAccountId()).isEqualTo(captain.getId());
    }

    @Test
    @DisplayName("동시 첫 회신도 한 번만 예약한다 — 잠금 뒤에 최신 문의 상태를 읽는다")
    void concurrentRepliesQueueOnce() throws Exception {
        Account other = account(SystemRole.ADMIN);
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<?> one =
                    pool.submit(
                            () -> {
                                await(start);
                                feedbackService.patch(
                                        captain.getId(),
                                        feedback.getId(),
                                        Map.of("reply", "첫 번째 캡틴의 답변입니다."));
                            });
            Future<?> two =
                    pool.submit(
                            () -> {
                                await(start);
                                feedbackService.patch(
                                        other.getId(),
                                        feedback.getId(),
                                        Map.of("reply", "두 번째 캡틴의 답변입니다."));
                            });
            start.countDown();
            one.get(15, TimeUnit.SECONDS);
            two.get(15, TimeUnit.SECONDS);
        }
        assertThat(rows()).hasSize(1);
        assertThat(reload().getStatus()).isEqualTo(FeedbackStatus.DONE);
    }

    @Test
    @DisplayName("템플릿이 없으면 회신과 완료도 롤백한다 — 복구 후 재요청으로 첫 알림을 예약할 수 있다")
    void missingTemplateRollsBackReply() {
        templates.deleteAll();
        assertThat(patch(captain, Map.of("reply", "문의하신 오류를 수정했습니다.")).getStatusCode())
                .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(reload().isAnswered()).isFalse();
        assertThat(reload().getStatus()).isEqualTo(FeedbackStatus.NEW);
        assertThat(rows()).isEmpty();
        jdbc.execute(seedSql);
        assertThat(patch(captain, Map.of("reply", "문의하신 오류를 수정했습니다.")).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(rows()).hasSize(1);
    }

    @Test
    @DisplayName("알림 행 저장 실패는 회신 전체를 롤백한다 — 회신만 성공했다고 남기지 않는다")
    void notificationWriteFailureRollsBackReply() {
        doThrow(new IllegalStateException("test queue failure"))
                .when(notifications)
                .save(any(Notification.class));
        assertThat(patch(captain, Map.of("reply", "문의하신 오류를 수정했습니다.")).getStatusCode())
                .isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(reload().isAnswered()).isFalse();
        assertThat(reload().getDoneByAccountId()).isNull();
        assertThat(rows()).isEmpty();
    }

    @Test
    @DisplayName("회신 트랜잭션 롤백은 메일도 남기지 않는다 — 나중에 폴러가 잘못 보내지 않는다")
    void rollbackDoesNotQueue() {
        new TransactionTemplate(transactionManager)
                .executeWithoutResult(
                        status -> {
                            feedbackService.patch(
                                    captain.getId(),
                                    feedback.getId(),
                                    Map.of("reply", "문의하신 오류를 수정했습니다."));
                            status.setRollbackOnly();
                        });
        assertThat(rows()).isEmpty();
        assertThat(reload().isAnswered()).isFalse();
    }

    @Test
    @DisplayName("전송 실패는 회신을 유지하고 FAILED 로 남긴다 — 기존 재발송 API 로 같은 행을 다시 보낸다")
    void deliveryFailureCanBeResent() {
        feedbackService.patch(
                captain.getId(), feedback.getId(), Map.of("reply", "문의하신 오류를 수정했습니다."));
        doThrow(new MailSendException(NotificationErrorType.PROVIDER_ERROR, "test failure", null))
                .when(mailClient)
                .send(any(), anyString(), anyString(), anyString());
        poller.poll();
        poller.poll();
        Notification failed = rows().getFirst();
        assertThat(failed.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(reload().getStatus()).isEqualTo(FeedbackStatus.DONE);
        assertThat(reload().isAnswered()).isTrue();
        verify(mailClient).send(any(), anyString(), anyString(), anyString());
        doNothing().when(mailClient).send(any(), anyString(), anyString(), anyString());
        var response =
                rest.exchange(
                        "/api/admin/notifications/resend",
                        HttpMethod.POST,
                        auth(captain, Map.of("ids", List.of(failed.getId()))),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        poller.poll();
        assertThat(rows()).hasSize(1);
        assertThat(rows().getFirst().getStatus()).isEqualTo(NotificationStatus.SENT);
    }

    @Test
    @DisplayName("탈퇴가 먼저면 회신은 저장하고 메일은 생략한다 — 없는 수신자를 복구하지 않는다")
    void departedRecipientGetsNoEmail() {
        deletionService.deleteAccount(crew.getId(), LeaveReason.OTHER);
        assertThat(patch(captain, Map.of("reply", "문의하신 오류를 수정했습니다.")).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(rows()).isEmpty();
        assertThat(reload().isAnswered()).isTrue();
    }

    @Test
    @DisplayName("예약 후 탈퇴하면 대기 메일 취소·닉네임 비식별화 — 폴러는 보내지 않는다")
    void withdrawalCancelsQueuedEmail() {
        feedbackService.patch(
                captain.getId(), feedback.getId(), Map.of("reply", "문의하신 오류를 수정했습니다."));
        deletionService.deleteAccount(crew.getId(), LeaveReason.OTHER);
        Notification cancelled = rows().getFirst();
        assertThat(cancelled.getStatus()).isEqualTo(NotificationStatus.CANCELLED);
        assertThat(cancelled.getRecipientValue()).isNotEqualTo(crew.getEmail());
        assertThat(cancelled.getPayload()).containsEntry("nickname", null);
        poller.poll();
        verifyNoInteractions(mailClient);
    }

    @Test
    @DisplayName("답변 권한·입력 오류는 메일을 만들지 않는다 — 기존 API 계약을 유지한다")
    void rejectedRequestsDoNotQueue() {
        assertThat(patch(crew, Map.of("reply", "권한 없는 사용자의 답변입니다.")).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(patch(captain, Map.of("reply", "짧음")).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(patch(captain, Map.of("status", "DONE")).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(rows()).isEmpty();
    }

    @Test
    @DisplayName("DB 시드는 승인한 HTML 과 같고 재적용해도 운영자가 고친 문구를 덮어쓰지 않는다")
    void migrationPreservesExistingTemplate() {
        var template =
                templates
                        .findAllByEventTypeAndChannelOrderByIdAsc(
                                NotificationEventType.FEEDBACK_REPLIED, NotificationChannel.EMAIL)
                        .getFirst();
        assertThat(template.getBody()).isEqualTo(html);
        template.edit(NotificationEventType.FEEDBACK_REPLIED, "운영자가 고친 제목", html, captain.getId());
        templates.save(template);
        jdbc.execute(seedSql);
        assertThat(templates.findAll()).hasSize(1);
        assertThat(templates.findById(template.getId()).orElseThrow().getSubject())
                .isEqualTo("운영자가 고친 제목");
    }

    @Test
    @DisplayName("조건에 템플릿이 여럿이면 첫 회신 때 각각 한 번 예약한다 — 수정은 어느 템플릿도 다시 보내지 않는다")
    void queuesEachTemplateOnce() {
        templates.save(
                new NotificationTemplate(
                        NotificationEventType.FEEDBACK_REPLIED,
                        NotificationChannel.EMAIL,
                        "추가 안내",
                        "{{feedbackUrl}}"));
        feedbackService.patch(
                captain.getId(), feedback.getId(), Map.of("reply", "문의하신 오류를 수정했습니다."));
        feedbackService.patch(
                captain.getId(), feedback.getId(), Map.of("reply", "수정한 답변으로 다시 안내합니다."));
        assertThat(rows()).hasSize(2);
        assertThat(rows()).extracting(Notification::getTemplateId).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("회신 예약과 탈퇴가 겹쳐도 같은 계정 잠금으로 직렬화한다 — 새 메일이 비식별화를 빠져나가지 않는다")
    void concurrentWithdrawalCancelsTheNewNotification() throws Exception {
        CountDownLatch replyReady = new CountDownLatch(1);
        CountDownLatch allowCommit = new CountDownLatch(1);
        CountDownLatch leaveStarted = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<?> replying =
                    pool.submit(
                            () ->
                                    new TransactionTemplate(transactionManager)
                                            .executeWithoutResult(
                                                    status -> {
                                                        feedbackService.patch(
                                                                captain.getId(),
                                                                feedback.getId(),
                                                                Map.of(
                                                                        "reply",
                                                                        "문의하신 오류를 수정했습니다."));
                                                        replyReady.countDown();
                                                        await(allowCommit);
                                                    }));
            await(replyReady);
            Future<?> leaving =
                    pool.submit(
                            () -> {
                                leaveStarted.countDown();
                                deletionService.deleteAccount(crew.getId(), LeaveReason.OTHER);
                            });
            await(leaveStarted);
            allowCommit.countDown();
            replying.get(15, TimeUnit.SECONDS);
            leaving.get(15, TimeUnit.SECONDS);
        } finally {
            allowCommit.countDown();
        }
        assertThat(rows()).hasSize(1);
        assertThat(rows().getFirst().getStatus()).isEqualTo(NotificationStatus.CANCELLED);
        assertThat(rows().getFirst().getPayload()).containsEntry("nickname", null);
        assertThat(rows().getFirst().getRecipientValue()).isNotEqualTo(crew.getEmail());
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("latch timeout");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
