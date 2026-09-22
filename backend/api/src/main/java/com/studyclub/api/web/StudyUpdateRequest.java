package com.studyclub.api.web;

import com.studyclub.domain.study.StudyCategory;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/**
 * PATCH /api/studies/{studyId} 요청 바디. 전송된 필드만 반영한다 (null = 업데이트하지 않음).
 *
 * <p>recruitDeadline: null 과 "미전송"을 구분할 수 없으므로, null 은 "업데이트하지 않음"으로 처리한다. 마감일을 제거(상시 모집으로 전환)하려면
 * 별도 API 가 필요하다.
 */
public record StudyUpdateRequest(
        @Size(max = 60) String title,
        String oneLineSummary,
        String description,
        StudyCategory category,
        Instant recruitDeadline,
        String schedule) {}
