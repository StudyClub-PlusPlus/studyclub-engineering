package com.studyclub.api.auth;

import com.studyclub.api.auth.GoogleOAuthClient.GoogleUser;
import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import io.jsonwebtoken.Claims;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String PLATFORM_BACK_OFFICE = "BACK_OFFICE";

    private final AccountRepository accountRepository;
    private final GoogleOAuthClient googleOAuthClient;
    private final JwtService jwtService;

    @Value("${back-office.allowed-emails:}")
    private String allowedEmailsRaw;

    public AuthService(
            AccountRepository accountRepository,
            GoogleOAuthClient googleOAuthClient,
            JwtService jwtService) {
        this.accountRepository = accountRepository;
        this.googleOAuthClient = googleOAuthClient;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse socialLogin(String code, String platform, String redirectOverride) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "code 가 필요합니다.");
        }
        GoogleUser g = googleOAuthClient.exchange(code, redirectOverride);
        String email = g.email().toLowerCase();

        assertBackOfficePermitted(email, platform);

        // UNIQUE(NICKNAME) + VARCHAR(20) — 제공자 표시명을 그대로 넣으면 동명이인/길이에서 터진다.
        // 온보딩 전 임시값 account_<랜덤>(총 20자). 화면에는 안 보여주고 온보딩에서 확정한다.
        Account account =
                accountRepository
                        .findByEmail(email)
                        .orElseGet(
                                () ->
                                        accountRepository.save(
                                                new Account(
                                                        email,
                                                        uniqueTemporaryNickname(),
                                                        g.picture(),
                                                        SystemRole.MEMBER)));

        return issueFor(account);
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

    private AuthResponse issueFor(Account account) {
        String sub = String.valueOf(account.getId());
        return new AuthResponse(
                jwtService.issueAccess(sub, account.getEmail()),
                jwtService.issueRefresh(sub, account.getEmail()),
                jwtService.accessTtlSeconds(),
                jwtService.refreshTtlSeconds(),
                toView(account));
    }

    private AccountView toView(Account account) {
        return new AccountView(
                account.getId(),
                account.getEmail(),
                account.getNickname(),
                account.getProfileImgUrl(),
                account.getSystemRole().name(),
                String.valueOf(account.getCreatedAt()));
    }
}
