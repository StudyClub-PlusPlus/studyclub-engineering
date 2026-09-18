package com.studyclub.api.bookmark;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.bookmark.StudyBookmark;
import com.studyclub.domain.bookmark.StudyBookmarkRepository;
import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyBookmarkIntegrationTest {

    // 100L is reserved for this test class — other test classes must not use this account ID
    private static final Long ACCOUNT_ID = 100L;
    private static final String ACCOUNT_EMAIL = "bookmark-test@example.com";

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;

    @Autowired StudyProgramRepository studyProgramRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyBookmarkRepository studyBookmarkRepository;

    @Test
    @DisplayName("성공 - 북마크 목록을 items·total·offset·limit 형태로 반환한다")
    void testReturnsBookmarkedStudies() {
        try (var resource = new TestDataResource()) {
            StudyProgram program =
                    resource.saveProgram("bm-java-study", "Java Study", StudyCategory.BACKEND);
            Study study = resource.saveStudy(program.getId());
            resource.saveBookmark(study.getId());

            var response =
                    rest.exchange(
                            "/api/me/bookmarks", HttpMethod.GET, authenticatedRequest(), Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).containsKeys("items", "total", "offset", "limit");
            assertThat(response.getBody().get("total")).isEqualTo(1);
            assertThat(response.getBody().get("offset")).isEqualTo(0);
            assertThat(response.getBody().get("limit")).isEqualTo(20);

            List<Map<String, Object>> items =
                    (List<Map<String, Object>>) response.getBody().get("items");
            assertThat(items).hasSize(1);
            assertThat(items.get(0)).containsEntry("title", "Java Study");
            assertThat(items.get(0)).containsEntry("category", "BACKEND");
        }
    }

    @Test
    @DisplayName("성공 - 북마크가 없으면 빈 목록과 total 0을 반환한다")
    void testReturnsEmptyList() {
        var response =
                rest.exchange(
                        "/api/me/bookmarks", HttpMethod.GET, authenticatedRequest(), Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("total")).isEqualTo(0);
        assertThat((List<?>) response.getBody().get("items")).isEmpty();
    }

    @Test
    @DisplayName("성공 - offset/limit 이 실제 페이지네이션에 적용된다")
    void testPagination() {
        try (var resource = new TestDataResource()) {
            StudyProgram studyProgramA =
                    resource.saveProgram("bm-study-a", "Study A", StudyCategory.BACKEND);
            StudyProgram studyProgramB =
                    resource.saveProgram("bm-study-b", "Study B", StudyCategory.FRONTEND);
            StudyProgram studyProgramC =
                    resource.saveProgram("bm-study-c", "Study C", StudyCategory.AI_ML);
            resource.saveBookmark(resource.saveStudy(studyProgramA.getId()).getId());
            resource.saveBookmark(resource.saveStudy(studyProgramB.getId()).getId());
            resource.saveBookmark(resource.saveStudy(studyProgramC.getId()).getId());

            // offset=1, limit=1 → 두 번째 항목(Study B)만 반환
            var response =
                    rest.exchange(
                            "/api/me/bookmarks?offset=1&limit=1",
                            HttpMethod.GET,
                            authenticatedRequest(),
                            Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().get("total")).isEqualTo(3);
            assertThat(response.getBody().get("offset")).isEqualTo(1);
            assertThat(response.getBody().get("limit")).isEqualTo(1);

            List<Map<String, Object>> items =
                    (List<Map<String, Object>>) response.getBody().get("items");
            assertThat(items).hasSize(1);
            assertThat(items.get(0)).containsEntry("title", "Study B");
        }
    }

    private HttpEntity<Void> authenticatedRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(ACCOUNT_ID), ACCOUNT_EMAIL));
        return new HttpEntity<>(headers);
    }

    private class TestDataResource implements AutoCloseable {

        private final List<Long> studyIds = new ArrayList<>();
        private final List<Long> programIds = new ArrayList<>();

        StudyProgram saveProgram(String slug, String title, StudyCategory category) {
            StudyProgram program =
                    studyProgramRepository.save(
                            StudyProgram.builder()
                                    .slug(slug)
                                    .title(title)
                                    .oneLineSummary("테스트 스터디")
                                    .category(category)
                                    .studyKind(StudyKind.STUDY)
                                    .build());
            programIds.add(program.getId());
            return program;
        }

        Study saveStudy(Long programId) {
            Study study =
                    studyRepository.save(
                            Study.builder()
                                    .programId(programId)
                                    .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                    .status(StudyStatus.OPEN)
                                    .recruitDeadline(Instant.now().plusSeconds(3600))
                                    .capacity(10)
                                    .build());
            studyIds.add(study.getId());
            return study;
        }

        void saveBookmark(Long studyId) {
            studyBookmarkRepository.save(
                    StudyBookmark.builder().accountId(ACCOUNT_ID).studyId(studyId).build());
        }

        @Override
        public void close() {
            studyBookmarkRepository.deleteByAccountId(ACCOUNT_ID);
            studyRepository.deleteAllById(studyIds);
            studyProgramRepository.deleteAllById(programIds);
        }
    }
}
