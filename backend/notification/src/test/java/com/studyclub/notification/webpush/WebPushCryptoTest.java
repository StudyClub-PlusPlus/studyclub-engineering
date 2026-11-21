package com.studyclub.notification.webpush;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.util.Base64;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WebPushCryptoTest {

    // RFC 8291 Appendix A — 같은 입력이면 같은 바이트가 나와야 한다
    private static final String AS_PRIVATE = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    private static final String AS_PUBLIC =
            "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    private static final String UA_PUBLIC =
            "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
    private static final String AUTH = "BTBZMqHH6r4Tts7J_aSIgg";
    private static final String SALT = "DGv6ra1nlYgDCS1FRnbzlw";
    private static final String EXPECTED_BODY =
            "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN";

    @Test
    @DisplayName("RFC 8291 예제 값으로 암호화하면 예제 본문과 바이트가 같다")
    void encryptMatchesRfc8291() throws Exception {
        KeyPair asKeys =
                new KeyPair(
                        WebPushCrypto.publicKey(WebPushCrypto.decode(AS_PUBLIC)),
                        WebPushCrypto.privateKey(WebPushCrypto.decode(AS_PRIVATE)));

        byte[] body =
                WebPushCrypto.encrypt(
                        "When I grow up, I want to be a watermelon"
                                .getBytes(StandardCharsets.UTF_8),
                        WebPushCrypto.decode(UA_PUBLIC),
                        WebPushCrypto.decode(AUTH),
                        asKeys,
                        WebPushCrypto.decode(SALT));

        assertThat(WebPushCrypto.b64(body)).isEqualTo(EXPECTED_BODY);
    }

    @Test
    @DisplayName("VAPID 토큰은 공개키로 검증되는 ES256 서명을 단다")
    void vapidSignatureVerifies() throws Exception {
        String header =
                WebPushCrypto.vapidAuthorization(
                        "https://fcm.googleapis.com",
                        "mailto:ops@example.com",
                        1_900_000_000L,
                        AS_PUBLIC,
                        AS_PRIVATE);

        assertThat(header).startsWith("vapid t=").endsWith(", k=" + AS_PUBLIC);
        String jwt = header.substring("vapid t=".length(), header.indexOf(", k="));
        String[] parts = jwt.split("\\.");
        assertThat(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8))
                .contains("\"aud\":\"https://fcm.googleapis.com\"");

        Signature verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(WebPushCrypto.publicKey(WebPushCrypto.decode(AS_PUBLIC)));
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verifier.verify(Base64.getUrlDecoder().decode(parts[2]))).isTrue();
    }
}
