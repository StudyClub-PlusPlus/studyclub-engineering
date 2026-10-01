package com.studyclub.api.application;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class AdminApplicationResponses {

    private AdminApplicationResponses() {}

    @Schema(description = "백오피스 스터디 신청 결과 목록 응답")
    public record StudyApplicationsResponse(
            @Schema(description = "응답자 수. applications.length와 같습니다.", example = "16")
                    int respondentCount,
            @Schema(description = "캡틴이 만든 추가 질문 목록. 질문별 집계 대상입니다.")
                    List<ApplicationQuestionResponse> questions,
            @Schema(description = "신청서 목록. 신청 ID 오름차순, 먼저 낸 순서입니다.")
                    List<StudyApplicationResponse> applications) {}

    @Schema(description = "신청 폼 추가 질문")
    public record ApplicationQuestionResponse(
            @Schema(description = "폼 안에서 고유한 질문 ID. answers의 key로 사용합니다.", example = "reason")
                    String id,
            @Schema(description = "질문 제목", example = "지원 사유") String label,
            @Schema(
                            description = "질문 타입",
                            example = "TEXT",
                            allowableValues = {"TEXT", "TEXTAREA", "RADIO", "CHECKBOX", "SELECT"})
                    String type,
            @Schema(description = "선택형 질문의 선택지. TEXT/TEXTAREA이면 null일 수 있습니다.")
                    List<String> options,
            @Schema(description = "기타 직접 입력 허용 여부. RADIO/CHECKBOX에서만 의미가 있습니다.")
                    Boolean allowOther) {}

    @Schema(description = "신청서와 신청자 판단 재료")
    public record StudyApplicationResponse(
            @Schema(description = "신청서 ID", example = "10") Long id,
            @Schema(description = "신청한 모집 회차 ID", example = "3") Long recruitmentId,
            @Schema(description = "신청자 계정 닉네임", example = "홍길동") String applicantName,
            @Schema(
                            description = "제출 시점의 디스코드 서버 별명. 응답자별 표의 식별 컬럼으로 사용합니다.",
                            example = "홍길동/SWE/서울/백엔드")
                    String discordNickname,
            @Schema(description = "신청자 계정 이메일", example = "gildong@example.com") String email,
            @Schema(description = "신청서 제출 시각", example = "2026-09-20T12:00:00Z")
                    Instant submittedAt,
            @Schema(description = "현재 스터디를 제외한 이전 참여 횟수", example = "2")
                    long previousParticipationCount,
            @Schema(
                            description =
                                    "이전 참여 중 COMPLETED 비율. 이전 참여가 없으면 null이며 화면에서는 첫 참여로 표시합니다.",
                            example = "50")
                    Integer completionRate,
            @Schema(description = "신청자가 선택한 참여 가능 요일 key 목록", example = "[\"mon\", \"wed\"]")
                    List<String> availableDays,
            @Schema(description = "일정 참여 확인 여부. 일정이 없는 스터디는 null일 수 있습니다.", example = "true")
                    Boolean scheduleAgreed,
            @Schema(description = "추가 질문 답변. 값은 문자열 또는 문자열 배열입니다.") Map<String, Object> answers) {}
}
