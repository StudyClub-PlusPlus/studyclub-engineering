package com.studyclub.api.auth;

import com.studyclub.api.auth.GoogleOAuthClient.GoogleUser;
import com.studyclub.api.auth.dto.AuthDtos.AccessTokenResponse;
import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import com.studyclub.api.auth.dto.AuthDtos.UserView;
import io.jsonwebtoken.Claims;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private static final String PLATFORM_BACK_OFFICE = "BACK_OFFICE";

    private final UserRepository users;
    private final GoogleOAuthClient google;
    private final JwtService jwt;

    @Value("${back-office.allowed-emails:}")
    private String allowedEmailsRaw;

    public AuthService(UserRepository users, GoogleOAuthClient google, JwtService jwt) {
        this.users = users;
        this.google = google;
        this.jwt = jwt;
    }

    @Transactional
    public AuthResponse socialLogin(String code, String platform, String redirectOverride) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "code 가 필요합니다.");
        }
        GoogleUser g = google.exchange(code, redirectOverride);
        String email = g.email().toLowerCase();

        assertBackOfficePermitted(email, platform);

        User user = users.findByEmail(email).orElseGet(() ->
                users.save(new User(email, g.name(), g.picture(), g.sub(), Role.STUDENT)));

        return issueFor(user);
    }

    @Transactional(readOnly = true)
    public UserView me(String email) {
        User user = users.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유저를 찾을 수 없습니다."));
        return toView(user);
    }

    public AccessTokenResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "refreshToken 이 필요합니다.");
        }
        try {
            Claims c = jwt.parse(refreshToken);
            return new AccessTokenResponse(jwt.issueAccess(c.getSubject(), c.get("email", String.class)));
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "유효하지 않은 refresh token 입니다.");
        }
    }

    /** platform=BACK_OFFICE 로그인은 allowlist 이메일만 허용 (zapp assertBackOfficePermitted 이식). */
    private void assertBackOfficePermitted(String email, String platform) {
        if (!PLATFORM_BACK_OFFICE.equalsIgnoreCase(platform)) {
            return;
        }
        List<String> allowed = Arrays.stream(allowedEmailsRaw.split(","))
                .map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isBlank())
                .toList();
        if (!allowed.contains(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "백오피스 접근이 허용되지 않은 계정입니다.");
        }
    }

    private AuthResponse issueFor(User user) {
        String sub = String.valueOf(user.getId());
        return new AuthResponse(
                jwt.issueAccess(sub, user.getEmail()),
                jwt.issueRefresh(sub, user.getEmail()),
                jwt.accessTtlSeconds(),
                jwt.refreshTtlSeconds(),
                toView(user));
    }

    private UserView toView(User user) {
        return new UserView(user.getId(), user.getEmail(), user.getName(), user.getPicture(),
                user.getRole().name(), String.valueOf(user.getCreatedAt()));
    }
}
