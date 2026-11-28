package com.studyclub.api.timezone;

import com.studyclub.api.auth.security.RequireAdmin;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 회원 시간대 후보 — 헤더 · 모집 시간대 선택기의 기본 목록. specs/timezone/spec.md §6 */
@Tag(name = "백오피스 시간대", description = "회원 시간대 후보 · 운영자 표시 시간대")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/member-time-zones")
public class AdminMemberTimeZoneController {

    private final MemberTimeZoneCandidateService candidates;

    public AdminMemberTimeZoneController(MemberTimeZoneCandidateService candidates) {
        this.candidates = candidates;
    }

    @Operation(
            summary = "회원 시간대 후보",
            description =
                    "온보딩을 마친 계정의 TIME_ZONE 별 인원. 인원 내림차순 · 동률 IANA 오름차순. 60초 캐시, 회원 시간대가 바뀌면 다음 요청에"
                            + " 반영. 집계 실패는 503 TIME_ZONE_CANDIDATES_UNAVAILABLE.")
    @GetMapping
    public MemberTimeZoneCandidatesResponse list() {
        return candidates.candidates();
    }
}
