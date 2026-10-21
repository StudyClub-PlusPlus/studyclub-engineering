package com.studyclub.api.attendance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AttendanceUpsertRequest(
        @NotNull Long studyGroupId,
        List<@NotNull @Valid AttendanceUpsertItem> updates,
        List<@NotNull Long> withdrawals) {

    public AttendanceUpsertRequest {
        updates = updates == null ? List.of() : updates;
        withdrawals = withdrawals == null ? List.of() : withdrawals;
    }

    @AssertTrue(message = "출석 변경 또는 참여 중단 대상이 필요합니다.") public boolean isNotEmpty() {
        return !updates.isEmpty() || !withdrawals.isEmpty();
    }

    public record AttendanceUpsertItem(
            @NotNull Long meetingId, @NotNull Long participantId, @NotNull String status) {}
}
