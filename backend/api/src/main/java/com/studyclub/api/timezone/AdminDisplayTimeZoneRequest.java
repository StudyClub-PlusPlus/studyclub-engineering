package com.studyclub.api.timezone;

import com.studyclub.api.auth.validation.ValidTimeZone;
import jakarta.validation.constraints.NotBlank;

/** PATCH /api/admin/me/display-time-zone 본문. */
public record AdminDisplayTimeZoneRequest(
        @NotBlank(message = "시간대를 골라 주세요") @ValidTimeZone String timeZone) {}
