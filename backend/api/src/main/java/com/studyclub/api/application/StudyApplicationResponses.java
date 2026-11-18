package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

public final class StudyApplicationResponses {

    private StudyApplicationResponses() {}

    @Schema(description = "내 신청 여부 응답")
    public record MyStudyApplicationResponse(
            @Schema(description = "이 스터디(모든 모집 회차)에 내 신청서가 있는지", example = "true") boolean applied,
            @Schema(description = "신청서 ID. 신청하지 않았으면 null입니다.", example = "42") Long applicationId,
            @Schema(description = "신청서 제출 시각(UTC). 신청하지 않았으면 null입니다.") Instant submittedAt,
            @Schema(
                            description = "이 스터디에서 참여 중단(명부 WITHDRAWN)됐는지. 참이면 다시 신청할 수 없습니다.",
                            example = "false")
                    boolean withdrawn) {}
}
