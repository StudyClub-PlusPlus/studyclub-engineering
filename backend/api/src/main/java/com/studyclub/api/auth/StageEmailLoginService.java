package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.EmailSignupCode;
import com.studyclub.domain.account.EmailSignupCodeRepository;
import com.studyclub.domain.account.Issuer;
import com.studyclub.notification.mail.MailCategory;
import com.studyclub.notification.mail.MailClient;
import com.studyclub.notification.mail.MailSendException;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * stage 테스트 로그인 — 메뉴에 없는 이메일 가입(메일 코드) · 비밀번호 로그인 (specs/stage-email-login). 운영에서는 세 API 가 모두 404
 * 다.
 *
 * <p>코드: 6자리 · 10분 · 5번 틀리면 폐기 · 한 번만 · 재요청 60초 / 하루 10번. HMAC 만 저장하고, stage(code-copy)에서만 평문 사본을
 * 남겨 에이전트가 DB 에서 읽는다. 메일은 아직 보내지 않는다 — 코드는 사본으로만 읽는다.
 */
@Slf4j
@Service
public class StageEmailLoginService {

    static final Duration CODE_TTL = Duration.ofMinutes(10);
    static final int MAX_ATTEMPTS = 5;
    static final Duration RESEND_GAP = Duration.ofSeconds(60);
    static final int DAILY_LIMIT = 10;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern RESERVED_TLD =
            Pattern.compile("\\.(test|example|invalid|localhost)$");

    private final EmailSignupCodeRepository codes;
    private final AccountIdentityRepository identities;
    private final AccountRepository accounts;
    private final AccountRegistrar registrar;
    private final AuthService authService;
    private final MailClient mailClient;
    private final PasswordEncoder passwordEncoder =
            PasswordEncoderFactories.createDelegatingPasswordEncoder();
    private final boolean enabled;
    private final boolean codeCopy;
    private final boolean production;
    private final byte[] hmacKey;

