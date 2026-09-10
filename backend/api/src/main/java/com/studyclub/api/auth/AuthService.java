package com.studyclub.api.auth;

import com.studyclub.api.auth.GoogleOAuthClient.GoogleUser;
import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountIdentity;
import com.studyclub.domain.account.AccountIdentityRepository;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.Issuer;
import com.studyclub.domain.account.SystemRole;
import io.jsonwebtoken.Claims;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String PLATFORM_BACK_OFFICE = "BACK_OFFICE";

    private final AccountRepository accountRepository;
    private final AccountIdentityRepository accountIdentityRepository;
    private final GoogleOAuthClient googleOAuthClient;
    private final JwtService jwtService;

    @Value("${back-office.allowed-emails:}")
    private String allowedEmailsRaw;

    public AuthService(
            AccountRepository accountRepository,
            AccountIdentityRepository accountIdentityRepository,
            GoogleOAuthClient googleOAuthClient,
            JwtService jwtService) {
        this.accountRepository = accountRepository;
        this.accountIdentityRepository = accountIdentityRepository;
        this.googleOAuthClient = googleOAuthClient;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse socialLogin(String code, String platform, String redirectOverride) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "code 가 필요합니다.");
        }
        GoogleUser g = googleOAuthClient.exchange(code, redirectOverride);

        // 특이 케이스 — Gmail 은 항상 검증돼 있고, 외부 이메일로 만든 구글 계정 중 소유 확인을 안 끝낸 경우만 여기 걸린다.
        // 검증 안 된 이메일은 남의 것일 수 있으니 계정을 찾거나 만들지 않고 가입 자체를 안 받는다 (스펙: 가입 불가).
        if (g.email() == null || g.email().isBlank() || !g.emailVerified()) {
            throw new BusinessException(
                    ErrorCode.SOCIAL_LOGIN_EMAIL_REQUIRED, "구글 계정의 이메일이 확인되지 않았습니다.");
        }
        String email = g.email().toLowerCase();

        assertBackOfficePermitted(email, platform);

        Account account = findOrRegister(g, email);

        // suggestedNickname 은 이번 로그인의 구글 name. DB 에 넣지 않고 응답에만 실린다 (스펙).
        return issueFor(account, g.name());
    }

    /**
     * 사람을 찾는 키는 {@code (GOOGLE, sub)} 다. 이메일은 바뀔 수 있고 제공자가 여럿일 수 있어서 키로 못 쓴다. 이메일은 "이미 있는 사람이 다른
     * 수단으로 들어왔나" 충돌 감지에만 쓴다.
     *
     * @param email 소문자 정규화된 이메일 (조회·충돌 감지용). 제공자 원본은 {@code g.email()}
     */
    private Account findOrRegister(GoogleUser g, String email) {
        Optional<AccountIdentity> existing =
                accountIdentityRepository.findByIssuerAndProviderAccountId(Issuer.GOOGLE, g.sub());

        // 분기 1 — 아는 사람: 마지막 로그인 시각만 갱신. @Transactional 안이라 save() 없이 dirty checking 으로 반영된다.
        if (existing.isPresent()) {
            AccountIdentity identity = existing.get();
            identity.recordLogin(Instant.now());
            return accountRepository
                    .findById(identity.getAccountId())
                    // FK ON DELETE CASCADE 라 이론상 불가능. 그래도 조용히 넘기지 않고 500 으로 드러낸다.
                    .orElseThrow(
                            () ->
                                    new IllegalStateException(
                                            "ACCOUNT_IDENTITY 는 있는데 ACCOUNT 가 없음: "
                                                    + identity.getAccountId()));
        }

        // 분기 2 — 모르는 sub 인데 같은 이메일 계정이 있음: 새 계정을 만들면 한 사람이 계정 둘.
        // 스펙은 409 + 아무것도 생성·발급하지 않음.
        if (accountRepository.findByEmail(email).isPresent()) {
            throw new BusinessException(ErrorCode.ACCOUNT_LINK_REQUIRED, "이미 가입된 이메일입니다.");
        }

        // 분기 3 — 완전 신규: ACCOUNT + ACCOUNT_IDENTITY 를 한 트랜잭션에 생성.
        // UNIQUE(NICKNAME) + VARCHAR(20) — 제공자 표시명을 그대로 넣으면 동명이인/길이에서 터진다.
        // 온보딩 전 임시값 account_<랜덤>(총 20자). 화면에는 안 보여주고 온보딩에서 확정한다.
        Account account =
                accountRepository.save(
                        new Account(
                                email, uniqueTemporaryNickname(), g.picture(), SystemRole.MEMBER));
        // PROVIDER_EMAIL 은 제공자가 준 원본 그대로. 정규화값은 ACCOUNT.EMAIL 에 있다.
        accountIdentityRepository.save(
                new AccountIdentity(
                        account.getId(), Issuer.GOOGLE, g.sub(), g.email(), Instant.now()));
        return account;
    }

    /** {@code account_}(8) + 12 hex = 20자. 충돌 시 재생성. */
    String uniqueTemporaryNickname() {
        for (int i = 0; i < 5; i++) {
            String candidate =
                    "account_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            if (!accountRepository.existsByNickname(candidate)) {
                return candidate;
            }
        }
        throw new BusinessException(ErrorCode.CONFLICT, "임시 닉네임을 생성하지 못했습니다.");
    }

    @Transactional(readOnly = true)
    public AccountView me(String email) {
        Account account =
                accountRepository
                        .findByEmail(email.toLowerCase())
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
        return toView(account);
    }

    public AccessTokenResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "refreshToken 이 필요합니다.");
        }
        try {
            Claims c = jwtService.parse(refreshToken);
            return new AccessTokenResponse(
                    jwtService.issueAccess(c.getSubject(), c.get("email", String.class)));
        } catch (RuntimeException e) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "유효하지 않은 refresh token 입니다.");
        }
    }

    /** platform=BACK_OFFICE 로그인은 allowlist 이메일만 허용 (zapp assertBackOfficePermitted 이식). */
    private void assertBackOfficePermitted(String email, String platform) {
        if (!PLATFORM_BACK_OFFICE.equalsIgnoreCase(platform)) {
            return;
        }
        List<String> allowed =
                Arrays.stream(allowedEmailsRaw.split(","))
                        .map(s -> s.trim().toLowerCase())
                        .filter(s -> !s.isBlank())
                        .toList();
        if (!allowed.contains(email)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "백오피스 접근이 허용되지 않은 계정입니다.");
        }
    }

    private AuthResponse issueFor(Account account, String suggestedNickname) {
        String sub = String.valueOf(account.getId());
        return new AuthResponse(
                jwtService.issueAccess(sub, account.getEmail()),
                jwtService.issueRefresh(sub, account.getEmail()),
                jwtService.accessTtlSeconds(),
                jwtService.refreshTtlSeconds(),
                toView(account),
                suggestedNickname);
    }

    private AccountView toView(Account account) {
        return AccountView.from(account);
    }
}
