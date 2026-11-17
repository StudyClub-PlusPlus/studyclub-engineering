package com.studyclub.api.studygroup;

import jakarta.validation.constraints.NotNull;

/** 담당 캡틴 바꾸기 요청. specs/study-group/spec.md 「담당 캡틴 바꾸기」 */
public record OwnerCaptainChangeRequest(@NotNull(message = "accountId: 필수입니다.") Long accountId) {}
