package com.studyclub.api.account;

import com.studyclub.domain.account.SystemRole;
import jakarta.validation.constraints.NotNull;

/** 계정 권한 변경 요청. {@code ADMIN}·{@code MEMBER} 만 받는다 — 그 밖의 값(LEADER 등)은 역직렬화에서 400 이다. */
public record AdminAccountRoleRequest(@NotNull SystemRole systemRole) {}
