package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
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
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

/**
 * 같은 UTC 마감을 한국 · LA · 토론토에서 본다 — 신청 가능 여부는 같고 날짜 · dDay 만 다를 수 있다 (PRD §6 · §9,
 * specs/timezone/spec.md §10).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyDeadlineTimeZoneIntegrationTest {

    private static final List<String> VIEWERS =
            List.of("Asia/Seoul", "America/Los_Angeles", "America/Toronto");

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyProgramRepository studyProgramRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyRecruitmentRepository studyRecruitmentRepository;

    @Test
    @DisplayName("성공 - 마감 전: 세 지역 모두 canApply=true · RECRUITING, localDate · dDay 는 각 지역 달력대로")
    @SuppressWarnings("unchecked")
    void openDeadlineSameDecisionDifferentCalendar() {
        // 서울 새벽 03:00 — LA · 토론토에서는 하루 앞 날짜다
        Instant deadline =
                LocalDate.now(ZoneId.of("Asia/Seoul"))
                        .plusDays(3)
                        .atTime(3, 0)
                        .atZone(ZoneId.of("Asia/Seoul"))
                        .toInstant();
        Long studyId = openStudy(deadline);

        for (String zone : VIEWERS) {
            Map<String, Object> detail = detail(studyId, zone);
            assertThat(detail)
                    .as(zone)
                    .containsEntry("canApply", true)
                    .containsEntry("recruitStatus", "RECRUITING")
                    .containsEntry("displayTimeZone", zone)
                    .containsEntry("recruitDeadlineAt", deadline.toString());
            var formatted = (Map<String, Object>) detail.get("recruitDeadlineFormatted");
            LocalDate localDeadline = deadline.atZone(ZoneId.of(zone)).toLocalDate();
            assertThat(formatted)
                    .as(zone)
                    .containsEntry("instant", deadline.toString())
                    .containsEntry("localDate", localDeadline.toString())
                    .containsEntry(
                            "dDay",
                            (int)
                                    ChronoUnit.DAYS.between(
                                            LocalDate.now(ZoneId.of(zone)), localDeadline));
        }
        assertThat(
                        ((Map<String, Object>)
                                        detail(studyId, "Asia/Seoul")
                                                .get("recruitDeadlineFormatted"))
                                .get("localDate"))
                .isNotEqualTo(
                        ((Map<String, Object>)
                                        detail(studyId, "America/Los_Angeles")
                                                .get("recruitDeadlineFormatted"))
                                .get("localDate"));
    }

    @Test
    @DisplayName("성공 - 마감 직후: 세 지역 모두 canApply=false · RECRUIT_CLOSED, dDay 는 null")
    @SuppressWarnings("unchecked")
    void closedDeadlineClosedEverywhere() {
        Long studyId = openStudy(Instant.now().minusMillis(1));

        for (String zone : VIEWERS) {
            Map<String, Object> detail = detail(studyId, zone);
            assertThat(detail)
                    .as(zone)
                    .containsEntry("canApply", false)
                    .containsEntry("recruitStatus", "RECRUIT_CLOSED");
            assertThat((Map<String, Object>) detail.get("recruitDeadlineFormatted"))
                    .as(zone)
                    .containsEntry("dDay", null);
        }
    }

    @Test
    @DisplayName("성공 - 크루 사이트는 프로필이 Query 보다 앞선다. 비로그인은 Query, 없으면 서울")
    void crewSitePrefersProfile() {
        Long studyId = openStudy(Instant.now().plus(5, ChronoUnit.DAYS));
        Account crew =
                new Account(
                        "deadline-" + UUID.randomUUID() + "@example.com",
                        "dl" + UUID.randomUUID().toString().replace("-", "").substring(0, 10),
                        null,
                        SystemRole.MEMBER);
        crew.completeOnboarding(crew.getNickname(), "America/Toronto", Instant.now());
        crew = accountRepository.save(crew);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(crew.getId()), crew.getEmail()));

        var loggedIn =
                rest.exchange(
                        "/api/studies/" + studyId + "?timeZone=Asia/Seoul",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        Map.class);

        assertThat(loggedIn.getBody()).containsEntry("displayTimeZone", "America/Toronto");
        assertThat(rest.getForEntity("/api/studies/" + studyId, Map.class).getBody())
                .containsEntry("displayTimeZone", "Asia/Seoul");
        assertThat(
                        rest.getForEntity(
                                        "/api/studies/" + studyId + "?timeZone=GMT%2B9", Map.class)
                                .getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> detail(Long studyId, String zone) {
        var response =
                rest.getForEntity("/api/studies/" + studyId + "?timeZone=" + zone, Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }

    private Long openStudy(Instant deadline) {
        StudyProgram program =
                studyProgramRepository.save(
                        StudyProgram.builder().title("마감 비교").studyKind(StudyKind.STUDY).build());
        Study study =
                studyRepository.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("마감 비교")
                                .oneLineSummary("같은 UTC 마감")
                                .category(StudyCategory.DATA)
                                .status(StudyStatus.OPEN)
                                .build());
        studyRecruitmentRepository.save(
                StudyRecruitment.builder()
                        .studyId(study.getId())
                        .title("모집")
                        .description("")
                        .startAt(Instant.now().minus(1, ChronoUnit.DAYS))
                        .recruitDeadlineAt(deadline)
                        .build());
        return study.getId();
    }
}
