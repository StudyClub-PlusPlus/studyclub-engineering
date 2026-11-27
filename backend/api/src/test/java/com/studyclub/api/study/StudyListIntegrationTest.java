package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.RecruitmentTimeZones;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;

/**
 * 픽스처 — 공개 목록에 나오는 4건 + 나오지 않는 DRAFT 1건.
 *
 * <ul>
 *   <li>데일리 리트코드: ALGORITHM · 모집 중 · 마감 2일 후(종료 임박) · 모집 한국 + LA · 참여 2
 *   <li>Spring 딥다이브: SOFTWARE · 진행 중 · 모집 토론토 · 참여 5
 *   <li>지난 알고리즘: ALGORITHM · 종료 · 모집 전 지역(all)
 *   <li>북클럽: BOOK_CLUB · 모집 중 · 상시 모집(마감 없음) · 소개에 "독서" · 모집 미정(unset)
 *   <li>준비 중 스터디: DRAFT — 목록 제외 · 모집 런던 (필터 후보에도 없어야 한다)
 *   <li>영어 회화 3기 · 4기: 같은 프로그램. 3기 모집 한국, 4기 미정
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyListIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyRecruitmentRepository recruitmentRepo;
    @Autowired StudyParticipantRepository participantRepo;

    private final AtomicLong accountSeq = new AtomicLong(1);

    @BeforeEach
    void setUp() {
        participantRepo.deleteAll();
        recruitmentRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();

        Instant now = Instant.now();

        var leetcode =
                study("데일리 리트코드", "매일 알고리즘 문제 풀이", StudyCategory.ALGORITHM, StudyStatus.OPEN)
                        .schedule("매주 화 21:00 KST")
                        .startAt(now.plus(10, ChronoUnit.DAYS))
                        .build();
        save(
                leetcode,
                now.plus(2, ChronoUnit.DAYS),
                RecruitmentTimeZones.of("selected", List.of("Asia/Seoul", "America/Los_Angeles")));
        participants(leetcode, ParticipantStatus.ACTIVE, 2);

        var spring =
                study("Spring 딥다이브", "스프링 심화 학습", StudyCategory.SOFTWARE, StudyStatus.OPEN)
                        .schedule("Thu 6:00 PM PDT")
                        .startAt(now.minus(5, ChronoUnit.DAYS))
                        .endAt(now.plus(30, ChronoUnit.DAYS))
                        .build();
        save(
                spring,
                now.minus(6, ChronoUnit.DAYS),
                RecruitmentTimeZones.of("selected", List.of("America/Toronto")));
        participants(spring, ParticipantStatus.ACTIVE, 5);

        var closed =
                study("지난 알고리즘", "종료된 스터디", StudyCategory.ALGORITHM, StudyStatus.CLOSED)
                        .startAt(now.minus(60, ChronoUnit.DAYS))
                        .endAt(now.minus(10, ChronoUnit.DAYS))
                        .build();
        save(closed, now.minus(70, ChronoUnit.DAYS), RecruitmentTimeZones.of("all", null));
        participants(closed, ParticipantStatus.COMPLETED, 3);

        var bookClub =
                study("북클럽", "한 달에 한 권 함께 독서", StudyCategory.BOOK_CLUB, StudyStatus.OPEN).build();
        save(bookClub, null);

        var draft = study("준비 중 스터디", "아직 비공개", StudyCategory.ALGORITHM, StudyStatus.DRAFT).build();
        save(
                draft,
                now.plus(5, ChronoUnit.DAYS),
                RecruitmentTimeZones.of("selected", List.of("Europe/London")));

        // 같은 프로그램의 두 기수 — 3기는 진행 중, 4기는 모집 중. 둘 다 목록에 나와야 한다
        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title("영어 회화 클럽").studyKind(StudyKind.CLUB).build());
        var season3 =
                seasonOf(program.getId(), "영어 회화 3기", StudyCategory.LANGUAGE)
                        .startAt(now.minus(3, ChronoUnit.DAYS))
                        .endAt(now.plus(30, ChronoUnit.DAYS))
                        .build();
        save(
                season3,
                now.minus(10, ChronoUnit.DAYS),
                RecruitmentTimeZones.of("selected", List.of("Asia/Seoul")));
        var season4 =
                seasonOf(program.getId(), "영어 회화 4기", StudyCategory.LANGUAGE)
                        .startAt(now.plus(40, ChronoUnit.DAYS))
                        .build();
        save(season4, now.plus(20, ChronoUnit.DAYS));
    }

    /** 같은 프로그램 아래 기수를 하나 더 만든다. */
    private Study.StudyBuilder seasonOf(Long programId, String title, StudyCategory category) {
        return Study.builder()
                .programId(programId)
                .title(title)
                .oneLineSummary("기수별로 따로 모집한다")
                .category(category)
                .status(StudyStatus.OPEN);
    }

    private Study.StudyBuilder study(
            String title, String summary, StudyCategory category, StudyStatus status) {
        var program =
                studyProgramRepo.save(
                        StudyProgram.builder().title(title).studyKind(StudyKind.STUDY).build());
        return Study.builder()
                .programId(program.getId())
                .title(title)
                .oneLineSummary(summary)
                .category(category)
                .status(status);
    }

    private void save(Study study, Instant deadline) {
        save(study, deadline, RecruitmentTimeZones.UNSET);
    }

    private void save(Study study, Instant deadline, RecruitmentTimeZones timeZones) {
        studyRepo.save(study);
        var recruitment =
                StudyRecruitment.builder()
                        .studyId(study.getId())
                        .title("모집")
                        .description("모집 설명")
                        .startAt(Instant.now().minus(80, ChronoUnit.DAYS))
                        .recruitDeadlineAt(deadline)
                        .build();
        recruitment.changeTimeZones(timeZones);
        recruitmentRepo.save(recruitment);
    }

    private void participants(Study study, ParticipantStatus status, int count) {
        for (int i = 0; i < count; i++) {
            participantRepo.save(
                    StudyParticipant.builder()
                            .accountId(accountSeq.getAndIncrement())
                            .studyGroupId(study.getId())
                            .studyId(study.getId())
                            .status(status)
                            .participantRole(ParticipantRole.MEMBER)
                            .joinedAt(Instant.now())
                            .build());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> get(String query) {
        var response = rest.getForEntity("/api/studies" + query, Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> items(Map<String, Object> body) {
        return (List<Map<String, Object>>) body.get("items");
    }

    private static List<Object> titles(Map<String, Object> body) {
        return items(body).stream().map(item -> item.get("title")).toList();
    }

    @Test
    @DisplayName("성공 - 필터 없이 조회하면 DRAFT 를 뺀 전부를 모집 중 → 진행 중 → 종료 순으로 준다")
    void listAll() {
        var body = get("");

        assertThat(body).containsEntry("total", 6);
        assertThat(titles(body))
                .containsExactly(
                        "영어 회화 4기", "북클럽", "데일리 리트코드", "영어 회화 3기", "Spring 딥다이브", "지난 알고리즘");
    }

    @Test
    @DisplayName("성공 - 카테고리 필터")
    void filterByCategory() {
        assertThat(titles(get("?category=ALGORITHM")))
                .containsExactlyInAnyOrder("데일리 리트코드", "지난 알고리즘");
        assertThat(titles(get("?category=BOOK_CLUB"))).containsExactly("북클럽");
    }

    @Test
    @DisplayName("성공 - 모집 상태 필터 (모집 중 / 진행 중 / 종료). 필터(DB)와 응답 phase(도메인) 가 일치한다")
    void filterByStatus() {
        assertThat(titles(get("?status=RECRUITING")))
                .containsExactlyInAnyOrder("데일리 리트코드", "북클럽", "영어 회화 4기");
        assertThat(titles(get("?status=ONGOING")))
                .containsExactlyInAnyOrder("Spring 딥다이브", "영어 회화 3기");
        assertThat(titles(get("?status=CLOSED"))).containsExactly("지난 알고리즘");

        for (String phase : List.of("RECRUITING", "ONGOING", "CLOSED")) {
            assertThat(items(get("?status=" + phase)))
                    .isNotEmpty()
                    .allSatisfy(item -> assertThat(item).containsEntry("phase", phase));
        }
    }

    @Test
    @DisplayName("성공 - 모집 시간대 필터: 한국 + LA 스터디는 한국 · LA 양쪽에 나오고, all · unset 은 어느 지역에도 나온다")
    void filterByRecruitmentZone() {
        assertThat(titles(get("?recruitmentZone=Asia/Seoul")))
                .containsExactlyInAnyOrder("데일리 리트코드", "지난 알고리즘", "북클럽", "영어 회화 3기", "영어 회화 4기");
        assertThat(titles(get("?recruitmentZone=America/Los_Angeles")))
                .containsExactlyInAnyOrder("데일리 리트코드", "지난 알고리즘", "북클럽", "영어 회화 4기");
        assertThat(titles(get("?recruitmentZone=America/Toronto")))
                .containsExactlyInAnyOrder("Spring 딥다이브", "지난 알고리즘", "북클럽", "영어 회화 4기");
        assertThat(titles(get("?recruitmentZone=Asia/Tokyo")))
                .containsExactlyInAnyOrder("지난 알고리즘", "북클럽", "영어 회화 4기");
    }

    @Test
    @DisplayName("성공 - 모집 시간대 필터: deprecated 링크는 정본으로 읽고, 모집 회차가 없는 스터디는 미정처럼 나온다")
    void filterByRecruitmentZone_aliasAndNoRecruitment() {
        studyRepo.save(
                study("모집 회차 없음", "회차 없이 공개", StudyCategory.OTHER, StudyStatus.OPEN).build());

        assertThat(titles(get("?recruitmentZone=US/Pacific")))
                .containsExactlyInAnyOrder("데일리 리트코드", "지난 알고리즘", "북클럽", "영어 회화 4기", "모집 회차 없음");
        assertThat(get("?recruitmentZone=US/Pacific")).containsEntry("total", 5);
    }

    @Test
    @DisplayName("실패 - 모집 시간대 필터가 오프셋 · 모르는 값이면 400")
    void filterByRecruitmentZone_invalid() {
        for (String zone : List.of("%2B09:00", "KST", "Mars/Olympus")) {
            var response = rest.getForEntity("/api/studies?recruitmentZone=" + zone, Map.class);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        }
    }

    @Test
    @DisplayName("성공 - 필터 후보: 공개 스터디의 selected 지역만 표시 순서로, 조합 · DRAFT · all · unset 은 후보를 만들지 않는다")
    @SuppressWarnings("unchecked")
    void recruitmentZoneCandidates() {
        var response = rest.getForEntity("/api/studies/recruitment-zones", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var items = (List<Map<String, Object>>) response.getBody().get("items");
        assertThat(items)
                .containsExactly(
                        Map.of("timeZone", "Asia/Seoul", "recruitmentZoneShortLabel", "한국"),
                        Map.of(
                                "timeZone",
                                "America/Los_Angeles",
                                "recruitmentZoneShortLabel",
                                "미국 · LA"),
                        Map.of(
                                "timeZone",
                                "America/Toronto",
                                "recruitmentZoneShortLabel",
                                "캐나다 · 토론토"));
    }

    @Test
    @DisplayName("성공 - 키워드는 제목과 한 줄 소개를 대소문자 구분 없이 찾는다")
    void filterByKeyword() {
        assertThat(titles(get("?keyword=리트코드"))).containsExactly("데일리 리트코드");
        assertThat(titles(get("?keyword=독서"))).containsExactly("북클럽");
        assertThat(titles(get("?keyword=spring"))).containsExactly("Spring 딥다이브");
    }

    @Test
    @DisplayName("성공 - 모집 마감일 필터 (종료 임박) 는 모집 중인 스터디만 고른다")
    void filterByRecruitDeadlineBefore() {
        Instant threeDaysLater = Instant.now().plus(3, ChronoUnit.DAYS);

        assertThat(titles(get("?recruitDeadlineBefore=" + threeDaysLater)))
                .containsExactly("데일리 리트코드");
    }

    @Test
    @DisplayName("성공 - 카드에 필요한 필드와 파생값을 내려준다")
    void responseFields() {
        var closed = items(get("?status=CLOSED")).getFirst();

        assertThat(closed)
                .containsEntry("title", "지난 알고리즘")
                .containsEntry("oneLineSummary", "종료된 스터디")
                .containsEntry("category", "ALGORITHM")
                .containsEntry("studyKind", "STUDY")
                .containsEntry("phase", "CLOSED")
                .containsEntry("recruitmentTimeZones", Map.of("mode", "all", "zones", List.of()))
                .containsEntry("recruitmentTimeZoneLabel", "모든 시간대에서 모집")
                .containsEntry("canApply", false)
                .containsKeys(
                        "thumbnailUrl",
                        "schedule",
                        "endAt",
                        "closingSoon",
                        "recruitDeadlineFormatted",
                        "startAtFormatted")
                .doesNotContainKey("timezone");
        var leetcode = items(get("?keyword=리트코드")).getFirst();
        assertThat(leetcode)
                .containsEntry(
                        "recruitmentTimeZones",
                        Map.of(
                                "mode",
                                "selected",
                                "zones",
                                List.of("Asia/Seoul", "America/Los_Angeles")))
                .containsEntry("recruitmentTimeZoneLabel", "한국 / 미국 · LA")
                .containsEntry("canApply", true);
    }

    @Test
    @DisplayName("성공 - 시각 표시: 비로그인은 timeZone Query, 없으면 서울. 마감은 dDay 와 약칭을 함께 준다")
    @SuppressWarnings("unchecked")
    void formattedDeadline() {
        assertThat(get("?keyword=리트코드")).containsEntry("displayTimeZone", "Asia/Seoul");

        var body = get("?keyword=리트코드&timeZone=America/Toronto");
        assertThat(body).containsEntry("displayTimeZone", "America/Toronto");
        var deadline = (Map<String, Object>) items(body).getFirst().get("recruitDeadlineFormatted");
        assertThat(deadline)
                .containsEntry("displayTimeZone", "America/Toronto")
                .containsEntry("clock24", true)
                .containsKeys("instant", "localDate", "localTime", "abbreviation", "offsetLabel")
                .containsKey("dDay");
        assertThat((Integer) deadline.get("dDay")).isBetween(1, 3);
    }

    @Test
    @DisplayName("성공 - 페이지네이션은 DB 에서 자른다 — offset 이 밀려도 total 은 전체 건수")
    void pagination() {
        var first = get("?offset=0&limit=2");
        assertThat(first).containsEntry("total", 6).containsEntry("offset", 0);
        assertThat(items(first)).hasSize(2);

        var second = get("?offset=5&limit=2");
        assertThat(second).containsEntry("total", 6);
        assertThat(items(second)).hasSize(1);
        assertThat(titles(second)).doesNotContainAnyElementsOf(titles(first));
    }

    @Test
    @DisplayName("성공 - 같은 프로그램의 진행 중 기수와 모집 중 기수가 둘 다 나온다 (기수를 묶지 않는다)")
    void seasonsOfSameProgramAreListedTogether() {
        assertThat(titles(get("?keyword=영어 회화"))).containsExactlyInAnyOrder("영어 회화 3기", "영어 회화 4기");
        assertThat(titles(get("?status=ONGOING"))).contains("영어 회화 3기");
        assertThat(titles(get("?status=RECRUITING"))).contains("영어 회화 4기");
    }

    @Test
    @DisplayName("성공 - 응답에 items/total/offset/limit 구조를 쓴다 (endpoint convention)")
    void responseFormat() {
        var body = get("");

        assertThat(body).containsKeys("items", "total", "offset", "limit");
        assertThat(body).doesNotContainKey("success");
    }

    @Test
    @DisplayName("실패 - 없는 모집 상태 값이면 400")
    void invalidStatus() {
        var response = rest.getForEntity("/api/studies?status=OPEN", Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
