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

    /**
     * 관리 포트(actuator) 전용 체인. 관리 포트는 호스트에 publish 하지 않으므로 permitAll 이어도 외부에서 도달할 수 없다 — 여기서 인증을 걸면
     * Prometheus 스크랩(Task 6)이 401 로 막힌다.
     *
     * <p>{@code EndpointRequest.toAnyEndpoint()} 대신 경로 패턴을 쓴다: 그 매처는 이 빈이 정의된 (메인)
     * ApplicationContext 에 바인딩되는데, {@code management.server.port} 가 앱 포트와 다르면 actuator 엔드포인트는 별도의
     * 관리용 자식 ApplicationContext 에만 매핑되어 {@code PathMappedEndpoints} 를 못 찾고 매치 자체가 되지 않는다 (관리 포트 요청이
     * 이 체인이 아니라 아래 {@code filterChain} 의 {@code anyRequest().authenticated()} 로 떨어져 401 이 났다 —
     * 확인함).
     *
     * <p><b>{@code @ConditionalOnManagementPort(DIFFERENT)} 가 핵심 방어선이다.</b> 경로 매처 만으로는 포트를 구분하지 못한다
     * — 이 빈은 어차피 메인/관리 컨텍스트 양쪽 모두에 적용되므로, 포트 조건 없이 permitAll 만 걸면 <b>앱 포트에도 그대로 적용된다.</b> 나중에 누군가
     * {@code management.server.port} 를 지우면(={@link ManagementPortType#SAME}) actuator 가 앱과 같은 컨텍스트에
     * 다시 매핑되는데, 이 조건이 없으면 그 순간 이 빈이 조용히 앱 포트에서도 {@code /actuator/**} 를 permitAll 해버린다 — Step 5 에서
     * 지운 원래 취약점이 되살아난다. 이 조건으로 포트가 실제로 분리돼 있을 때만(={@link ManagementPortType#DIFFERENT}) 빈 자체가 존재하게
     * 해서, 포트가 합쳐지면 {@code /actuator/**} 는 자동으로 아래 {@code filterChain} 의 {@code
     * anyRequest().authenticated()} 로 떨어진다 (회귀 테스트: {@code ActuatorMergedPortRegressionTest}).
     */
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
