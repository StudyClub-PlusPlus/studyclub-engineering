package com.studyclub.api.web;

import com.studyclub.api.study.StudyListFilter;
import com.studyclub.api.study.StudyListResponse;
import com.studyclub.api.study.StudyListService;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyPhase;
import com.studyclub.domain.study.StudyTimezone;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

    @Operation(summary = "스터디 등록", description = "ADMIN 만 호출 가능. 등록 후 STATUS=DRAFT 로 비공개.")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<Void> create(
            @Valid @RequestBody StudyCreateRequest request, Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Long)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        Long accountId = (Long) authentication.getPrincipal();
        Long studyId = studyService.create(accountId, request);
        return ResponseEntity.created(URI.create("/api/studies/" + studyId)).build();
    }
}
