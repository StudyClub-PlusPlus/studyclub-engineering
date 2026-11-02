package com.studyclub.api.webpush;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import com.studyclub.notification.webpush.WebPushSubscriptionRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:web-push;MODE=MySQL;DB_CLOSE_DELAY=-1",
            // RFC 8291 예제 키 — 테스트 전용
            "notification.web-push.public-key=BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
            "notification.web-push.private-key=yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
            "notification.web-push.subject=mailto:ops@example.com",
            "notification.polling.fixed-delay-ms=3600000"
        })
@AutoConfigureTestRestTemplate
class WebPushIntegrationTest {

    private static final String FCM = "https://fcm.googleapis.com/fcm/send/";
    private static final Map<String, String> KEYS =
            Map.of(
                    "p256dh",
                    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
                    "auth",
                    "BTBZMqHH6r4Tts7J_aSIgg");

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired WebPushSubscriptionRepository subscriptionRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired NotificationTemplateRepository templateRepository;

    @BeforeEach
    void setUp() {
        notificationRepository.deleteAll();
        subscriptionRepository.deleteAll();
        templateRepository.deleteAll();
        templateRepository.save(
                new NotificationTemplate(
                        NotificationEventType.ADMIN_PUSH,
                        NotificationChannel.WEB_PUSH,
                        "{{title}}",
                        "{{body}}"));
    }

    private HttpHeaders login(SystemRole role) {
        String unique = UUID.randomUUID().toString();
        Account account =
                new Account(unique + "@example.com", "n" + unique.substring(0, 10), null, role);
        account.completeOnboarding(account.getNickname(), "Asia/Seoul", Instant.now());
        account = accountRepository.save(account);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(
                jwtService.issueAccess(account.getId().toString(), account.getEmail()));
        return headers;
    }

    private HttpStatus subscribe(HttpHeaders headers, String endpoint) {
        return HttpStatus.valueOf(
                rest.exchange(
                                "/api/me/web-push-subscription",
                                HttpMethod.PUT,
                                new HttpEntity<>(
                                        Map.of("endpoint", endpoint, "keys", KEYS), headers),
                                Void.class)
                        .getStatusCode()
                        .value());
    }

    @Test
    @DisplayName("공개키는 로그인 없이 받는다")
    void configIsPublic() {
        var response = rest.getForEntity("/api/web-push/config", Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("enabled", true).containsKey("publicKey");
    }

    @Test
    @DisplayName("같은 기기를 두 번 구독해도 행은 하나다")
    void subscribeIsIdempotent() {
        HttpHeaders me = login(SystemRole.MEMBER);
        assertThat(subscribe(me, FCM + "abc")).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(subscribe(me, FCM + "abc")).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(subscriptionRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("로그인하지 않으면 구독할 수 없다 — 401")
    void subscribeRequiresLogin() {
        assertThat(subscribe(new HttpHeaders(), FCM + "abc")).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("푸시 서버가 아닌 주소는 400 — 서버가 내부망으로 요청하지 않게")
    void rejectsUnknownPushService() {
        HttpHeaders me = login(SystemRole.MEMBER);
        assertThat(subscribe(me, "https://internal.example.com/x"))
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(subscribe(me, "http://fcm.googleapis.com/x")).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(subscriptionRepository.count()).isZero();
    }

    @Test
    @DisplayName("남의 구독은 해제되지 않는다")
    void cannotUnsubscribeOthers() {
        subscribe(login(SystemRole.MEMBER), FCM + "mine");
        rest.exchange(
                "/api/me/web-push-subscription",
                HttpMethod.DELETE,
                new HttpEntity<>(Map.of("endpoint", FCM + "mine"), login(SystemRole.MEMBER)),
                Void.class);
        assertThat(subscriptionRepository.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("캡틴이 나에게 보내면 내 기기마다 웹 푸시 알림 행이 대기로 생긴다")
    void adminSendsToSelf() {
        HttpHeaders admin = login(SystemRole.ADMIN);
        subscribe(admin, FCM + "admin-phone");
        subscribe(login(SystemRole.MEMBER), FCM + "someone-else");

        var response =
                rest.exchange(
                        "/api/admin/web-push/send",
                        HttpMethod.POST,
                        new HttpEntity<>(
                                Map.of(
                                        "audience",
                                        "SELF",
                                        "title",
                                        "테스트",
                                        "body",
                                        "도착했나요",
                                        "url",
                                        "/studies"),
                                admin),
                        Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody()).containsEntry("queued", 1);
        Notification row = notificationRepository.findAll().getFirst();
        assertThat(row.getRecipientType()).isEqualTo(NotificationChannel.WEB_PUSH);
        assertThat(row.getEventType()).isEqualTo(NotificationEventType.ADMIN_PUSH);
        assertThat(row.getPayload()).containsEntry("url", "/studies");
    }

    @Test
    @DisplayName("캡틴이 아니면 푸시를 보낼 수 없다 — 403")
    void sendRequiresAdmin() {
        var response =
                rest.exchange(
                        "/api/admin/web-push/send",
                        HttpMethod.POST,
                        new HttpEntity<>(
                                Map.of("audience", "ALL", "title", "t", "body", "b"),
                                login(SystemRole.MEMBER)),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("링크가 바깥 주소면 400 — 알림을 누른 사람을 밖으로 보내지 않는다")
    void rejectsExternalLink() {
        var response =
                rest.exchange(
                        "/api/admin/web-push/send",
                        HttpMethod.POST,
                        new HttpEntity<>(
                                Map.of(
                                        "audience",
                                        "ALL",
                                        "title",
                                        "t",
                                        "body",
                                        "b",
                                        "url",
                                        "//evil.example.com"),
                                login(SystemRole.ADMIN)),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
