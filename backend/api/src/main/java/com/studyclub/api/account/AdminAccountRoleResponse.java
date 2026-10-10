package com.studyclub.api.account;

import com.studyclub.domain.account.SystemRole;

/** 계정 권한 변경 응답 — 변경 후 값. */
public record AdminAccountRoleResponse(Long id, SystemRole systemRole) {}
