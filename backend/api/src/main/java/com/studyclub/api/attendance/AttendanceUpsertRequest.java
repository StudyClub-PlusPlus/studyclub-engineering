package com.studyclub.api.attendance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AttendanceUpsertRequest(@NotEmpty List<@Valid AttendanceUpsertItem> updates) {

    public record AttendanceUpsertItem(
            @NotNull Long meetingId, @NotNull Long participantId, @NotNull String status) {}
}
