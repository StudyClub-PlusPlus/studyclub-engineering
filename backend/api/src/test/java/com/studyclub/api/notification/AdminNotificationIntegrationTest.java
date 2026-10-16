package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.notification.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties =
                "spring.datasource.url=jdbc:h2:mem:notification-admin;MODE=MySQL;DB_CLOSE_DELAY=-1")
@AutoConfigureTestRestTemplate
class AdminNotificationIntegrationTest {
    @Autowired TestRestTemplate testRestTemplate;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired NotificationTemplateRepository notificationTemplateRepository;
    private NotificationTemplate template;

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        notificationTemplateRepository.deleteAll();
        template =
                notificationTemplateRepository.save(
                        new NotificationTemplate(
                                NotificationEventType.USER_REGISTERED,
                                NotificationChannel.EMAIL,
                                "환영합니다",
                                "안녕하세요, {{nickname}}님."));
    }

    private HttpEntity<Void> authenticated(SystemRole role) {
        String unique = UUID.randomUUID().toString();
        Account account =
                accountRepository.save(
                        new Account(
                                unique + "@example.com",
                                "n" + unique.substring(0, 10),
                                null,
                                role));
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(
                jwtService.issueAccess(account.getId().toString(), account.getEmail()));
        return new HttpEntity<>(headers);
    }

    private Notification pending(String email) {
        return notificationRepository.save(
                Notification.pendingImmediate(
                        NotificationEventType.USER_REGISTERED,
                        NotificationChannel.EMAIL,
                        email,
                        null,
                        template.getId(),
                        Map.of("nickname", "홍길동")));
    }

    @Test
    @DisplayName("ADMIN 은 템플릿 원문을 조회한다 — 이메일 allowlist 와 독립적인 요청 권한 검사")
    void adminListsTemplates() {
        var response =
                testRestTemplate.exchange(
                        "/api/admin/notification-templates",
                        HttpMethod.GET,
                        authenticated(SystemRole.ADMIN),
                        NotificationTemplateResponse[].class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .singleElement()
                .satisfies(
                        item -> {
                            assertThat(item.id()).isEqualTo(template.getId());
                            assertThat(item.body()).contains("{{nickname}}");
                            assertThat(item.updatedAt()).isNotNull();
                        });
    }

    @Test
    @DisplayName("ADMIN 발송 이력은 필터·페이지 계약과 마스킹을 지킨다 — 한 글자 이메일도 예외 없음")
    void adminListsMaskedHistory() {
        pending("hello@example.com");
        pending("a@example.com");
        Notification failed = pending("failed@example.com");
        Instant lockedAt = Instant.now();
        failed.markProcessing(lockedAt);
        failed.markFailed(NotificationErrorType.PROVIDER_ERROR, lockedAt);
        notificationRepository.save(failed);
        var headers = authenticated(SystemRole.ADMIN);
        var response =
                testRestTemplate.exchange(
                        "/api/admin/notifications?eventType=USER_REGISTERED&status=PENDING&offset=0&limit=1",
                        HttpMethod.GET,
                        headers,
                        NotificationListResponse.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().total()).isEqualTo(2);
        assertThat(response.getBody().offset()).isZero();
        assertThat(response.getBody().limit()).isEqualTo(1);
        assertThat(response.getBody().items())
                .singleElement()
                .satisfies(
                        item -> {
                            assertThat(item.recipientValue()).isEqualTo("a***@example.com");
                            assertThat(item.status()).isEqualTo("PENDING");
                        });
        var secondPage =
                testRestTemplate.exchange(
                        "/api/admin/notifications?status=PENDING&offset=1&limit=1",
                        HttpMethod.GET,
                        headers,
                        NotificationListResponse.class);
        assertThat(secondPage.getBody().items())
                .singleElement()
                .extracting(NotificationListResponse.NotificationSummary::recipientValue)
                .isEqualTo("h***@example.com");
    }

    @Test
    @DisplayName("MEMBER 는 알림 조회가 403 FORBIDDEN — @RequireAdmin")
    void memberIsForbidden() {
        for (String path : new String[] {"notification-templates", "notifications"}) {
            var response =
                    testRestTemplate.exchange(
                            "/api/admin/" + path,
                            HttpMethod.GET,
                            authenticated(SystemRole.MEMBER),
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).containsEntry("errorCode", "FORBIDDEN");
        }
    }

    @Test
    @DisplayName("토큰이 없으면 두 조회 모두 401 — 필터 오류도 공통 에러 계약을 지킨다")
    void unauthenticatedIsRejected() {
        for (String path : new String[] {"notification-templates", "notifications"}) {
            var response = testRestTemplate.getForEntity("/api/admin/" + path, Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        }
    }

    @Test
    @DisplayName("공개 미리보기는 토큰 없이 원문을 주고, 운영자 ID 는 싣지 않는다")
    void publicPreviewListsTemplatesWithoutAdminId() {
        var response = testRestTemplate.getForEntity("/api/notification-templates", List.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .singleElement()
                .satisfies(
                        item -> {
                            Map<?, ?> row = (Map<?, ?>) item;
                            assertThat(row.get("body")).isEqualTo("안녕하세요, {{nickname}}님.");
                            assertThat(row.get("eventType")).isEqualTo("USER_REGISTERED");
                            assertThat(row.containsKey("updatedByAdminId")).isFalse();
                        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"status=INVALID", "eventType=INVALID"})
    @DisplayName("알 수 없는 알림 필터는 400 — enum 변환 실패를 서버 오류로 보고하지 않는다")
    void rejectsUnknownNotificationFilter(String query) {
        var response =
                testRestTemplate.exchange(
                        "/api/admin/notifications?" + query,
                        HttpMethod.GET,
                        authenticated(SystemRole.ADMIN),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(response.getBody().get("errorMessage")).isEqualTo("입력값이 올바르지 않습니다.");
    }

    @Test
    @DisplayName("잘못된 페이지 입력은 400 — 음수 offset 이 서버 오류가 되지 않는다")
    void rejectsInvalidPagination() {
        var headers = authenticated(SystemRole.ADMIN);
        for (String query : new String[] {"offset=-1", "limit=0"}) {
            var response =
                    testRestTemplate.exchange(
                            "/api/admin/notifications?" + query,
                            HttpMethod.GET,
                            headers,
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    // ───────────── 실패 건 재발송 ─────────────

    private Account recipientAccount() {
        String unique = UUID.randomUUID().toString();
        return accountRepository.save(
                new Account(
                        unique + "@example.com",
                        "r" + unique.substring(0, 10),
                        null,
                        SystemRole.MEMBER));
    }

    private Notification failedFor(Long recipientUserId, String email) {
        Notification notification =
                notificationRepository.save(
                        Notification.pendingImmediate(
                                NotificationEventType.USER_REGISTERED,
                                NotificationChannel.EMAIL,
                                email,
                                recipientUserId,
                                template.getId(),
                                Map.of("nickname", "홍길동")));
        Instant lockedAt = Instant.now();
        notification.markProcessing(lockedAt);
        notification.markFailed(NotificationErrorType.PROVIDER_ERROR, lockedAt);
        return notificationRepository.save(notification);
    }

    private Notification sentFor(Long recipientUserId, String email) {
        Notification notification = pending(email);
        Instant lockedAt = Instant.now();
        notification.markProcessing(lockedAt);
        notification.markSent(Instant.now(), lockedAt);
        return notificationRepository.save(notification);
    }

    private <T> org.springframework.http.ResponseEntity<T> resend(
            SystemRole role, Object ids, Class<T> type) {
        HttpHeaders headers = new HttpHeaders();
        headers.addAll(authenticated(role).getHeaders());
        headers.setContentType(MediaType.APPLICATION_JSON);
        return testRestTemplate.exchange(
                "/api/admin/notifications/resend",
                HttpMethod.POST,
                new HttpEntity<>(Map.of("ids", ids), headers),
                type);
    }

    @Test
    @DisplayName("실패 건 재발송 — 그 행이 PENDING 으로 돌아가고 새 행은 생기지 않는다. 202 로 접수만 알린다")
    void resendReusesTheSameRow() {
        Account recipient = recipientAccount();
        Notification failed = failedFor(recipient.getId(), "failed@example.com");
        long rowsBefore = notificationRepository.count();

        var response =
                resend(SystemRole.ADMIN, List.of(failed.getId()), NotificationResendResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody().accepted()).containsExactly(failed.getId());
        assertThat(response.getBody().skipped()).isEmpty();
        Notification reloaded = notificationRepository.findById(failed.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(reloaded.getErrorType()).isNull();
        assertThat(reloaded.getRecipientValue()).isEqualTo("failed@example.com");
        assertThat(notificationRepository.count()).as("새 행을 만들지 않는다").isEqualTo(rowsBefore);
    }

    @Test
    @DisplayName("재발송 — 보낼 수 없는 줄만 이유와 함께 건너뛰고 나머지는 접수한다 (부분 성공)")
    void resendSkipsOnlyTheRowsThatCannotBeResent() {
        Account alive = recipientAccount();
        Notification ok = failedFor(alive.getId(), "ok@example.com");
        Notification sent = sentFor(null, "sent@example.com");
        Notification withdrawn = failedFor(987_654_321L, "gone@example.com");

        var response =
                resend(
                        SystemRole.ADMIN,
                        List.of(ok.getId(), sent.getId(), withdrawn.getId()),
                        NotificationResendResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody().accepted()).containsExactly(ok.getId());
        assertThat(response.getBody().skipped())
                .containsExactlyInAnyOrder(
                        new NotificationResendResponse.Skipped(
                                sent.getId(), ResendSkipReason.NOT_FAILED),
                        new NotificationResendResponse.Skipped(
                                withdrawn.getId(), ResendSkipReason.RECIPIENT_GONE));
        assertThat(notificationRepository.findById(ok.getId()).orElseThrow().getStatus())
                .isEqualTo(NotificationStatus.PENDING);
        assertThat(notificationRepository.findById(sent.getId()).orElseThrow().getStatus())
                .isEqualTo(NotificationStatus.SENT);
        assertThat(notificationRepository.findById(withdrawn.getId()).orElseThrow().getStatus())
                .as("탈퇴한 회원의 건은 그대로 FAILED")
                .isEqualTo(NotificationStatus.FAILED);
    }

    @Test
    @DisplayName("이미 재발송한 건을 다시 누르면 건너뛴다 — 같은 메일이 두 번 가지 않는다")
    void resendingTwiceSkipsTheSecondTime() {
        Notification failed = failedFor(recipientAccount().getId(), "twice@example.com");

        resend(SystemRole.ADMIN, List.of(failed.getId()), NotificationResendResponse.class);
        var second =
                resend(SystemRole.ADMIN, List.of(failed.getId()), NotificationResendResponse.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(second.getBody().accepted()).isEmpty();
        assertThat(second.getBody().skipped())
                .containsExactly(
                        new NotificationResendResponse.Skipped(
                                failed.getId(), ResendSkipReason.NOT_FAILED));
    }

    @Test
    @DisplayName("같은 ID 를 여러 번 보내도 한 번만 접수한다")
    void resendDeduplicatesIds() {
        Notification failed = failedFor(recipientAccount().getId(), "dup@example.com");

        var response =
                resend(
                        SystemRole.ADMIN,
                        List.of(failed.getId(), failed.getId(), failed.getId()),
                        NotificationResendResponse.class);

        assertThat(response.getBody().accepted()).containsExactly(failed.getId());
        assertThat(response.getBody().skipped()).isEmpty();
    }

    @Test
    @DisplayName("없는 ID 가 하나라도 있으면 404 이고 다른 줄도 바뀌지 않는다")
    void resendWithUnknownIdChangesNothing() {
        Notification failed = failedFor(recipientAccount().getId(), "keep@example.com");

        var response = resend(SystemRole.ADMIN, List.of(failed.getId(), 999_999_999L), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
        assertThat(notificationRepository.findById(failed.getId()).orElseThrow().getStatus())
                .isEqualTo(NotificationStatus.FAILED);
    }

    @Test
    @DisplayName("재발송 ids 는 1~100건 — 비었거나 101건이면 400")
    void resendRejectsInvalidIds() {
        for (List<Long> ids :
                List.of(List.<Long>of(), LongStream.rangeClosed(1, 101).boxed().toList())) {
            var response = resend(SystemRole.ADMIN, ids, Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    @Test
    @DisplayName("재발송은 캡틴만 — MEMBER 는 403, 토큰이 없으면 401, 어느 쪽이든 행은 그대로")
    void resendRequiresAdmin() {
        Notification failed = failedFor(recipientAccount().getId(), "auth@example.com");

        var forbidden = resend(SystemRole.MEMBER, List.of(failed.getId()), Map.class);
        assertThat(forbidden.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(forbidden.getBody()).containsEntry("errorCode", "FORBIDDEN");

        HttpHeaders anonymous = new HttpHeaders();
        anonymous.setContentType(MediaType.APPLICATION_JSON);
        var unauthorized =
                testRestTemplate.exchange(
                        "/api/admin/notifications/resend",
                        HttpMethod.POST,
                        new HttpEntity<>(Map.of("ids", List.of(failed.getId())), anonymous),
                        Map.class);
        assertThat(unauthorized.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(unauthorized.getBody()).containsEntry("errorCode", "UNAUTHORIZED");

        assertThat(notificationRepository.findById(failed.getId()).orElseThrow().getStatus())
                .isEqualTo(NotificationStatus.FAILED);
    }

    @Test
    @DisplayName("발송 이력의 canResend — 실패+계정 있음만 true, 성공·탈퇴는 false")
    void historyReportsCanResend() {
        Notification resendable = failedFor(recipientAccount().getId(), "yes@example.com");
        Notification withdrawn = failedFor(987_654_322L, "gone@example.com");
        Notification sent = sentFor(null, "sent@example.com");

        var response =
                testRestTemplate.exchange(
                        "/api/admin/notifications?limit=100",
                        HttpMethod.GET,
                        authenticated(SystemRole.ADMIN),
                        NotificationListResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var byId =
                response.getBody().items().stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        NotificationListResponse.NotificationSummary::id,
                                        NotificationListResponse.NotificationSummary::canResend));
        assertThat(byId.get(resendable.getId())).isTrue();
        assertThat(byId.get(withdrawn.getId())).isFalse();
        assertThat(byId.get(sent.getId())).isFalse();
    }

    @Test
    @DisplayName("ids 로 조회하면 그 행들만 준다 — 재발송한 건의 끝을 쫓는 용도")
    void historyByIdsReturnsOnlyThoseRows() {
        Notification first = failedFor(null, "a1@example.com");
        Notification second = sentFor(null, "b1@example.com");
        failedFor(null, "c1@example.com");

        var response =
                testRestTemplate.exchange(
                        "/api/admin/notifications?ids=" + first.getId() + "," + second.getId(),
                        HttpMethod.GET,
                        authenticated(SystemRole.ADMIN),
                        NotificationListResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().total()).isEqualTo(2);
        assertThat(response.getBody().items())
                .extracting(NotificationListResponse.NotificationSummary::id)
                .containsExactlyInAnyOrder(first.getId(), second.getId());
    }

    @Test
    @DisplayName("limit 이 100 을 넘거나 ids 가 100개를 넘으면 400")
    void rejectsOversizedLimitAndIds() {
        var headers = authenticated(SystemRole.ADMIN);
        String tooManyIds =
                LongStream.rangeClosed(1, 101)
                        .mapToObj(String::valueOf)
                        .collect(java.util.stream.Collectors.joining(","));
        for (String query : new String[] {"limit=101", "ids=" + tooManyIds}) {
            var response =
                    testRestTemplate.exchange(
                            "/api/admin/notifications?" + query,
                            HttpMethod.GET,
                            headers,
                            Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }
}
