package com.studyclub.api.auth;

import com.studyclub.api.auth.dto.AccountDtos.LeaveRequest;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 회원 탈퇴. specs/user-leave/spec.md 의 {@code DELETE /api/me}.
 *
 * <p>일부러 {@code @RequireOnboarding} 을 걸지 않는다 — 온보딩을 마치지 못한 계정도 스스로를 지울 수 있어야 한다는 정책이다({@link
 * com.studyclub.api.participant.ParticipantHubController} 등 다른 {@code /api/me/**} 컨트롤러와 다른 점).
 */
@Tag(name = "회원 탈퇴", description = "본인 계정 즉시 삭제")
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class AccountDeletionController {

    private final AccountDeletionService accountDeletionService;

    @Operation(summary = "회원 탈퇴 — 계정 즉시·영구 삭제")
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping
    public ResponseEntity<Void> leave(
            Authentication authentication, @RequestBody(required = false) LeaveRequest request) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long accountId)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        accountDeletionService.deleteAccount(accountId, request != null ? request.reason() : null);
        return ResponseEntity.noContent().build();
    }
}
