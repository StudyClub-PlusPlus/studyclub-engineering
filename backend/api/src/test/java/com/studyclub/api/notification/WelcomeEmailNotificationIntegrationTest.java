package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.notification.Notification;
import com.studyclub.notification.NotificationChannel;
import com.studyclub.notification.NotificationEventType;
import com.studyclub.notification.NotificationRepository;
import com.studyclub.notification.NotificationStatus;
import com.studyclub.notification.NotificationTemplate;
import com.studyclub.notification.NotificationTemplateRepository;
import java.util.List;
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
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;

/**
 * 회원가입 완료(온보딩 완료) → {@code UserRegisteredNotificationListener} → {@code NOTIFICATION} 행 생성까지의
 * end-to-end 경로 (specs/notification/spec.md).
 *
 * <p>{@code AFTER_COMMIT} 리스너는 같은 서블릿 요청 스레드 안에서 커밋 직후 동기적으로 실행된다 — {@code
 * TestRestTemplate}(RANDOM_PORT) 호출이 돌아온 시점엔 이미 끝나 있으므로 별도 대기 없이 바로 리포지토리로 확인한다. {@code
 * AccountOnboardingIntegrationTest} 가 별도 레코딩 리스너를 쓰는 건 Spring 의 {@code ApplicationEvents} 테스트 유틸이
 * 테스트 스레드에서 발행된 이벤트만 보기 때문인데, 여기서는 그 유틸 대신 실제 DB 를 직접 조회하므로 그 제약이 없다.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties =
                "spring.datasource.url=jdbc:h2:mem:notification-welcome;MODE=MySQL;DB_CLOSE_DELAY=-1")
@AutoConfigureTestRestTemplate
class WelcomeEmailNotificationIntegrationTest {

    @Autowired TestRestTemplate testRestTemplate;
    @Autowired JwtService jwtService;
    @Autowired AccountRepository accountRepository;
    @Autowired NotificationRepository notificationRepository;
    @Autowired NotificationTemplateRepository notificationTemplateRepository;
    @Autowired org.springframework.context.ApplicationEventPublisher applicationEventPublisher;

    @Autowired
    org.springframework.transaction.PlatformTransactionManager platformTransactionManager;

    @BeforeEach
    void useModernHttpClient() {
        testRestTemplate.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    /** Flyway 가 꺼진 테스트 환경(H2, ddl-auto=create-drop)이라 마이그레이션이 시딩하는 웰컴메일 템플릿이 없다 — 직접 심는다. */
    @BeforeEach
    void seedWelcomeEmailTemplateIfMissing() {
        boolean exists =
                notificationTemplateRepository
                        .findByEventTypeAndChannel(
                                NotificationEventType.USER_REGISTERED, NotificationChannel.EMAIL)
                        .isPresent();
        if (!exists) {
            notificationTemplateRepository.save(
                    new NotificationTemplate(
                            NotificationEventType.USER_REGISTERED,
                            NotificationChannel.EMAIL,
                            "StudyClub++에 오신 걸 환영합니다",
                            "안녕하세요, {{nickname}}님."));
        }
    }

    /** 임시 닉네임으로 미온보딩 계정을 심는다 — 온보딩 요청이 확정할 닉네임과는 다른 값이어야 한다(안 그러면 "이미 쓰는 닉네임" 409). */
    private Account seedUnonboardedAccount() {
        String email = "welcome-" + UUID.randomUUID() + "@example.com";
        String tempNickname =
                "account_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return accountRepository.save(new Account(email, tempNickname, null, SystemRole.MEMBER));
    }

    private HttpEntity<Map<String, Object>> authenticatedBody(
            Account account, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(
                jwtService.issueAccess(String.valueOf(account.getId()), account.getEmail()));
        return new HttpEntity<>(body, headers);
    }

    @Test
    @DisplayName("온보딩 커밋 후 알림을 별도로 저장한다 — 직접 서비스 호출 없이 이벤트 경로를 검증한다")
    void onboardingCompletion_createsPendingWelcomeEmailNotification() {
        String nickname = "n" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Account account = seedUnonboardedAccount();

        Map<String, Object> request =
                Map.of(
                        "age14Confirmed", true,
                        "termsOfServiceAgreed", true,
                        "privacyPolicyAgreed", true,
                        "marketingAgreed", false,
                        "nickname", nickname,
                        "timeZone", "Asia/Seoul");

        ResponseEntity<Map> response =
                testRestTemplate.exchange(
                        "/accounts/onboarding",
                        HttpMethod.POST,
                        authenticatedBody(account, request),
                        Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        List<Notification> notifications =
                notificationRepository.findAllByOrderByCreatedAtDesc().stream()
                        .filter(n -> account.getId().equals(n.getRecipientUserId()))
                        .toList();
        assertThat(notifications).hasSize(1);

        Notification notification = notifications.get(0);
        assertThat(notification.getEventType()).isEqualTo(NotificationEventType.USER_REGISTERED);
        assertThat(notification.getRecipientType()).isEqualTo(NotificationChannel.EMAIL);
        assertThat(notification.getRecipientValue()).isEqualTo(account.getEmail());
        assertThat(notification.getStatus()).isEqualTo(NotificationStatus.PENDING);
        assertThat(notification.getPayload()).containsEntry("nickname", nickname);
    }

    @Test
    @DisplayName("원래 트랜잭션이 롤백되면 알림을 만들지 않는다 — AFTER_COMMIT 계약")
    void rollbackDoesNotCreateNotification() {
        Account account = seedUnonboardedAccount();
        new org.springframework.transaction.support.TransactionTemplate(platformTransactionManager)
                .executeWithoutResult(
                        status -> {
                            applicationEventPublisher.publishEvent(
                                    new com.studyclub.domain.account.UserRegisteredEvent(
                                            account.getId()));
                            status.setRollbackOnly();
                        });
        assertThat(notificationRepository.findAll())
                .noneMatch(n -> account.getId().equals(n.getRecipientUserId()));
    }
}
