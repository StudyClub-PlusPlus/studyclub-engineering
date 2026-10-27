package com.studyclub.api.attendance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 출석 저장. {@code withdrawals} 는 참여를 중단할 명부 행 ID 다 — 사용자 사이트 · 백오피스 출석부가 받고, 누가 누구를 중단하는지는 경로마다 다르다
 * (specs/study-participant/spec.md). 둘 다 비면 400 — 서비스가 판정한다.
 */
public record AttendanceUpsertRequest(
        @NotNull Long studyGroupId,
        List<@Valid AttendanceUpsertItem> updates,
        List<@NotNull Long> withdrawals) {

    public AttendanceUpsertRequest {
        updates = updates == null ? List.of() : updates;
        withdrawals = withdrawals == null ? List.of() : withdrawals;
    }

    /** 출석만 고칠 때 — 참여 중단 없이. */
    public AttendanceUpsertRequest(Long studyGroupId, List<AttendanceUpsertItem> updates) {
        this(studyGroupId, updates, List.of());
    }

    public boolean hasWithdrawals() {
        return !withdrawals.isEmpty();
    }

    public record AttendanceUpsertItem(
            @NotNull Long meetingId, @NotNull Long participantId, @NotNull String status) {}
}
