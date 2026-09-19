package com.studyclub.api.study;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
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
    @Autowired StudyProgramRepository studyProgramRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyParticipantRepository participantRepo;
    @Autowired StudyRecruitmentRepository recruitmentRepo;

    private final AtomicLong accountIdSeq = new AtomicLong(1);
    private final AtomicLong slugSeq = new AtomicLong(1);

    @BeforeEach
    void setUp() {
        participantRepo.deleteAll();
        recruitmentRepo.deleteAll();
        studyRepo.deleteAll();
        studyProgramRepo.deleteAll();
        accountIdSeq.set(1);
        slugSeq.set(1);
    }

    @Test
    @DisplayName("성공 — 목록: 마감 전 + 정원 미달이면 recruitStatus=RECRUITING")
    void listRecruiting() {
        openStudy(30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(firstListItem()).containsEntry("recruitStatus", "RECRUITING");
    }

    @Test
    @DisplayName("성공 — 목록: 마감 시각이 지나면 recruitStatus=RECRUIT_CLOSED")
    void listRecruitClosedByDeadline() {
        openStudy(30, Instant.now().minus(1, ChronoUnit.DAYS));

        assertThat(firstListItem()).containsEntry("recruitStatus", "RECRUIT_CLOSED");
    }

    @Test
    @DisplayName("성공 — 목록: 정원이 차면 마감 전이어도 recruitStatus=RECRUIT_CLOSED")
    void listRecruitClosedByCapacity() {
        var study = openStudy(2, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(study, ParticipantStatus.ACTIVE);
        enroll(study, ParticipantStatus.PAUSED);

        var body = firstListItem();
        assertThat(body).containsEntry("recruitStatus", "RECRUIT_CLOSED");
        assertThat(body).containsEntry("currentApplicants", 2);
    }

    @Test
    @DisplayName("성공 — 목록: 정원 null(무제한)이면 참여자가 아무리 많아도 RECRUITING")
    void listNullCapacityNeverFills() {
        var study = openStudy(null, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(study, ParticipantStatus.ACTIVE);
        enroll(study, ParticipantStatus.ACTIVE);
        enroll(study, ParticipantStatus.PAUSED);

        var body = firstListItem();
        assertThat(body).containsEntry("recruitStatus", "RECRUITING");
        assertThat(body).containsEntry("currentApplicants", 3);
    }

    @Test
    @DisplayName("성공 — 목록: 탈퇴 참여자는 정원을 차지하지 않는다")
    void listWithdrawnDoesNotTakeSeat() {
        var study = openStudy(2, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(study, ParticipantStatus.ACTIVE);
        enroll(study, ParticipantStatus.WITHDRAWN);

        var body = firstListItem();
        assertThat(body).containsEntry("currentApplicants", 1);
        assertThat(body).containsEntry("recruitStatus", "RECRUITING");
    }

    @Test
    @DisplayName("성공 — 목록: STATUS 가 OPEN 이 아니면 recruitStatus 는 null")
    void listNoRecruitStatusWhenNotOpen() {
        createStudy(StudyStatus.DRAFT, 30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(firstListItem()).containsEntry("recruitStatus", null);
    }

    @Test
    @DisplayName("성공 — 상세: 정원이 차면 recruitStatus=RECRUIT_CLOSED")
    void detailRecruitClosedByCapacity() {
        var study = openStudy(1, Instant.now().plus(7, ChronoUnit.DAYS));
        enroll(study, ParticipantStatus.ACTIVE);

        assertThat(detailBody(study.getId())).containsEntry("recruitStatus", "RECRUIT_CLOSED");
    }

    @Test
    @DisplayName("성공 — 상세: 마감 전 + 정원 미달이면 recruitStatus=RECRUITING")
    void detailRecruiting() {
        var study = openStudy(30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(detailBody(study.getId())).containsEntry("recruitStatus", "RECRUITING");
    }

    @Test
    @DisplayName("성공 — 상세: STATUS 가 CLOSED 면 recruitStatus 는 null")
    void detailNoRecruitStatusWhenClosed() {
        var study = createStudy(StudyStatus.CLOSED, 30, Instant.now().plus(7, ChronoUnit.DAYS));

        assertThat(detailBody(study.getId())).containsEntry("recruitStatus", null);
    }

    // ── fixtures ──────────────────────────────────────────────────────────

    private Study openStudy(Integer capacity, Instant recruitDeadline) {
        return createStudy(StudyStatus.OPEN, capacity, recruitDeadline);
    }

    private Study createStudy(StudyStatus status, Integer capacity, Instant recruitDeadline) {
        var program = studyProgramRepo.save(StudyProgram.builder().title("모집 상태 스터디").build());
        var study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .slug("recruit-status-" + slugSeq.getAndIncrement())
                                .title("모집 상태 스터디")
                                .oneLineSummary("모집 상태 계산 검증용")
                                .category(StudyCategory.BACKEND)
                                .studyKind(StudyKind.STUDY)
                                .description("설명")
                                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                                .status(status)
                                .capacity(capacity)
                                .startAt(Instant.now().plus(30, ChronoUnit.DAYS))
                                .build());
        recruitmentRepo.save(
                StudyRecruitment.builder()
                        .studyId(study.getId())
                        .title("모집")
                        .description("모집 설명")
                        .startAt(Instant.now().minus(7, ChronoUnit.DAYS))
                        .recruitDeadlineAt(recruitDeadline)
                        .build());
        return study;
    }

    private void enroll(Study study, ParticipantStatus status) {
        participantRepo.save(
                StudyParticipant.builder()
                        .accountId(accountIdSeq.getAndIncrement())
                        .studyGroupId(1L)
                        .studyId(study.getId())
                        .status(status)
                        .participantRole(ParticipantRole.MEMBER)
                        .joinedAt(Instant.now())
                        .build());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> firstListItem() {
        var response = rest.getForEntity("/api/studies", Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var items = (java.util.List<Map<String, Object>>) response.getBody().get("items");
        assertThat(items).hasSize(1);
        return items.get(0);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> detailBody(Long studyId) {
        var response = rest.getForEntity("/api/studies/" + studyId, Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return response.getBody();
    }
}
