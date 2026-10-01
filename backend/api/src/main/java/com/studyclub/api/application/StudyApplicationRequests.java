package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

public final class StudyApplicationRequests {

    private StudyApplicationRequests() {}

    @Schema(description = "스터디 신청 제출 요청")
    public record SubmitStudyApplicationRequest(
            @Schema(description = "스터디클럽++ 디스코드 서버 별명", example = "홍길동/SWE/서울/백엔드")
                    @NotNull(message = "discordNickname은 필수입니다.") String discordNickname,
            @Schema(description = "참여 가능한 요일 key", example = "[\"mon\", \"wed\"]")
                    @NotNull(message = "availableDays는 필수입니다.") @Size(max = 7, message = "availableDays: max") List<@NotNull String> availableDays,
            @Schema(description = "확정 일정 참여 확인. 일정이 없으면 보내지 않습니다.") Boolean scheduleAgreed,
            @Schema(description = "추가 질문 ID별 답. 값은 문자열 또는 문자열 배열입니다.")
                    @NotNull(message = "answers는 필수입니다.") Map<String, Object> answers) {}
}
