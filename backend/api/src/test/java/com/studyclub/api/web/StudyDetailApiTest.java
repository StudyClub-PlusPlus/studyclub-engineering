package com.studyclub.api.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;

import com.studyclub.domain.study.DeliveryFormatEnum;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategoryEnum;
import com.studyclub.domain.study.StudyCohort;
import com.studyclub.domain.study.StudyCohortRepository;
import com.studyclub.domain.study.StudyCohortStatusEnum;
import com.studyclub.domain.study.StudyKindEnum;
import com.studyclub.domain.study.StudyRepository;

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
        var study = studyRepository.save(
                new Study("algo-study", "알고리즘 스터디", "설명", StudyCategoryEnum.BACKEND,
                        StudyKindEnum.STUDY, null, false));
        cohortRepository.save(
                new StudyCohort(study.getId(), DeliveryFormatEnum.ONLINE, StudyCohortStatusEnum.OPEN,
                        null, null, 20, Instant.parse("2026-10-01T00:00:00Z"),
                        Instant.parse("2026-10-15T00:00:00Z"), null, null, null));

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
        var study = studyRepository.save(
                new Study("no-cohort", "코호트 없음", null, StudyCategoryEnum.AI,
                        StudyKindEnum.STUDY, null, false));

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
        var study = studyRepository.save(
                new Study("hidden", "숨김 스터디", null, StudyCategoryEnum.OTHER,
                        StudyKindEnum.STUDY, null, true));

        var response = rest.getForEntity("/api/studies/" + study.getId(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("errorCode", "NOT_FOUND");
    }
}
