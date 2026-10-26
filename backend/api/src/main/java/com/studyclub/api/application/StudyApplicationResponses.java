package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

public final class StudyApplicationResponses {

    private StudyApplicationResponses() {}

    @Schema(description = "내 신청 여부 응답")
    public record MyStudyApplicationResponse(
            @Schema(description = "해당 모집 회차에 내 신청서가 있는지", example = "true") boolean applied,
            @Schema(description = "신청서 ID. 신청하지 않았으면 null입니다.", example = "42") Long applicationId,
            @Schema(description = "신청서 제출 시각(UTC). 신청하지 않았으면 null입니다.") Instant submittedAt) {

        static final MyStudyApplicationResponse NOT_APPLIED =
                new MyStudyApplicationResponse(false, null, null);
    }
}
