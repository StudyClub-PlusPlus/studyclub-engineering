package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

public final class BackOfficeApplicationFormResponses {

    private BackOfficeApplicationFormResponses() {}

    @Schema(description = "백오피스 신청 폼 조회/저장 응답")
    public record StudyApplicationFormResponse(
            @Schema(description = "스터디 ID", example = "1") Long studyId,
            @Schema(description = "설문 제목. 저장된 값이 없으면 스터디 제목입니다.", example = "AI 논문 스터디 신청")
                    String title,
            @Schema(description = "설문 설명 마크다운. 저장된 값이 없으면 스터디 한 줄 소개입니다.") String description,
            @Schema(description = "진행 일정. null이면 화면에서 일정 미정으로 표시합니다.") String schedule,
            @Schema(description = "열려 있는 모집 회차의 마감 시각. 없으면 null입니다.") Instant recruitDeadline,
            @Schema(description = "스터디 카테고리", example = "AI_ML") String category,
            @Schema(description = "스터디 한 줄 소개") String summary,
            @Schema(description = "스터디 상세 소개") String detail,
            @Schema(description = "캡틴 추가 질문 목록. 플랫폼 기본 문항은 포함하지 않습니다.")
                    List<ApplicationFormQuestionResponse> questions) {}

    @Schema(description = "신청 폼 추가 질문")
    public record ApplicationFormQuestionResponse(
            @Schema(description = "폼 안에서 유일한 질문 ID", example = "reason") String id,
            @Schema(description = "질문 제목", example = "지원 사유") String label,
            @Schema(
                            description = "질문 타입",
                            example = "TEXT",
                            allowableValues = {"TEXT", "TEXTAREA", "RADIO", "CHECKBOX", "SELECT"})
                    String type,
            @Schema(description = "필수 응답 여부", example = "true") Boolean required,
            @Schema(description = "TEXT/TEXTAREA 전용 자리 표시 문구") String placeholder,
            @Schema(description = "질문 설명 마크다운 원문") String description,
            @Schema(description = "RADIO/CHECKBOX/SELECT 전용 선택지") List<String> options,
            @Schema(description = "RADIO/CHECKBOX 전용 기타 직접 입력 허용 여부") Boolean allowOther) {}
}
