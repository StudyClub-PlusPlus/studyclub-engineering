package com.studyclub.api.event;

import static com.studyclub.domain.event.EventInputs.invalid;

import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import java.util.List;

/**
 * 참가 처리 본문. {@code status} 를 문자열로 받는 이유는 {@link AdminClubEventStatusRequest} 와 같다 — 허용 밖 값을 필드 이름이
 * 담긴 400 으로 돌려준다. {@code PENDING} 으로 되돌리는 처리는 없다.
 */
public record AdminClubEventRegistrationDecisionRequest(String status) {

    private static final List<ClubEventRegistrationStatus> ALLOWED =
            List.of(
                    ClubEventRegistrationStatus.CONFIRMED,
                    ClubEventRegistrationStatus.DECLINED,
                    ClubEventRegistrationStatus.CANCELLED);

    ClubEventRegistrationStatus decision() {
        for (ClubEventRegistrationStatus allowed : ALLOWED) {
            if (allowed.name().equals(status)) {
                return allowed;
            }
        }
        throw invalid("status", "CONFIRMED · DECLINED · CANCELLED 중 하나여야 합니다.");
    }
}
