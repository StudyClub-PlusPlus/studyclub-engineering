package com.studyclub.api.event;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * 상태 전환 본문 (specs/event-status). {@code status} 를 문자열로 받는 이유는 {@link AdminClubEventRequest} 와 같다 —
 * 허용 밖 값을 필드 이름이 담긴 400 으로 돌려주려고 {@link ClubEventRequestMapper#toTargetStatus} 가 읽는다.
 */
public record AdminClubEventStatusRequest(
        @NotNull(message = "CLOSED · PUBLISHED · CANCELLED 중 하나를 보내 주세요.") String status,
        @NotNull(message = "운영 상세에서 받은 버전을 보내 주세요.") @PositiveOrZero(message = "0 이상이어야 합니다.") Long version) {}
