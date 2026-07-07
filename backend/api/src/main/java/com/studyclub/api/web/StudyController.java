package com.studyclub.api.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.studyclub.common.ApiResponse;
import com.studyclub.domain.study.Study;

@RestController
@RequestMapping("/api/studies")
public class StudyController {

    // TODO(api): replace hardcoded fixtures with a real service/repository once the
    // persistence layer lands. Mirrors the frontend mock-data spirit for now.
    private static final List<Study> STUDIES = List.of(
            new Study(1L, "알고리즘 스터디", "RECRUITING"),
            new Study(2L, "Spring Boot 딥다이브", "ONGOING")
    );

    @GetMapping
    public ApiResponse<List<Study>> list() {
        return ApiResponse.ok(STUDIES);
    }
}
