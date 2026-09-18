package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.DeliveryFormat;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyCohort;
import com.studyclub.domain.study.StudyCohortRepository;
import com.studyclub.domain.study.StudyCohortStatus;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class StudyRecruitStatusIntegrationTest {

    @Autowired TestRestTemplate rest;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyCohortRepository cohortRepo;
    @Autowired StudyParticipantRepository participantRepo;

    private final AtomicLong accountIdSeq = new AtomicLong(1);
    private final AtomicLong slugSeq = new AtomicLong(1);

    @BeforeEach
    void setUp() {
        participantRepo.deleteAll();
        cohortRepo.deleteAll();
        studyRepo.deleteAll();
        accountIdSeq.set(1);
        slugSeq.set(1);
    }

    @Test
    @DisplayName("성공 — 목록: 마감 전 + 정원 미달이면 recruitStatus=RECRUITING")
    void listRecruiting() {
        openCohort(30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(firstListCohort()).containsEntry("recruitStatus", "RECRUITING");
    }

    @Test
    @DisplayName("성공 — 목록: 마감 시각이 지나면 recruitStatus=RECRUIT_CLOSED")
    void listRecruitClosedByDeadline() {
        openCohort(30, Instant.now().minus(1, ChronoUnit.DAYS));

        assertThat(firstListCohort()).containsEntry("recruitStatus", "RECRUIT_CLOSED");
    }

    @Test
    @DisplayName("성공 — 목록: 정원이 차면 마감 전이어도 recruitStatus=RECRUIT_CLOSED")
    void listRecruitClosedByCapacity() {
        var cohort = openCohort(2, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(cohort, ParticipantStatus.ACTIVE);
        enroll(cohort, ParticipantStatus.PAUSED);

        var body = firstListCohort();
        assertThat(body).containsEntry("recruitStatus", "RECRUIT_CLOSED");
        assertThat(body).containsEntry("currentApplicants", 2);
    }

    @Test
    @DisplayName("성공 — 목록: 정원 null(무제한)이면 참여자가 아무리 많아도 RECRUITING")
    void listNullCapacityNeverFills() {
        var cohort = openCohort(null, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(cohort, ParticipantStatus.ACTIVE);
        enroll(cohort, ParticipantStatus.ACTIVE);
        enroll(cohort, ParticipantStatus.PAUSED);

        var body = firstListCohort();
        assertThat(body).containsEntry("recruitStatus", "RECRUITING");
        assertThat(body).containsEntry("currentApplicants", 3);
    }

    @Test
    @DisplayName("성공 — 목록: 탈퇴 참여자는 정원을 차지하지 않는다")
    void listWithdrawnDoesNotTakeSeat() {
        var cohort = openCohort(2, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(cohort, ParticipantStatus.ACTIVE);
        enroll(cohort, ParticipantStatus.WITHDRAWN);

        var body = firstListCohort();
        assertThat(body).containsEntry("currentApplicants", 1);
        assertThat(body).containsEntry("recruitStatus", "RECRUITING");
    }

    @Test
    @DisplayName("성공 — 목록: STATUS 가 OPEN 이 아니면 recruitStatus 는 null")
    void listNoRecruitStatusWhenNotOpen() {
        cohort(StudyCohortStatus.DRAFT, 30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(firstListCohort()).containsEntry("recruitStatus", null);
    }

    @Test
    @DisplayName("성공 — 상세: 정원이 차면 recruitStatus=RECRUIT_CLOSED")
    void detailRecruitClosedByCapacity() {
        var cohort = openCohort(1, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(cohort, ParticipantStatus.ACTIVE);

        assertThat(detailCohort(cohort.getStudyId()))
                .containsEntry("recruitStatus", "RECRUIT_CLOSED");
    }

    @Test
    @DisplayName("성공 — 상세: 마감 전 + 정원 미달이면 recruitStatus=RECRUITING")
    void detailRecruiting() {
        var cohort = openCohort(30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(detailCohort(cohort.getStudyId())).containsEntry("recruitStatus", "RECRUITING");
    }

    @Test
    @DisplayName("성공 — 상세: STATUS 가 CLOSED 면 recruitStatus 는 null")
    void detailNoRecruitStatusWhenClosed() {
        var cohort = cohort(StudyCohortStatus.CLOSED, 30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(detailCohort(cohort.getStudyId())).containsEntry("recruitStatus", null);
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private StudyCohort openCohort(Integer capacity, Instant recruitDeadline) {
        return cohort(StudyCohortStatus.OPEN, capacity, recruitDeadline);
    }

    private StudyCohort cohort(
            StudyCohortStatus status, Integer capacity, Instant recruitDeadline) {
        var study =
                studyRepo.save(
                        Study.builder()
                                .slug("recruit-status-" + slugSeq.getAndIncrement())
                                .title("모집 상태 스터디")
                                .oneLineSummary("모집 상태 계산 검증용")
                                .category(StudyCategory.BACKEND)
                                .studyKind(StudyKind.STUDY)
                                .description("설명")
                                .build());
        return cohortRepo.save(
                StudyCohort.builder()
                        .studyId(study.getId())
                        .studyDeliveryFormat(DeliveryFormat.ONLINE)
                        .status(status)
                        .capacity(capacity)
                        .recruitDeadline(recruitDeadline)
                        .startDate(Instant.now().plus(30, ChronoUnit.DAYS))
                        .build());
    }

    private void enroll(StudyCohort cohort, ParticipantStatus status) {
        participantRepo.save(
                StudyParticipant.builder()
                        .accountId(accountIdSeq.getAndIncrement())
                        .studyClassId(1L)
                        .studyCohortId(cohort.getId())
                        .status(status)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now())
                        .build());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> firstListCohort() {
        var response = rest.getForEntity("/api/studies", Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var items = (java.util.List<Map<String, Object>>) response.getBody().get("items");
        assertThat(items).hasSize(1);
        return (Map<String, Object>) items.get(0).get("cohort");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> detailCohort(Long studyId) {
        var response = rest.getForEntity("/api/studies/" + studyId, Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return (Map<String, Object>) response.getBody().get("cohort");
    }
}
