package com.studyclub.api.notification;

import com.studyclub.notification.ResendSkipReason;
import java.util.List;

/** 재발송 접수 결과. 접수까지만 알린다 — 보냈다는 뜻이 아니다. 끝은 {@code GET /api/admin/notifications?ids=} 로 쫓는다. */
public record NotificationResendResponse(List<Long> accepted, List<Skipped> skipped) {

    public record Skipped(Long id, ResendSkipReason reason) {}
}
