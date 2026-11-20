package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AuthDtos.AuthResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 테스트 로그인 (specs/stage-email-login). 스위치(EMAIL_LOGIN_ENABLED)가 꺼져 있으면 셋 다 404. */
@Tag(name = "테스트 로그인", description = "스위치가 켜진 환경에서만 — 꺼져 있으면 404")
@RestController
@RequestMapping("/auth/email")
public class StageEmailLoginController {

    public record SignupRequest(@NotBlank @Email @Size(max = 255) String email) {}

    public record VerifyRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Pattern(regexp = "\\d{6}") String code,
            // BCrypt 는 72바이트까지만 본다
            @NotBlank @Size(min = 8, max = 72) String password) {}

    public record LoginRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 72) String password) {}

    private final StageEmailLoginService service;

    public StageEmailLoginController(StageEmailLoginService service) {
        this.service = service;
    }

    @Operation(summary = "[테스트] 가입 1/2 — 코드 메일 보내기 (10분)")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void signup(@Valid @RequestBody SignupRequest req) {
        service.requestCode(req.email());
    }

    @Operation(summary = "[테스트] 가입 2/2 — 코드 확인 + 비밀번호 정하기")
    @PostMapping("/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verify(@Valid @RequestBody VerifyRequest req) {
        service.verify(req.email(), req.code(), req.password());
    }

    @Operation(summary = "[테스트] 이메일 · 비밀번호 로그인 — 소셜 로그인과 같은 응답")
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return service.login(req.email(), req.password());
    }
}
