package com.studyclub.api.study;

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
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyRecruitmentRepository recruitmentRepo;

    @BeforeEach
    void setUp() {
        recruitmentRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();

        var algo = studyProgramRepo.save(StudyProgram.builder().title("데일리 리트코드").build());
        var algoStudy =
                studyRepo.save(
                        Study.builder()
                                .programId(algo.getId())
                                .slug("daily-leetcode")
                                .title("데일리 리트코드")
                                .oneLineSummary("매일 알고리즘 문제 풀이")
                                .category(StudyCategory.CS)
                                .studyKind(StudyKind.STUDY)
                                .description("알고리즘 스터디")
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.OPEN)
                                .capacity(30)
                                .startAt(Instant.now().plus(10, ChronoUnit.DAYS))
                                .build());
        recruitmentRepo.save(
                StudyRecruitment.builder()
                        .studyId(algoStudy.getId())
                        .title("모집")
                        .description("모집 설명")
                        .startAt(Instant.now().minus(1, ChronoUnit.DAYS))
                        .recruitDeadlineAt(Instant.now().plus(2, ChronoUnit.DAYS))
                        .build());

        var spring = studyProgramRepo.save(StudyProgram.builder().title("Spring 딥다이브").build());
        var springStudy =
                studyRepo.save(
                        Study.builder()
                                .programId(spring.getId())
                                .slug("spring-deep")
                                .title("Spring 딥다이브")
                                .oneLineSummary("스프링 심화 학습")
                                .category(StudyCategory.BACKEND)
                                .studyKind(StudyKind.STUDY)
                                .description("스프링 스터디")
                                .studyDeliveryFormat(DeliveryFormat.OFFLINE)
                                .status(StudyStatus.DRAFT)
                                .capacity(20)
                                .startAt(Instant.now().plus(40, ChronoUnit.DAYS))
                                .build());
        recruitmentRepo.save(
                StudyRecruitment.builder()
                        .studyId(springStudy.getId())
                        .title("모집")
                        .description("모집 설명")
                        .startAt(Instant.now().plus(10, ChronoUnit.DAYS))
                        .recruitDeadlineAt(Instant.now().plus(30, ChronoUnit.DAYS))
                        .build());

        var closed = studyProgramRepo.save(StudyProgram.builder().title("종료 스터디").build());
        var closedStudy =
                studyRepo.save(
                        Study.builder()
                                .programId(closed.getId())
                                .slug("old-study")
                                .title("종료 스터디")
                                .oneLineSummary("종료된 스터디")
                                .category(StudyCategory.CS)
                                .studyKind(StudyKind.STUDY)
                                .description("지난 스터디")
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(StudyStatus.CLOSED)
                                .capacity(10)
                                .startAt(Instant.now().minus(5, ChronoUnit.DAYS))
                                .build());
        recruitmentRepo.save(
                StudyRecruitment.builder()
                        .studyId(closedStudy.getId())
                        .title("모집")
                        .description("모집 설명")
                        .startAt(Instant.now().minus(20, ChronoUnit.DAYS))
                        .recruitDeadlineAt(Instant.now().minus(10, ChronoUnit.DAYS))
                        .build());
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
        var response =
                rest.getForEntity(
                        "/api/studies?recruitDeadlineBefore=" + threeDaysLater.toString(),
                        Map.class);

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
