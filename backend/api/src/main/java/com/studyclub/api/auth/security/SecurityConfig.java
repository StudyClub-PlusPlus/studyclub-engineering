package com.studyclub.api.auth.security;

import tools.jackson.databind.ObjectMapper;
import com.studyclub.api.auth.JwtService;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtService jwt;
    private final ObjectMapper objectMapper;

    /** 콤마 구분 허용 오리진 (프론트 dev + prod 도메인). */
    @Value("${cors.allowed-origins:http://localhost:4700,http://localhost:4701}")
    private String allowedOrigins;

    public SecurityConfig(JwtService jwt, ObjectMapper objectMapper) {
        this.jwt = jwt;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/",
                                "/error",
                                "/api/health",
                                "/actuator/**",
                                "/api/studies",
                                // API 문서 — 스펙(springdoc) + Scalar UI.
                                // /scalar/** 까지 열어야 한다: UI 페이지가 /scalar/scalar.js 를 로드하는데
                                // 이게 막히면 페이지 자체는 200 이고 브라우저에서 빈 화면으로만 드러난다.
                                "/v3/api-docs/**",
                                "/scalar",
                                "/scalar/**",
                                "/auth/social-login",
                                "/auth/refresh")
                        .permitAll()
                        .anyRequest().authenticated())
                // 미인증 → 403(기본) 대신 401 + ErrorResponse 바디. ERROR 디스패치가 막히지 않도록 /error 는 위에서 permitAll.
                .exceptionHandling(ex -> ex.authenticationEntryPoint(new JsonAuthenticationEntryPoint(objectMapper)))
                .addFilterBefore(new JwtAuthFilter(jwt), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
