package com.studyclub.api.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "스터디", description = "스터디 목록·상세")
@RestController
@RequestMapping("/api/studies")
public class StudyController {

    private final StudyService studyService;

    // ponytail: 목록 API 는 아직 fixture — 서비스로 교체는 목록 스펙 확정 후
    private record StudySummary(Long id, String title, String status) {}

    private static final List<StudySummary> STUDIES = List.of(
            new StudySummary(1L, "알고리즘 스터디", "RECRUITING"),
            new StudySummary(2L, "Spring Boot 딥다이브", "ONGOING")
    );

    public StudyController(StudyService studyService) {
        this.studyService = studyService;
    }

    @GetMapping
    public List<StudySummary> list() {
        return STUDIES;
    }

    @GetMapping("/{studyId}")
    public StudyDetailResponse detail(@PathVariable Long studyId) {
        return studyService.getDetail(studyId);
    }
}
