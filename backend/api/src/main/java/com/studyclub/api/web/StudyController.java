package com.studyclub.api.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.studyclub.domain.study.Study;

import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "스터디", description = "스터디 목록")
@RestController
@RequestMapping("/api/studies")
public class StudyController {

    // TODO(api): replace hardcoded fixtures with a real service/repository once the
    // persistence layer lands. Mirrors the frontend mock-data spirit for now.
    private record StudySummary(Long id, String title, String status) {}

    private static final List<StudySummary> STUDIES = List.of(
            new StudySummary(1L, "알고리즘 스터디", "RECRUITING"),
            new StudySummary(2L, "Spring Boot 딥다이브", "ONGOING")
    );

    @GetMapping
    public List<StudySummary> list() {
        return STUDIES;
    }
}
