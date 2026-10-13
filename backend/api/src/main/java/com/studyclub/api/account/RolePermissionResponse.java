package com.studyclub.api.account;

import com.studyclub.api.account.RolePermission.Role;
import com.studyclub.api.account.RolePermission.Scope;
import java.util.Arrays;
import java.util.List;

/** 역할별 기본 권한표 응답. {@link RolePermission} 에서 조립만 한다 — 화면 문구 외 계산이 없다. */
public record RolePermissionResponse(List<Group> groups) {

    public record Group(String scope, List<String> roles, List<Permission> permissions) {}

    public record Permission(String key, String label, List<String> allowedRoles) {}

    public static RolePermissionResponse fromDefinition() {
        return new RolePermissionResponse(
                Arrays.stream(Scope.values()).map(RolePermissionResponse::groupOf).toList());
    }

    private static List<String> keys(List<Role> roles) {
        return roles.stream().map(Role::key).toList();
    }

    private static Group groupOf(Scope scope) {
        List<Permission> permissions =
                Arrays.stream(RolePermission.values())
                        .filter(p -> p.scope() == scope)
                        .map(p -> new Permission(p.name(), p.label(), keys(p.allowedRoles())))
                        .toList();
        return new Group(scope.name(), keys(scope.roles()), permissions);
    }
}
