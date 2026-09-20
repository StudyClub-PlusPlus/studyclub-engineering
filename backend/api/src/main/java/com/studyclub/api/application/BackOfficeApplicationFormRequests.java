package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public final class BackOfficeApplicationFormRequests {

    private BackOfficeApplicationFormRequests() {}

    @Schema(description = "백오피스 신청 폼 저장 요청")
    public record StudyApplicationFormRequest(
            @Schema(description = "설문 제목. 비우면 스터디 제목을 사용합니다.", example = "AI 논문 스터디 신청")
                    String title,
            @Schema(description = "설문 설명 마크다운 원문. 비우면 스터디 한 줄 소개를 사용합니다.") String description,
            @Schema(description = "캡틴 추가 질문 목록. 빈 배열 허용, null 불가")
                    List<ApplicationFormQuestionRequest> questions) {}

    @Schema(description = "신청 폼 추가 질문 저장 요청")
    public record ApplicationFormQuestionRequest(
            @Schema(description = "폼 안에서 유일한 질문 ID. 지원자 답변의 key입니다.", example = "reason") String id,
            @Schema(description = "질문 제목", example = "지원 사유") String label,
            @Schema(
                            description = "질문 타입",
                            example = "TEXT",
                            allowableValues = {"TEXT", "TEXTAREA", "RADIO", "CHECKBOX", "SELECT"})
                    String type,
            @Schema(description = "필수 응답 여부", example = "true") Boolean required,
            @Schema(description = "TEXT/TEXTAREA 전용 자리 표시 문구", example = "내 답변") String placeholder,
            @Schema(description = "질문 설명 마크다운 원문") String description,
            @Schema(description = "RADIO/CHECKBOX/SELECT 전용 선택지") List<String> options,
            @Schema(description = "RADIO/CHECKBOX 전용 기타 직접 입력 허용 여부") Boolean allowOther) {}
}
