package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyCohort;
import com.studyclub.domain.study.StudyCohortStatus;
import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyCohortRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyListIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyCohortRepository cohortRepo;

    @BeforeEach
    void setUp() {
        cohortRepo.deleteAll();
        studyRepo.deleteAll();

        var algo = studyRepo.save(new Study("daily-leetcode", "데일리 리트코드", "알고리즘 스터디",
                StudyCategory.CS, StudyKind.STUDY, null, false));
        cohortRepo.save(new StudyCohort(algo.getId(), DeliveryFormat.ONLINE, StudyCohortStatus.OPEN,
                null, null, 30,
                Instant.now().plus(2, ChronoUnit.DAYS),
                Instant.now().plus(10, ChronoUnit.DAYS), null, null, null));

        var spring = studyRepo.save(new Study("spring-deep", "Spring 딥다이브", "스프링 스터디",
                StudyCategory.BACKEND, StudyKind.STUDY, null, false));
        cohortRepo.save(new StudyCohort(spring.getId(), DeliveryFormat.OFFLINE, StudyCohortStatus.DRAFT,
                null, null, 20,
                Instant.now().plus(30, ChronoUnit.DAYS),
                Instant.now().plus(40, ChronoUnit.DAYS), null, null, null));

        var closed = studyRepo.save(new Study("old-study", "종료 스터디", "지난 스터디",
                StudyCategory.CS, StudyKind.STUDY, null, false));
        cohortRepo.save(new StudyCohort(closed.getId(), DeliveryFormat.ONLINE, StudyCohortStatus.CLOSED,
                null, null, 10,
                Instant.now().minus(10, ChronoUnit.DAYS),
                Instant.now().minus(5, ChronoUnit.DAYS), null, null, null));
    }

    @Test
    @DisplayName("성공 - 필터 없이 전체 조회")
    void listAll() {
        var response = rest.getForEntity("/api/studies", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("total", 3);
        assertThat(response.getBody().get("items")).asList().hasSize(3);
    }

    @Test
    @DisplayName("성공 - 카테고리 필터")
    void filterByCategory() {
        var response = rest.getForEntity("/api/studies?category=CS", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("total", 2);
    }

    @Test
    @DisplayName("성공 - 모집 상태 필터")
    void filterByStatus() {
        var response = rest.getForEntity("/api/studies?status=OPEN", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("total", 1);
    }

    @Test
    @DisplayName("성공 - 키워드 검색")
    void filterByKeyword() {
        var response = rest.getForEntity("/api/studies?keyword=리트코드", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("total", 1);
    }

    @Test
    @DisplayName("성공 - 모집 마감일 필터 (종료 임박)")
    void filterByRecruitDeadlineBefore() {
        Instant threeDaysLater = Instant.now().plus(3, ChronoUnit.DAYS);
        var response = rest.getForEntity(
                "/api/studies?recruitDeadlineBefore=" + threeDaysLater.toString(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("total", 1);
    }

    @Test
    @DisplayName("성공 - 페이지네이션 (offset/limit)")
    void pagination() {
        var response = rest.getForEntity("/api/studies?offset=0&limit=2", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("total", 3);
        assertThat(response.getBody().get("items")).asList().hasSize(2);
        assertThat(response.getBody()).containsEntry("offset", 0);
        assertThat(response.getBody()).containsEntry("limit", 2);
    }

    @Test
    @DisplayName("성공 - 응답에 items/total/offset/limit 구조를 쓴다 (endpoint convention)")
    void responseFormat() {
        var response = rest.getForEntity("/api/studies", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsKeys("items", "total", "offset", "limit");
        assertThat(response.getBody()).doesNotContainKey("success");
    }
}
