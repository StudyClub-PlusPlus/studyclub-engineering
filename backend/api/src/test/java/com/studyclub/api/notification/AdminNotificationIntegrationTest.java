package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.notification.*;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
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
    @DisplayName("토큰이 없으면 두 조회 모두 401 — 필터 오류도 공통 에러 계약을 지킨다")
    void unauthenticatedIsRejected() {
        for (String path : new String[] {"notification-templates", "notifications"}) {
            var response = testRestTemplate.getForEntity("/api/admin/" + path, Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).containsEntry("errorCode", "UNAUTHORIZED");
        }
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
}
