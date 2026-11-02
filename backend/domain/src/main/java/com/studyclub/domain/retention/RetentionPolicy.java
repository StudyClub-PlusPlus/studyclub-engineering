package com.studyclub.domain.retention;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/** 저장된 코드의 의미는 불변이다. 향후 변경은 새 버전으로 추가하고 기존 기한은 별도로 검토한다. */
public enum RetentionPolicy {
    FEEDBACK_V1(1),
    AUDIT_ACCESS_V1(1),
    AUDIT_ACCESS_TWO_YEARS_V1(2),
    AUDIT_AUTHORITY_V1(3),
    AUDIT_WITHDRAW_UNCLASSIFIED_V1(0);

    private final int years;

    RetentionPolicy(int years) {
        this.years = years;
    }

    public Instant expiresAt(Instant basis) {
        if (this == AUDIT_WITHDRAW_UNCLASSIFIED_V1) return null;
        return basis.atOffset(ZoneOffset.UTC)
                .plusYears(years)
                .toInstant()
                .truncatedTo(ChronoUnit.MICROS);
    }
}