    public StageEmailLoginService(
            EmailSignupCodeRepository codes,
            AccountIdentityRepository identities,
            AccountRepository accounts,
            AccountRegistrar registrar,
            AuthService authService,
            MailClient mailClient,
            @Value("${stage-login.enabled:false}") boolean enabled,
            @Value("${stage-login.code-copy:false}") boolean codeCopy,
            @Value("${stage-login.app-env:local}") String appEnv,
            @Value("${jwt.secret}") String secret) {
        this.codes = codes;
        this.identities = identities;
        this.accounts = accounts;
        this.registrar = registrar;
        this.authService = authService;
        this.mailClient = mailClient;
        this.enabled = enabled;
        this.codeCopy = codeCopy;
        this.production = "production".equals(appEnv.trim());
        this.hmacKey = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** 운영에서 평문 사본 스위치가 켜져 있으면 뜨지 않는다 — 설정 실수가 코드 유출로 이어지지 않게 */
    @PostConstruct
    void refuseCodeCopyInProduction() {
        if (production && codeCopy) {
            throw new IllegalStateException("EMAIL_CODE_COPY 는 운영(APP_ENV=production)에서 켤 수 없다");
        }
    }

    private void assertEnabled() {
        if (!enabled) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
    }

    /** 가입 1/2 — 코드를 만든다. 구글 · 애플로 가입한 주소면 409 (계정을 합치지 않는다) */
    @Transactional
    public void requestCode(String rawEmail) {
        assertEnabled();
        String email = normalize(rawEmail);
        assertNotSocial(email);
        Instant now = Instant.now();
        codes.findFirstByEmailOrderByIdDesc(email)
                .filter(last -> last.getCreatedAt().isAfter(now.minus(RESEND_GAP)))
                .ifPresent(
                        last -> {
                            long wait =
                                    RESEND_GAP.getSeconds()
                                            - Duration.between(last.getCreatedAt(), now)
                                                    .getSeconds();
                            throw new BusinessException(
                                    ErrorCode.TOO_MANY_REQUESTS, wait + "초 뒤에 다시 받을 수 있어요.");
                        });
        if (codes.countByEmailAndCreatedAtAfter(email, now.minus(Duration.ofDays(1)))
                >= DAILY_LIMIT) {
            throw new BusinessException(
                    ErrorCode.TOO_MANY_REQUESTS, "오늘은 더 받을 수 없어요. 내일 다시 해 주세요.");
        }
        // ponytail: IP 당 시간 한도 없음 — stage 전용. 운영에 열 일이 생기면 붙인다
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        codes.save(
                new EmailSignupCode(
                        email, hmac(email, code), codeCopy ? code : null, now.plus(CODE_TTL)));
        sendCode(email, code);
    }

    /**
     * 메일 발송. 예약 도메인(.test · .example · .invalid · .localhost — RFC 2606/6761)은 보내지 않는다 — 에이전트 테스터
     * 주소라 반송만 쌓여 발신 평판이 떨어진다. 사본이 없는데(운영) 못 보내면 503 — 트랜잭션이 롤백돼 코드 행도 횟수도 남지 않는다.
     */
    private void sendCode(String email, String code) {
        if (RESERVED_TLD.matcher(email).find()) {
            return;
        }
        try {
            mailClient.send(
                    MailCategory.NOTIFY,
                    email,
                    "[StudyClub] 테스트 계정 가입 코드 " + code,
                    "<p>StudyClub 테스트 계정 가입 코드예요.</p>"
                            + "<p style=\"font-size:28px;font-weight:700;letter-spacing:6px\">"
                            + code
                            + "</p><p>10분 동안 한 번만 쓸 수 있어요. 직접 요청하지 않았다면 이 메일은 무시해 주세요.</p>");
        } catch (MailSendException e) {
            log.warn("가입 코드 메일 실패 type={}", e.errorType()); // 주소는 남기지 않는다
            if (!codeCopy) {
                throw new BusinessException(
                        ErrorCode.EXTERNAL_SERVICE_ERROR, "메일을 보내지 못했어요. 잠시 뒤 다시 해 주세요.");
            }
        }
    }

    /** 가입 2/2 — 코드 확인 + 비밀번호 정하기. 맨 마지막 코드만 본다, 한 번만 쓴다, 5번 틀리면 버린다 */
    public void verify(String rawEmail, String code, String password) {
        assertEnabled();
        String email = normalize(rawEmail);
        Instant now = Instant.now();
        EmailSignupCode row =
                codes.findFirstByEmailOrderByIdDesc(email)
                        .filter(c -> !c.isDead(now, MAX_ATTEMPTS))
                        .orElseThrow(() -> new BusinessException(ErrorCode.EMAIL_CODE_EXPIRED));
        boolean ok =
                MessageDigest.isEqual(
                        hmac(email, code).getBytes(StandardCharsets.UTF_8),
                        row.getCodeHash().getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            // 동시에 틀려도 5번을 넘지 않게 조건부로 올린다
            int left = MAX_ATTEMPTS - row.getAttempts() - 1;
            if (codes.addAttempt(row.getId(), MAX_ATTEMPTS) == 0 || left <= 0) {
                throw new BusinessException(ErrorCode.EMAIL_CODE_EXPIRED);
            }
            throw new BusinessException(
                    ErrorCode.EMAIL_CODE_WRONG, "코드가 맞지 않아요. " + left + "번 더 넣을 수 있어요.");
        }
        if (codes.markUsed(row.getId(), now) == 0) {
            throw new BusinessException(ErrorCode.EMAIL_CODE_EXPIRED);
        }
        setPassword(email, password);
    }

    /** 계정 · EMAIL 수단 찾거나 만들기는 소셜 가입과 같은 길(AccountRegistrar) — 같은 이메일의 소셜 계정이면 거기서 409 */
    private void setPassword(String email, String password) {
        SocialUser asEmail = new SocialUser(Issuer.EMAIL, email, email, true, null, null, null);
        try {
            registrar.findOrRegister(asEmail, email);
        } catch (DataIntegrityViolationException e) {
            registrar.findOrRegister(asEmail, email); // 동시 가입 — 소셜 로그인과 같은 재시도
        }
        AccountIdentity identity =
                identities.findByIssuerAndProviderAccountId(Issuer.EMAIL, email).orElseThrow();
        identity.changePassword(passwordEncoder.encode(password));
        identities.save(identity); // verify 는 트랜잭션 밖(재시도 때문) — 명시 저장
    }

    /** 비밀번호 로그인 — 소셜 로그인과 같은 토큰 · 같은 응답 */
    @Transactional
    public AuthResponse login(String rawEmail, String password) {
        assertEnabled();
        String email = normalize(rawEmail);
        AccountIdentity identity =
                identities
                        .findByIssuerAndProviderAccountId(Issuer.EMAIL, email)
                        .filter(
                                i ->
                                        i.getPasswordHash() != null
                                                && passwordEncoder.matches(
                                                        password, i.getPasswordHash()))
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.UNAUTHORIZED, "이메일 또는 비밀번호가 맞지 않아요."));
        identity.recordLogin(Instant.now());
        Account account = accounts.findById(identity.getAccountId()).orElseThrow();
        return authService.issueFor(account, null);
    }

    private void assertNotSocial(String email) {
        accounts.findByEmail(email)
                .filter(
                        a ->
                                identities
                                        .findByIssuerAndProviderAccountId(Issuer.EMAIL, email)
                                        .isEmpty())
                .ifPresent(
                        a -> {
                            throw new BusinessException(
                                    ErrorCode.ACCOUNT_LINK_REQUIRED,
                                    "이 메일은 소셜 로그인으로 가입돼 있어요. 그 방법으로 로그인해 주세요.");
                        });
    }

    private String hmac(String email, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacKey, "HmacSHA256"));
            return HexFormat.of()
                    .formatHex(mac.doFinal((email + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String normalize(String email) {
        if (email == null || email.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "메일을 넣어 주세요.");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
