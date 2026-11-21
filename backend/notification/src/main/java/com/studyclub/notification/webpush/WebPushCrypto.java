package com.studyclub.notification.webpush;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 웹 푸시 암호화(RFC 8291 · aes128gcm, RFC 8188)와 VAPID 서명(RFC 8292)을 JDK 표준만으로 한다 — 외부 라이브러리를 들이지 않는다
 * (AGENT.md). 정답 검증은 RFC 8291 부록의 예제 값으로 한다(WebPushCryptoTest).
 */
public final class WebPushCrypto {

    private static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64URL_DECODER = Base64.getUrlDecoder();
    private static final ECParameterSpec P256 = p256();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int RECORD_SIZE = 4096;

    private WebPushCrypto() {}

    /** 매번 새 임시 키·salt 로 암호화한다. 결과는 요청 본문 그대로다(헤더 + 암호문). */
    public static byte[] encrypt(byte[] plaintext, String uaPublicB64, String authSecretB64) {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
            gen.initialize(new ECGenParameterSpec("secp256r1"));
            byte[] salt = new byte[16];
            RANDOM.nextBytes(salt);
            return encrypt(
                    plaintext,
                    decode(uaPublicB64),
                    decode(authSecretB64),
                    gen.generateKeyPair(),
                    salt);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("웹 푸시 암호화 실패", e);
        }
    }

    /** 결정적 버전 — 임시 키와 salt 를 밖에서 받는다. 테스트가 RFC 예제와 바이트 단위로 대조한다. */
    static byte[] encrypt(
            byte[] plaintext, byte[] uaPublic, byte[] authSecret, KeyPair asKeys, byte[] salt)
            throws GeneralSecurityException {
        byte[] asPublic = encodePoint((ECPublicKey) asKeys.getPublic());

        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(asKeys.getPrivate());
        agreement.doPhase(publicKey(uaPublic), true);
        byte[] ecdhSecret = agreement.generateSecret();

        byte[] keyInfo =
                concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic);
        byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
        byte[] cek =
                hkdf(
                        salt,
                        ikm,
                        "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII),
                        16);
        byte[] nonce =
                hkdf(
                        salt,
                        ikm,
                        "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII),
                        12);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(
                Cipher.ENCRYPT_MODE,
                new SecretKeySpec(cek, "AES"),
                new GCMParameterSpec(128, nonce));
        // 레코드 하나뿐이라 끝 레코드 구분자 0x02 를 붙인다. 패딩은 넣지 않는다.
        byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[] {2}));

        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length);
        header.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic);
        return concat(header.array(), ciphertext);
    }

    /**
     * VAPID {@code Authorization} 헤더 값. {@code aud} 는 구독 주소의 출처(scheme://host)다.
     *
     * @param expiresAtEpochSeconds 24시간을 넘기면 푸시 서버가 거절한다
     */
    public static String vapidAuthorization(
            String audience,
            String subject,
            long expiresAtEpochSeconds,
            String publicKeyB64,
            String privateKeyB64) {
        try {
            String header =
                    b64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
            String claims =
                    b64(
                            ("{\"aud\":\""
                                            + audience
                                            + "\",\"exp\":"
                                            + expiresAtEpochSeconds
                                            + ",\"sub\":\""
                                            + subject
                                            + "\"}")
                                    .getBytes(StandardCharsets.UTF_8));
            String unsigned = header + "." + claims;
            Signature signer = Signature.getInstance("SHA256withECDSAinP1363Format");
            signer.initSign(privateKey(decode(privateKeyB64)));
            signer.update(unsigned.getBytes(StandardCharsets.US_ASCII));
            return "vapid t=" + unsigned + "." + b64(signer.sign()) + ", k=" + publicKeyB64;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("VAPID 서명 실패", e);
        }
    }

    /** RFC 5869 HKDF(SHA-256). 출력이 32바이트 이하라 Expand 는 한 블록이면 된다. */
    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length)
            throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    static ECPublicKey publicKey(byte[] uncompressed) throws GeneralSecurityException {
        if (uncompressed.length != 65 || uncompressed[0] != 4) {
            throw new GeneralSecurityException("P-256 비압축 공개키가 아닙니다");
        }
        ECPoint point =
                new ECPoint(
                        new BigInteger(1, Arrays.copyOfRange(uncompressed, 1, 33)),
                        new BigInteger(1, Arrays.copyOfRange(uncompressed, 33, 65)));
        return (ECPublicKey)
                KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point, P256));
    }

    static ECPrivateKey privateKey(byte[] raw) throws GeneralSecurityException {
        return (ECPrivateKey)
                KeyFactory.getInstance("EC")
                        .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), P256));
    }

    static byte[] encodePoint(ECPublicKey key) {
        return concat(
                new byte[] {4}, fixed32(key.getW().getAffineX()), fixed32(key.getW().getAffineY()));
    }

    static byte[] decode(String b64url) {
        return B64URL_DECODER.decode(b64url.replace('+', '-').replace('/', '_').replace("=", ""));
    }

    static String b64(byte[] bytes) {
        return B64URL.encodeToString(bytes);
    }

    private static byte[] fixed32(BigInteger value) {
        byte[] bytes = value.toByteArray();
        byte[] out = new byte[32];
        int copy = Math.min(bytes.length, 32);
        System.arraycopy(bytes, bytes.length - copy, out, 32 - copy, copy);
        return out;
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.writeBytes(part);
        }
        return out.toByteArray();
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            return params.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new ExceptionInInitializerError(e);
        }
    }
}
