package com.studyclub.api.analytics;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AnalyticsIdentity {
    private final String key;
    private final String version;
    private final String environment;

    public AnalyticsIdentity(
            @Value("${analytics.hmac-key:}") String key,
            @Value("${analytics.hmac-key-version:v1}") String version,
            @Value("${ops.env:local}") String environment) {
        this.key = key;
        this.version = version;
        this.environment = environment;
        if (!key.isBlank()
                && (key.getBytes(StandardCharsets.UTF_8).length < 32
                        || !version.matches("[a-zA-Z0-9_-]{1,20}"))) {
            throw new IllegalArgumentException("Analytics HMAC configuration invalid");
        }
    }

    public boolean configured() {
        return !key.isBlank();
    }

    public String version() {
        return version;
    }

    public String forAccount(Long accountId) {
        if (!configured()) throw new IllegalStateException("Analytics HMAC unavailable");
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return version
                    + "_"
                    + HexFormat.of()
                            .formatHex(
                                    mac.doFinal(
                                            ("studyclub:" + environment + ":" + accountId)
                                                    .getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }

    public static String serverClientId(String userId) {
        // GA client_id의 숫자.숫자 형식. 원문 회원번호를 포함하지 않는다.
        String hex = userId.substring(userId.length() - 64);
        return Long.toUnsignedString(Long.parseUnsignedLong(hex.substring(0, 16), 16))
                + "."
                + Long.toUnsignedString(Long.parseUnsignedLong(hex.substring(16, 32), 16));
    }
}
