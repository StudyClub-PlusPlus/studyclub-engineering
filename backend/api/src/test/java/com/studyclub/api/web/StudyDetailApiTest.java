package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRecruitment;
import com.studyclub.domain.study.StudyRecruitmentRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyDetailApiTest {

    @Autowired TestRestTemplate rest;
    @Autowired StudyProgramRepository studyProgramRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyRecruitmentRepository recruitmentRepository;

    @BeforeEach
    void setup() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        recruitmentRepository.deleteAll();
        studyRepository.deleteAll();
        studyProgramRepository.deleteAll();
    }

    @Test
    @DisplayName("성공 — 스터디 상세 조회")
    void detailWithStudy() {
        var studyProgram =
                studyProgramRepository.save(StudyProgram.builder().title("알고리즘 스터디").build());
        var study =
                studyRepository.save(
                        Study.builder()
                                .programId(studyProgram.getId())
                                .slug("algo-study")
                                .title("알고리즘 스터디")
                                .oneLineSummary("알고리즘 문제 풀이 스터디")
                                .category(StudyCategory.SOFTWARE)
                                .studyKind(StudyKind.STUDY)
                                .description("설명")
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.OPEN)
                                .capacity(20)
                                .startAt(Instant.parse("2026-10-15T00:00:00Z"))
                                .build());
        recruitmentRepository.save(
                StudyRecruitment.builder()
                        .studyId(study.getId())
                        .title("모집")
                        .description("모집 설명")
                        .startAt(Instant.parse("2026-09-01T00:00:00Z"))
                        .recruitDeadlineAt(Instant.parse("2026-10-01T00:00:00Z"))
                        .build());

        var response = rest.getForEntity("/api/studies/" + study.getId(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var body = response.getBody();
        assertThat(body).containsEntry("title", "알고리즘 스터디");
        assertThat(body).containsEntry("slug", "algo-study");
        assertThat(body).containsEntry("category", "SOFTWARE");
        assertThat(body).containsEntry("status", "OPEN");
        assertThat(body).doesNotContainKey("success");
    }

    @Test
    @DisplayName("실패 — 존재하지 않는 studyId → 404 NOT_FOUND")
    void detailWithoutStudy() {
        var studyProgram =
                studyProgramRepository.save(StudyProgram.builder().title("코호트 없음").build());

        // studyProgram.getId() is a valid program ID but no study has been created with that ID
        var response = rest.getForEntity("/api/studies/" + studyProgram.getId(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 — 존재하지 않는 스터디 → 404 NOT_FOUND")
    void notFound() {
        var response = rest.getForEntity("/api/studies/99999", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }

    @Test
    @DisplayName("실패 — 숨김 스터디 → 404 NOT_FOUND")
    void hiddenStudyReturns404() {
        var studyProgram =
                studyProgramRepository.save(StudyProgram.builder().title("숨김 스터디").build());
        var study =
                studyRepository.save(
                        Study.builder()
                                .programId(studyProgram.getId())
                                .slug("hidden")
                                .title("숨김 스터디")
                                .oneLineSummary("숨김 처리된 스터디")
                                .category(StudyCategory.OTHER)
                                .studyKind(StudyKind.STUDY)
                                .isHidden(true)
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.DRAFT)
                                .build());

        var response = rest.getForEntity("/api/studies/" + study.getId(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }
}
