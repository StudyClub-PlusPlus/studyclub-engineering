package com.studyclub.api.auth.security;

import com.studyclub.api.auth.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Authorization: Bearer <access> 를 파싱해 email 을 principal 로 하는 인증을 세팅. */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    public JwtAuthFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = header.substring(7);
            try {
                Claims c = jwt.parse(token);
                String email = c.get("email", String.class);
                if (email != null && !email.isBlank()) {
                    var auth = new UsernamePasswordAuthenticationToken(email, null, List.of());
                    auth.setDetails(c.getSubject());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            } catch (RuntimeException ignored) {
                // 유효하지 않은 토큰 → 인증 미설정 (이후 authorize 단계에서 401)
            }
        }
        chain.doFilter(request, response);
    }
}
