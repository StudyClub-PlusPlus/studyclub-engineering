package com.studyclub.notification.webpush;

import com.studyclub.notification.NotificationErrorType;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 푸시 서버(구글·애플·모질라)로 암호화한 알림 1건을 보낸다. 키가 비어 있으면 꺼진 상태다 — 구독도 발송도 받지 않는다 (specs/web-push/spec.md). 키
 * 값은 환경변수로만 들어온다(PUBLIC 레포).
 */
@Component
@Slf4j
public class WebPushClient {

    /** 푸시 서버가 기기를 못 만나면 보관하는 시간. 하루 지난 스터디 알림은 의미가 없다. */
    static final int TTL_SECONDS = 24 * 60 * 60;

    private static final Duration VAPID_LIFETIME = Duration.ofHours(12);

    private final String publicKey;
    private final String privateKey;
    private final String subject;
    private final HttpClient http =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .followRedirects(HttpClient.Redirect.NEVER)
                    .build();

    public WebPushClient(
            @Value("${notification.web-push.public-key:}") String publicKey,
            @Value("${notification.web-push.private-key:}") String privateKey,
            @Value("${notification.web-push.subject:}") String subject) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
    }

    public boolean enabled() {
        return !publicKey.isBlank() && !privateKey.isBlank() && !subject.isBlank();
    }

    public String publicKey() {
        return publicKey;
    }

    /**
     * @return 구독이 사라졌으면(404·410) false — 호출자가 구독을 지운다
     * @throws WebPushSendException 그 밖의 실패
     */
    public boolean send(WebPushSubscription subscription, String json) {
        if (!enabled()) {
            throw new WebPushSendException(
                    NotificationErrorType.PROVIDER_ERROR, "웹 푸시 키가 설정되지 않았습니다.");
        }
        byte[] body =
                WebPushCrypto.encrypt(
                        json.getBytes(StandardCharsets.UTF_8),
                        subscription.getP256dh(),
                        subscription.getAuth());
        long exp = Instant.now().plus(VAPID_LIFETIME).getEpochSecond();
        HttpRequest request =
                HttpRequest.newBuilder(URI.create(subscription.getEndpoint()))
                        .timeout(Duration.ofSeconds(10))
                        .header(
                                "Authorization",
                                WebPushCrypto.vapidAuthorization(
                                        subscription.audience(),
                                        subject,
                                        exp,
                                        publicKey,
                                        privateKey))
                        .header("Content-Encoding", "aes128gcm")
                        .header("Content-Type", "application/octet-stream")
                        .header("TTL", String.valueOf(TTL_SECONDS))
                        .header("Urgency", "normal")
                        .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                        .build();
        int status;
        try {
            status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (IOException e) {
            throw new WebPushSendException(
                    NotificationErrorType.PROVIDER_ERROR,
                    "푸시 서버 연결 실패: " + e.getClass().getSimpleName());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WebPushSendException(NotificationErrorType.PROVIDER_ERROR, "푸시 발송이 중단됐습니다.");
        }
        if (status == 404 || status == 410) {
            return false;
        }
        if (status < 200 || status >= 300) {
            throw new WebPushSendException(
                    NotificationErrorType.PROVIDER_ERROR, "푸시 서버 응답 " + status);
        }
        return true;
    }
}
