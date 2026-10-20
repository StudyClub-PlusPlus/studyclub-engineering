package com.studyclub.api.notification;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 재발송할 실패 건. 한 건도 묶음도 같은 요청이다. 100건 상한은 발송 이력 조회의 {@code limit} 상한과 같다 — 화면이 목록으로 받은 ID 를 그대로 넘긴다
 * (specs/notification/spec.md).
 */
public record NotificationResendRequest(@NotEmpty @Size(max = 100) List<@NotNull Long> ids) {}
