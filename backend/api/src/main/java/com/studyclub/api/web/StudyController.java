package com.studyclub.api.web;

import com.studyclub.api.study.StudyListResponse;
import com.studyclub.api.study.StudyListService;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyCohortStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @Operation(summary = "스터디 목록 조회", description = "카테고리·모집 상태·키워드·모집 마감일 필터로 스터디 목록을 조회한다.")
    @GetMapping
    public StudyListResponse list(
            @RequestParam(required = false) StudyCategory category,
            @RequestParam(required = false) StudyCohortStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Instant recruitDeadlineBefore,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "20") int limit) {

        return studyListService.list(
                category, status, keyword, recruitDeadlineBefore, offset, limit);
    }

    @GetMapping("/{studyId}")
    public StudyDetailResponse detail(@PathVariable Long studyId) {
        return studyService.getDetail(studyId);
    }
}
