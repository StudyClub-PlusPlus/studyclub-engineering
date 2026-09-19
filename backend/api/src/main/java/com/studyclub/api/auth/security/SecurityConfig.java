package com.studyclub.api.auth.security;

import com.studyclub.api.auth.JwtService;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.autoconfigure.web.server.ConditionalOnManagementPort;
import org.springframework.boot.actuate.autoconfigure.web.server.ManagementPortType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtService jwtService;
    private final ObjectMapper objectMapper;

    /** 콤마 구분 허용 오리진 (프론트 dev + prod 도메인). */
    @Value("${cors.allowed-origins:http://localhost:4700,http://localhost:4701}")
    private String allowedOrigins;

    public SecurityConfig(JwtService jwtService, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.objectMapper = objectMapper;
    }

    /** 관리 포트 전용 체인. 조건 없이 경로 매처만 쓰면 포트가 합쳐질 때 앱 포트에서도 actuator 가 열린다. */
    @Bean
    @Order(0)
    @ConditionalOnManagementPort(ManagementPortType.DIFFERENT)
    SecurityFilterChain managementChain(HttpSecurity http) throws Exception {
        http.securityMatcher("/actuator/**")
                .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .csrf(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(
                                                "/",
                                                "/error",
                                                "/api/health",
                                                "/api/studies",
                                                "/api/studies/*",
                                                // API 문서 — 스펙(springdoc) + Scalar UI.
                                                // /scalar/** 까지 열어야 한다: UI 페이지가 /scalar/scalar.js 를
                                                // 로드하는데
                                                // 이게 막히면 페이지 자체는 200 이고 브라우저에서 빈 화면으로만 드러난다.
                                                "/v3/api-docs/**",
                                                "/scalar",
                                                "/scalar/**",
                                                "/auth/social-login",
                                                "/auth/refresh")
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated())
                // 미인증 → 403(기본) 대신 401 + ErrorResponse 바디. ERROR 디스패치가 막히지 않도록 /error 는 위에서
                // permitAll.
                .exceptionHandling(
                        ex ->
                                ex.authenticationEntryPoint(
                                        new JsonAuthenticationEntryPoint(objectMapper)))
                .addFilterBefore(
                        new JwtAuthFilter(jwtService), UsernamePasswordAuthenticationFilter.class);
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
