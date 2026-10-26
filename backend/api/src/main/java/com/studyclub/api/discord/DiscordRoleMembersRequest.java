package com.studyclub.api.discord;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

/**
 * 지금 captain · navigator role 을 가진 사람 전체 — 하루 한 번, 놓친 알림을 메우는 안전망
 * (specs/discord-role-sync/spec.md).
 */
public record DiscordRoleMembersRequest(
        @NotNull Instant snapshotAt,
        @NotNull @Size(max = MAX_MEMBERS) List<@NotBlank @Pattern(regexp = DiscordAttendanceRequest.SNOWFLAKE) String>
                        captains,
        @NotNull @Size(max = MAX_MEMBERS) List<@NotBlank @Pattern(regexp = DiscordAttendanceRequest.SNOWFLAKE) String>
                        navigators) {

    static final int MAX_MEMBERS = 10_000;
}
