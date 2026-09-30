package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class StudyApplicationFormRequests {

    private StudyApplicationFormRequests() {}

    @Schema(description = "백오피스 신청 폼 저장 요청")
    public record StudyApplicationFormRequest(
            @Schema(description = "설문 제목. 비우면 스터디 제목을 사용합니다.", example = "AI 논문 스터디 신청")
                    @Size(max = 200, message = "title: 길이 제한을 넘었습니다.") String title,
            @Schema(description = "설문 설명 마크다운 원문. 비우면 스터디 한 줄 소개를 사용합니다.")
                    @Size(max = 5_000, message = "description: 길이 제한을 넘었습니다.") String description,
            @Schema(description = "캡틴 추가 질문 목록. 빈 배열 허용, null 불가")
                    @NotNull(message = "questions는 필수입니다.") List<@Valid @NotNull ApplicationFormQuestionRequest> questions) {}

    @Schema(description = "신청 폼 추가 질문 저장 요청")
    public record ApplicationFormQuestionRequest(
            @Schema(description = "폼 안에서 유일한 질문 ID. 지원자 답변의 key입니다.", example = "reason")
                    @NotBlank(message = "questions[].id 값을 입력해 주세요.") @Size(max = 200, message = "questions[].id 길이 제한을 넘었습니다.") String id,
            @Schema(description = "질문 제목", example = "지원 사유")
                    @NotBlank(message = "questions[].label 값을 입력해 주세요.") @Size(max = 200, message = "questions[].label 길이 제한을 넘었습니다.") String label,
            @Schema(
                            description = "질문 타입",
                            example = "TEXT",
                            allowableValues = {"TEXT", "TEXTAREA", "RADIO", "CHECKBOX", "SELECT"})
                    @NotBlank(message = "questions[].type 값을 입력해 주세요.") String type,
            @Schema(description = "필수 응답 여부", example = "true")
                    @NotNull(message = "required는 필수입니다.") Boolean required,
            @Schema(description = "TEXT/TEXTAREA 전용 자리 표시 문구", example = "내 답변")
                    @Size(max = 200, message = "questions[].placeholder 길이 제한을 넘었습니다.") String placeholder,
            @Schema(description = "질문 설명 마크다운 원문")
                    @Size(max = 5_000, message = "questions[].description 길이 제한을 넘었습니다.") String description,
            @Schema(description = "RADIO/CHECKBOX/SELECT 전용 선택지")
                    List<
                                    @NotBlank(message = "questions[].options[] 값을 입력해 주세요.") @Size(
                                            max = 200,
                                            message = "questions[].options[] 길이 제한을 넘었습니다.")
                                    String>
                            options,
            @Schema(description = "RADIO/CHECKBOX 전용 기타 직접 입력 허용 여부") Boolean allowOther) {}
}
