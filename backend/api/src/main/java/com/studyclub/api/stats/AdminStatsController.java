package com.studyclub.api.stats;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.api.stats.AdminStatsResponses.AttendanceTrendResponse;
import com.studyclub.api.stats.AdminStatsResponses.CrewTimezonesResponse;
import com.studyclub.api.stats.AdminStatsResponses.StudiesByCategoryResponse;
import com.studyclub.api.stats.AdminStatsResponses.StudyBoardResponse;
import com.studyclub.api.stats.AdminStatsResponses.SummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 운영 대시보드 집계 API. 캡틴만 ({@code @RequireAdmin}). specs/dashboard/spec.md */
@Tag(name = "백오피스 대시보드", description = "캡틴이 운영 현황 KPI·보드·차트를 조회한다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/stats")
public class AdminStatsController {

    private final AdminStatsService adminStatsService;

    public AdminStatsController(AdminStatsService adminStatsService) {
        this.adminStatsService = adminStatsService;
    }

    @Operation(summary = "대시보드 KPI 요약")
    @GetMapping("/summary")
    public SummaryResponse summary(
            @RequestParam(required = false) String timeZone, Authentication authentication) {
        return adminStatsService.summary(timeZone, accountId(authentication));
    }

    @Operation(summary = "진행중·모집중 스터디 보드 미리보기")
    @GetMapping("/study-board")
    public StudyBoardResponse studyBoard(
            @RequestParam StudyBoardView view,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String timeZone,
            Authentication authentication) {
        return adminStatsService.studyBoard(view, limit, timeZone, accountId(authentication));
    }

    @Operation(summary = "활성 크루 시간대 분포")
    @GetMapping("/crew-timezones")
    public CrewTimezonesResponse crewTimezones() {
        return adminStatsService.crewTimezones();
    }

    @Operation(summary = "최근 12주 출석률 추세")
    @GetMapping("/attendance-trend")
    public AttendanceTrendResponse attendanceTrend(
            @RequestParam(required = false) Integer weeks,
            @RequestParam(required = false) String timeZone,
            Authentication authentication) {
        return adminStatsService.attendanceTrend(weeks, timeZone, accountId(authentication));
    }

    @Operation(summary = "카테고리별 스터디 수 (진행중·누적)")
    @GetMapping("/studies-by-category")
    public StudiesByCategoryResponse studiesByCategory() {
        return adminStatsService.studiesByCategory();
    }

    private static Long accountId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }
}
