package com.studyclub.api.account;

import com.studyclub.api.account.AdminAccountListFilter.Role;
import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 백오피스의 회원 — 목록·이메일 보기·권한 변경·권한표. 캡틴만 ({@code @RequireAdmin}).
 *
 * <p>사용자 쪽 {@code AccountController}(온보딩)와 섞지 않는다 — specs/admin-users/spec.md ·
 * specs/authz-guards/spec.md
 */
@Tag(name = "백오피스 회원", description = "캡틴이 회원 목록을 조회하고 권한을 관리한다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin")
public class AdminUserController {

    private final AdminAccountQueryService adminAccountQueryService;
    private final AdminAccountEmailService adminAccountEmailService;
    private final AdminAccountRoleService adminAccountRoleService;

    public AdminUserController(
            AdminAccountQueryService adminAccountQueryService,
            AdminAccountEmailService adminAccountEmailService,
            AdminAccountRoleService adminAccountRoleService) {
        this.adminAccountQueryService = adminAccountQueryService;
        this.adminAccountEmailService = adminAccountEmailService;
        this.adminAccountRoleService = adminAccountRoleService;
    }

    @Operation(
            summary = "회원 목록 조회",
            description =
                    "캡틴만 호출 가능. role(ALL·CAPTAIN·NAVIGATOR·CREW)·검색·페이지. 이메일은 가려서 준다. total 은 걸러진 뒤 전체 수. "
                            + "q 는 이름 부분 일치 또는 이메일 전체 일치.")
    @GetMapping("/users")
    public AdminAccountListResponse list(
            Authentication authentication,
            @RequestParam(defaultValue = "ALL") Role role,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {
        Long requesterId = (Long) authentication.getPrincipal();
        return adminAccountQueryService.getAccounts(
                requesterId, new AdminAccountListFilter(role, q), offset, limit);
    }

    @Operation(
            summary = "이메일 원본 보기",
            description =
                    "캡틴만 호출 가능. 한 명의 이메일 원본을 돌려주고 감사 로그(EMAIL_REVEAL)를 남긴다. 기록이 안 남으면 이메일도 안 나간다. "
                            + "응답은 캐시하지 않는다(no-store).")
    @PostMapping("/users/{accountId}/email-reveals")
    public ResponseEntity<AdminAccountEmailResponse> revealEmail(
            Authentication authentication, @PathVariable Long accountId) {
        Long requesterId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok()
                // 원본이 브라우저·프록시 캐시에 남지 않게 한다
                .cacheControl(CacheControl.noStore())
                .body(adminAccountEmailService.reveal(requesterId, accountId));
    }

    @Operation(
            summary = "계정 권한 변경",
            description =
                    "캡틴만 호출 가능. ADMIN ↔ MEMBER. 본인 변경(409 CANNOT_CHANGE_OWN_ROLE)과 마지막 캡틴 강등"
                            + "(409 LAST_ADMIN_REQUIRED)은 거절. 같은 값이면 아무것도 바꾸지 않고 200. 실제로 바뀌면 감사 로그(ROLE_CHANGE)를 남긴다.")
    @PatchMapping("/users/{accountId}/system-role")
    public AdminAccountRoleResponse changeSystemRole(
            Authentication authentication,
            @PathVariable Long accountId,
            @Valid @RequestBody AdminAccountRoleRequest request) {
        Long requesterId = (Long) authentication.getPrincipal();
        return adminAccountRoleService.changeSystemRole(
                requesterId, accountId, request.systemRole());
    }

    @Operation(
            summary = "역할별 기본 권한표 조회",
            description = "캡틴만 호출 가능. 스터디 단위·사이트 전체 표를 서버의 단일 정의(RolePermission)에서 내려준다. 열람 전용.")
    @GetMapping("/role-permissions")
    public RolePermissionResponse rolePermissions() {
        return RolePermissionResponse.fromDefinition();
    }
}
