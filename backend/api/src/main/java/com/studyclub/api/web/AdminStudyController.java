package com.studyclub.api.web;

import com.studyclub.api.study.BackofficeStudyListFilter;
import com.studyclub.api.study.BackofficeStudyListResponse;
import com.studyclub.api.study.BackofficeStudyListService;
import com.studyclub.api.study.StudyCaptainGuard;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "백오피스 스터디", description = "운영자가 스터디 전체 목록을 조회한다")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/studies")
public class AdminStudyController {

    private final BackofficeStudyListService backofficeStudyListService;
    private final StudyCaptainGuard studyCaptainGuard;

    public AdminStudyController(
            BackofficeStudyListService backofficeStudyListService,
            StudyCaptainGuard studyCaptainGuard) {
        this.backofficeStudyListService = backofficeStudyListService;
        this.studyCaptainGuard = studyCaptainGuard;
    }

    @Operation(summary = "백오피스 스터디 목록 조회", description = "ADMIN만 호출 가능. DRAFT 포함 전 상태를 반환한다.")
    @GetMapping
    public BackofficeStudyListResponse list(
            @RequestParam(required = false) StudyCategory category,
            @RequestParam(required = false) StudyKind studyKind,
            Authentication authentication) {
        Long accountId = (Long) authentication.getPrincipal();
        studyCaptainGuard.assertCaptain(accountId, "백오피스는 캡틴(ADMIN)만 접근할 수 있습니다.");
        return backofficeStudyListService.getStudies(
                new BackofficeStudyListFilter(category, studyKind));
    }
}
