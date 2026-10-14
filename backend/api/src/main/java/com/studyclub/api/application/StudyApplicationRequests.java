package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.Map;

public final class StudyApplicationRequests {

    private StudyApplicationRequests() {}

    @Schema(description = "스터디 신청 제출 요청")
    public record SubmitStudyApplicationRequest(
            @Schema(description = "스터디클럽++ 디스코드 서버 별명", example = "홍길동/SWE/서울/백엔드")
                    String discordNickname,
            @Schema(description = "참여 가능한 요일 key", example = "[\"mon\", \"wed\"]")
                    List<String> availableDays,
            @Schema(description = "확정 일정 참여 확인. 일정이 없으면 false와 null은 무시합니다.")
                    Boolean scheduleAgreed,
            @Schema(description = "추가 질문 ID별 답. 값은 문자열 또는 문자열 배열입니다.")
                    Map<String, Object> answers) {}
}
