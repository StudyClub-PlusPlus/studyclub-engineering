package com.studyclub.notification.webpush;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import lombok.Getter;

/**
 * 브라우저 한 곳(기기·브라우저 조합)의 웹 푸시 구독 (specs/web-push/spec.md). 구독 주소({@code ENDPOINT})가 기기를 가리키는 열쇠라 같은
 * 주소로 다시 등록하면 새 행을 만들지 않고 이 행을 고쳐 쓴다 — 같은 기기에 알림이 두 번 가지 않게.
 */
@Entity
@Table(
        name = "WEB_PUSH_SUBSCRIPTION",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_web_push_subscription_endpoint_hash",
                        columnNames = "ENDPOINT_HASH"),
        indexes = @Index(name = "idx_web_push_subscription_account", columnList = "ACCOUNT_ID"))
@Getter
public class WebPushSubscription extends BaseEntity {

    static final int ENDPOINT_MAX = 1024;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID 참조(ACCOUNT, FK 없음). 다른 사람이 같은 브라우저로 로그인해 다시 등록하면 그 사람으로 바뀐다. */
    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "ENDPOINT", nullable = false, length = ENDPOINT_MAX)
    private String endpoint;

    /** 주소가 길어(최대 1024자) 유일 인덱스를 바로 걸 수 없어 SHA-256 으로 건다. */
    @Column(name = "ENDPOINT_HASH", nullable = false, length = 64)
    private String endpointHash;

    @Column(name = "P256DH", nullable = false, length = 128)
    private String p256dh;

    @Column(name = "AUTH", nullable = false, length = 64)
    private String auth;

    protected WebPushSubscription() {}

    private WebPushSubscription(Long accountId, String endpoint, String p256dh, String auth) {
        this.accountId = accountId;
        this.endpoint = endpoint;
        this.endpointHash = hash(endpoint);
        this.p256dh = p256dh;
        this.auth = auth;
    }

    public static WebPushSubscription register(
            Long accountId, String endpoint, String p256dh, String auth) {
        requirePushService(endpoint);
        return new WebPushSubscription(accountId, endpoint, p256dh, auth);
    }

    /** 같은 기기가 다시 구독했다 — 키가 바뀌었거나 다른 사람이 로그인했다. */
    public void renew(Long accountId, String p256dh, String auth) {
        this.accountId = accountId;
        this.p256dh = p256dh;
        this.auth = auth;
    }

    /** VAPID 토큰의 {@code aud} — 구독 주소의 출처. */
    public String audience() {
        URI uri = URI.create(endpoint);
        return uri.getScheme() + "://" + uri.getAuthority();
    }

    public static String hash(String endpoint) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(endpoint.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * 브라우저 회사의 푸시 서버 주소만 받는다. 서버가 이 주소로 요청을 보내므로, 아무 주소나 받으면 로그인한 누구나 우리 서버가 내부망을 찌르게 만들 수 있다
     * (SSRF). 새 브라우저가 다른 푸시 서버를 쓰면 여기에 더한다.
     */
    static final java.util.List<String> PUSH_SERVICE_HOSTS =
            java.util.List.of(
                    "fcm.googleapis.com", // Chrome · Edge(일부) · 삼성 인터넷
                    "push.services.mozilla.com", // Firefox
                    "push.apple.com", // Safari · iOS 홈 화면 앱
                    "notify.windows.com"); // Edge

    private static void requirePushService(String endpoint) {
        URI uri;
        try {
            uri = URI.create(endpoint);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("구독 주소 형식이 올바르지 않습니다.");
        }
        String host = uri.getHost();
        boolean known =
                host != null
                        && PUSH_SERVICE_HOSTS.stream()
                                .anyMatch(h -> host.equals(h) || host.endsWith("." + h));
        if (!"https".equals(uri.getScheme()) || uri.getPort() != -1 || !known) {
            throw new IllegalArgumentException("지원하지 않는 푸시 서버 주소입니다.");
        }
    }
}
