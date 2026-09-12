package com.studyclub.api.auth;

import com.studyclub.api.auth.GoogleOAuthClient.GoogleUser;
import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AccountView;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import io.jsonwebtoken.Claims;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String PLATFORM_BACK_OFFICE = "BACK_OFFICE";

    private final AccountRepository accountRepository;
    private final AccountRegistrar accountRegistrar;
    private final GoogleOAuthClient googleOAuthClient;
    private final JwtService jwtService;

    @Value("${back-office.allowed-emails:}")
    private String allowedEmailsRaw;

    public AuthService(
            AccountRepository accountRepository,
            AccountRegistrar accountRegistrar,
            GoogleOAuthClient googleOAuthClient,
            JwtService jwtService) {
        this.accountRepository = accountRepository;
        this.accountRegistrar = accountRegistrar;
        this.googleOAuthClient = googleOAuthClient;
        this.jwtService = jwtService;
    }

    // @Transactional 없음 — findOrRegister 가 실패한 트랜잭션을 버리고 새로 열어 재시도해야 한다.
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

    private Account findOrRegister(GoogleUser g, String email) {
        try {
            return accountRegistrar.findOrRegister(g, email);
        } catch (DataIntegrityViolationException e) {
            // 같은 sub 가 동시에 들어와 INSERT 가 겹친 경우 (스펙). 한 번 더 돌리면 분기 1 로 잡힌다.
            return accountRegistrar.findOrRegister(g, email);
        }
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
