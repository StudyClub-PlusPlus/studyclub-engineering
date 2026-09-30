package com.studyclub.api.study;

import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyPhase;
import com.studyclub.domain.study.StudyTimezone;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사용자 사이트의 스터디 — 공개 목록·상세, 네비게이터의 수정.
 *
 * <p>백오피스 화면은 {@link AdminStudyController}({@code /api/admin/studies})를 쓰고 캡틴만 통과한다. 수정은 두 관객이 다 해서
 * 경로가 둘이다 — specs/study/spec.md 「관객별 엔드포인트」
 */
@Tag(name = "스터디", description = "스터디 목록·상세")
@RestController
@RequestMapping("/api/studies")
public class StudyController {

    private final StudyListService studyListService;
    private final StudyService studyService;

    public StudyController(StudyListService studyListService, StudyService studyService) {
        this.studyListService = studyListService;
        this.studyService = studyService;
    }

    @Operation(
            summary = "스터디 목록 조회",
            description =
                    "카테고리·모집 상태·시간대·키워드(제목·한 줄 소개)·모집 마감일로 공개 스터디 목록을 조회한다." + " DRAFT 는 나오지 않는다.")
    @GetMapping
    public StudyListResponse list(
            @RequestParam(required = false) StudyCategory category,
            @RequestParam(required = false) StudyPhase status,
            @RequestParam(required = false) StudyTimezone timezone,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Instant recruitDeadlineBefore,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {

        return studyListService.list(
                new StudyListFilter(category, status, timezone, keyword, recruitDeadlineBefore),
                offset,
                limit);
    }

    @GetMapping("/{studyId}")
    public StudyDetailResponse detail(@PathVariable Long studyId) {
        return studyService.getDetail(studyId);
    }

    @Operation(
            summary = "스터디 수정 (사용자 사이트)",
            description =
                    "캡틴 또는 그 스터디의 네비게이터(LEADER/CO_LEADER)."
                            + " 백오피스는 PATCH /api/admin/studies/{studyId} 를 쓰고 캡틴만 통과한다.")
    @SecurityRequirement(name = "bearerAuth")
    @PatchMapping("/{studyId}")
    public ResponseEntity<Void> update(
            @PathVariable Long studyId,
            @Valid @RequestBody StudyUpdateRequest request,
            Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        studyService.updateFromSite(accountId, studyId, request);
        return ResponseEntity.noContent().build();
    }
}
