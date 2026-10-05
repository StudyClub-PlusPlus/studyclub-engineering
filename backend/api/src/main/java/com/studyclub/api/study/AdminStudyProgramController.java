package com.studyclub.api.study;

import com.studyclub.api.auth.security.RequireAdmin;
import com.studyclub.domain.study.StudyKind;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 백오피스의 스터디 프로그램 — 목록만 있다. 캡틴만 ({@code @RequireAdmin}).
 *
 * <p>프로그램을 따로 등록·수정하는 길은 없다. 프로그램은 제목·종류뿐이고 기수 없는 프로그램은 의미가 없어서, 생성은 스터디 등록({@link
 * AdminStudyController#create})이 함께 한다 — docs/erd/STUDY_PROGRAM.md. 그래서 이 컨트롤러는 등록 모달의 클럽 드롭다운을 채우는
 * 조회 하나만 맡는다.
 */
@Tag(name = "백오피스 스터디 프로그램", description = "캡틴이 기수를 붙일 프로그램을 고른다")
@RequireAdmin
@SecurityRequirement(name = "bearerAuth")
@RestController
@RequestMapping("/api/admin/study-programs")
public class AdminStudyProgramController {

    private final AdminStudyProgramService adminStudyProgramService;

    public AdminStudyProgramController(AdminStudyProgramService adminStudyProgramService) {
        this.adminStudyProgramService = adminStudyProgramService;
    }

    @Operation(
            summary = "스터디 프로그램 목록 조회",
            description = "ADMIN만 호출 가능. 등록 모달의 「기존 클럽의 새 기수」 드롭다운이 studyKind=CLUB 으로 부른다.")
    @GetMapping
    public AdminStudyProgramListResponse list(@RequestParam StudyKind studyKind) {
        return adminStudyProgramService.list(studyKind);
    }
}
