package com.studyclub.api.attendance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AttendanceUpsertRequest(@NotEmpty List<@Valid AttendanceUpsertItem> updates) {

    public AttendanceUpsertRequest {
        if (updates == null || updates.isEmpty()) {
            throw new IllegalArgumentException("updates는 필수이며 비어 있을 수 없습니다.");
        }

        for (int i = 0; i < updates.size(); i++) {
            if (updates.get(i) == null) {
                throw new IllegalArgumentException("updates[" + i + "]: null 값이 허용되지 않습니다.");
            }
        }
    }

    public record AttendanceUpsertItem(
            @NotNull Long meetingId, @NotNull Long participantId, @NotNull String status) {

        public AttendanceUpsertItem {
            if (meetingId == null) {
                throw new IllegalArgumentException("meetingId는 필수입니다.");
            }

            if (participantId == null) {
                throw new IllegalArgumentException("participantId는 필수입니다.");
            }

            if (status == null) {
                throw new IllegalArgumentException("status는 필수입니다.");
            }
        }
    }
}
