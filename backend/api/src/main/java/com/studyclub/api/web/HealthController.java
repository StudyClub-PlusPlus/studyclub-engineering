package com.studyclub.api.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "상태", description = "헬스 체크")
@RestController
public class HealthController {

    @GetMapping("/")
    public String root() {
        return "StudyClub++ API";
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
