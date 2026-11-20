package com.studyclub.api.event;

import com.studyclub.api.auth.security.RequireOnboarding;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 마이페이지 「내 행사」. 스펙: specs/event-registration/spec.md 「내 행사」. */
@Tag(name = "행사", description = "크루가 행사를 보고 신청하고 본인 신청을 취소한다")
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/me/events")
public class MyClubEventController {

    private final ClubEventSiteService siteService;

    public MyClubEventController(ClubEventSiteService siteService) {
        this.siteService = siteService;
    }

    @Operation(summary = "내 행사", description = "온보딩을 마친 회원만. 행사별 내 최신 신청 한 건, 최근 신청 순, 페이지 없음.")
    @RequireOnboarding
    @GetMapping
    public List<MyClubEventResponse> myEvents(Authentication authentication) {
        return siteService.myEvents((Long) authentication.getPrincipal());
    }
}
