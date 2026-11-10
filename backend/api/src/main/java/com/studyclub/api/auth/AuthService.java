package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.RefreshToken;
import com.studyclub.domain.account.RefreshTokenRepository;
import io.jsonwebtoken.Claims;
import java.time.Instant;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String PLATFORM_BACK_OFFICE = "BACK_OFFICE";
    private static final String PROVIDER_APPLE = "apple";

    private final AccountRepository accountRepository;
    private final AccountRegistrar accountRegistrar;
    private final GoogleOAuthClient googleOAuthClient;
    private final AppleOAuthClient appleOAuthClient;
    private final JwtService jwtService;
    private final RefreshTokenRepository refreshTokenRepository;

    public AuthService(
            AccountRepository accountRepository,
            AccountRegistrar accountRegistrar,
            GoogleOAuthClient googleOAuthClient,
            AppleOAuthClient appleOAuthClient,
            JwtService jwtService,
            RefreshTokenRepository refreshTokenRepository) {
        this.accountRepository = accountRepository;
        this.accountRegistrar = accountRegistrar;
        this.googleOAuthClient = googleOAuthClient;
        this.appleOAuthClient = appleOAuthClient;
        this.jwtService = jwtService;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    // @Transactional 없음 — findOrRegister 가 실패한 트랜잭션을 버리고 새로 열어 재시도해야 한다.
    /**
     * @param provider {@code google}(생략 포함) 또는 {@code apple}
     * @param redirectOverride 구글: null 이면 웹 콜백, iOS 는 빈 문자열. 애플: 사이트는 콜백, iOS 는 null
     * @param name 애플만 — 앱이 첫 인가에서 받은 이름. 애플은 이름을 그때 한 번만 준다
     */
    public AuthResponse socialLogin(
            String code, String provider, String platform, String redirectOverride, String name) {
        if (code == null || code.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "code 가 필요합니다.");
        }
        boolean apple = PROVIDER_APPLE.equalsIgnoreCase(provider);
        SocialUser g =
                apple
                        ? appleOAuthClient.exchange(code, redirectOverride)
                        : googleOAuthClient.exchange(code, redirectOverride);

        // 특이 케이스 — Gmail 은 항상 검증돼 있고, 외부 이메일로 만든 구글 계정 중 소유 확인을 안 끝낸 경우만 여기 걸린다.
        // 검증 안 된 이메일은 남의 것일 수 있으니 계정을 찾거나 만들지 않고 가입 자체를 안 받는다 (스펙: 가입 불가).
        if (g.email() == null || g.email().isBlank() || !g.emailVerified()) {
            throw new BusinessException(
                    ErrorCode.SOCIAL_LOGIN_EMAIL_REQUIRED, "소셜 계정의 이메일이 확인되지 않았습니다.");
        }
        String email = g.email().toLowerCase();

        // 백오피스는 ADMIN 만, 백오피스에서는 가입이 안되기 때문에 findAdmin 만 호출한다.
        Account account;
        if (PLATFORM_BACK_OFFICE.equalsIgnoreCase(platform)) {
            account = accountRegistrar.findAdmin(g);
        } else {
            account = findOrRegister(g, email);
        }

        // suggestedNickname 은 이번 로그인의 제공자 이름. DB 에 넣지 않고 응답에만 실린다 (스펙).
        return issueFor(account, apple ? name : g.name());
    }

    private Account findOrRegister(SocialUser g, String email) {
        try {
            return accountRegistrar.findOrRegister(g, email);
        } catch (DataIntegrityViolationException e) {
            // 같은 sub 가 동시에 들어와 INSERT 가 겹친 경우 (스펙). 한 번 더 돌리면 분기 1 로 잡힌다.
            return accountRegistrar.findOrRegister(g, email);
        }
    }

    @Transactional(readOnly = true)
    public AccessTokenResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "refreshToken 이 필요합니다.");
        }
        Claims c;
        Long accountId;
        try {
            c = jwtService.parseRefresh(refreshToken);
            accountId = Long.valueOf(c.getSubject());
        } catch (RuntimeException e) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "유효하지 않은 refresh token 입니다.");
        }
        // 로그아웃·탈퇴로 무효화된 토큰은 DB 에 행이 없다.
        String hash = JwtService.tokenHash(refreshToken);
        if (!refreshTokenRepository.findByTokenHash(hash).isPresent()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "유효하지 않은 refresh token 입니다.");
        }
        // 탈퇴한 계정의 refresh token 은 서명·만료가 유효해도 새 access token 을 받지 못하게 한다.
        if (!accountRepository.existsById(accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "유효하지 않은 refresh token 입니다.");
        }
        return new AccessTokenResponse(
                jwtService.issueAccess(c.getSubject(), c.get("email", String.class)),
                jwtService.accessTtlSeconds());
    }

    /**
     * 로그아웃 — refresh token 을 DB 에서 삭제해 무효화한다. 토큰이 이미 없거나 파싱 불가인 경우는 조용히 넘긴다 (멱등). 쿠키 삭제는
     * 호출자(Next.js route)가 담당한다.
     */
    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.deleteByTokenHash(JwtService.tokenHash(refreshToken));
    }

    private AuthResponse issueFor(Account account, String suggestedNickname) {
        String sub = String.valueOf(account.getId());
        String refreshToken = jwtService.issueRefresh(sub, account.getEmail());
        Instant expiresAt = Instant.now().plusSeconds(jwtService.refreshTtlSeconds());
        refreshTokenRepository.save(
                new RefreshToken(JwtService.tokenHash(refreshToken), account.getId(), expiresAt));
        return new AuthResponse(
                jwtService.issueAccess(sub, account.getEmail()),
                refreshToken,
                jwtService.accessTtlSeconds(),
                jwtService.refreshTtlSeconds(),
                toView(account),
                suggestedNickname);
    }

    private AccountView toView(Account account) {
        return AccountView.from(account);
    }
}
