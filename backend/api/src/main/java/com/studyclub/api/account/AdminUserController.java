package com.studyclub.api.account;

import com.studyclub.api.account.AdminAccountListFilter.Role;
import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
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

    public AdminUserController(AdminAccountQueryService adminAccountQueryService) {
        this.adminAccountQueryService = adminAccountQueryService;
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
}
