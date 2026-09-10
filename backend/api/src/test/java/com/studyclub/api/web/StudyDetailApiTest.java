package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyCohort;
import com.studyclub.domain.study.StudyCohortRepository;
import com.studyclub.domain.study.StudyCohortStatus;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyRepository;
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
    @Autowired StudyRepository studyRepository;
    @Autowired StudyCohortRepository cohortRepository;

    @BeforeEach
    void setup() {
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
        cohortRepository.deleteAll();
        studyRepository.deleteAll();
    }

    @Test
    @DisplayName("성공 — 스터디 상세 조회 (코호트 포함)")
    void detailWithCohort() {
        var study =
                studyRepository.save(
                        Study.builder()
                                .slug("algo-study")
                                .title("알고리즘 스터디")
                                .category(StudyCategory.BACKEND)
                                .studyKind(StudyKind.STUDY)
                                .description("설명")
                                .build());
        cohortRepository.save(
                StudyCohort.builder()
                        .studyId(study.getId())
                        .studyDeliveryFormat(DeliveryFormat.ONLINE)
                        .status(StudyCohortStatus.OPEN)
                        .recruitDeadline(Instant.parse("2026-10-01T00:00:00Z"))
                        .capacity(20)
                        .startDate(Instant.parse("2026-10-15T00:00:00Z"))
                        .build());

        var response = rest.getForEntity("/api/studies/" + study.getId(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var body = response.getBody();
        assertThat(body).containsEntry("title", "알고리즘 스터디");
        assertThat(body).containsEntry("slug", "algo-study");
        assertThat(body).containsEntry("category", "BACKEND");
        assertThat(body).containsKey("cohort");
        @SuppressWarnings("unchecked")
        var cohort = (Map<String, Object>) body.get("cohort");
        assertThat(cohort).containsEntry("status", "OPEN");
        assertThat(body).doesNotContainKey("success");
    }

    @Test
    @DisplayName("성공 — 코호트 없는 스터디도 조회 가능 (cohort: null)")
    void detailWithoutCohort() {
        var study =
                studyRepository.save(
                        Study.builder()
                                .slug("no-cohort")
                                .title("코호트 없음")
                                .category(StudyCategory.AI_ML)
                                .studyKind(StudyKind.STUDY)
                                .build());

        var response = rest.getForEntity("/api/studies/" + study.getId(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("title", "코호트 없음");
        assertThat(response.getBody().get("cohort")).isNull();
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
        var study =
                studyRepository.save(
                        Study.builder()
                                .slug("hidden")
                                .title("숨김 스터디")
                                .category(StudyCategory.OTHER)
                                .studyKind(StudyKind.STUDY)
                                .isHidden(true)
                                .build());

        var response = rest.getForEntity("/api/studies/" + study.getId(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }
}
