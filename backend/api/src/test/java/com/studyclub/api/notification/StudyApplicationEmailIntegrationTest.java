package com.studyclub.api.notification;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.studyclub.api.application.StudyApplicationRequests.SubmitStudyApplicationRequest;
import com.studyclub.api.application.StudyApplicationService;
import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.ops.OpsAlertNotifier;
import com.studyclub.api.ops.StudyApplicationMailAlertListener;
import com.studyclub.api.studygroup.AdminStudyOwnerCaptainService;
import com.studyclub.domain.account.*;
import com.studyclub.domain.application.StudyApplicationRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.*;
import com.studyclub.notification.*;
import com.studyclub.notification.mail.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
        properties = {
            "spring.datasource.url=${CAPTAIN_MAIL_TEST_DB:jdbc:h2:mem:captain-mail;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000}",
            "notification.back-office-base-url=https://back-office-stage.studyclub.life/"
        })
class StudyApplicationEmailIntegrationTest {
    @Autowired AccountRepository accounts;
    @Autowired StudyRepository studies;
    @Autowired StudyRecruitmentRepository recruitments;
    @Autowired StudyApplicationRepository applications;
    @Autowired StudyParticipantRepository participants;
    @Autowired StudyApplicationService service;
    @Autowired AdminStudyOwnerCaptainService owners;
    @Autowired AccountDeletionService deletion;
    @Autowired NotificationTemplateRepository templates;
    @MockitoSpyBean NotificationRepository notifications;
    @MockitoSpyBean StudyApplicationEmailListener reservationListener;
    @MockitoSpyBean StudyApplicationMailAlertListener skipLog;
    @Autowired NotificationPollingScheduler poller;
    @Autowired NotificationResendService resend;
    @Autowired NotificationQueryService query;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean MailClient mail;
    @MockitoBean OpsAlertNotifier ops;
    Account captain;
    Account applicant;
    Study study;
    String html;

    @BeforeEach
    void setUp() throws Exception {
        notifications.deleteAll();
        templates.deleteAll();
        html =
                Files.readString(
                        Path.of(
                                "../../frontend/apps/playground/src/proto/mail/templates/study-application-received-email.html"));
        jdbc.execute(
                Files.readString(
                        Path.of(
                                "../notification/src/main/resources/db/migration/V68__study_application_received_email.sql")));
        captain = account(SystemRole.ADMIN);
        applicant = account(SystemRole.MEMBER);
        study =
                studies.save(
                        Study.builder()
                                .programId(1L)
                                .title("테스트 <스터디>")
                                .oneLineSummary("테스트")
                                .description("설명")
                                .category(StudyCategory.SOFTWARE)
                                .status(StudyStatus.OPEN)
                                .applicationForm("{\"questions\":[]}")
                                .createdBy(999999L)
                                .ownerCaptainId(captain.getId())
                                .build());
        recruitments.save(
                StudyRecruitment.builder()
                        .studyId(study.getId())
                        .title("모집")
                        .description("설명")
                        .startAt(Instant.now().minusSeconds(60))
                        .build());
    }

    @Test
    @DisplayName("명부에 없는 현재 담당 캡틴에게만 예약하고 개인정보 없이 신청자 탭으로 보낸다")
    void reservesCurrentCaptainAndDispatchesAfterCommit() {
        Long id = submit(applicant);
        Notification row = onlyMail();
        assertThat(row.getReferenceId()).isEqualTo(id);
        assertThat(row.getRecipientUserId()).isEqualTo(captain.getId());
        assertThat(row.getPayload())
                .containsExactlyInAnyOrderEntriesOf(
                        Map.of(
                                "studyTitle",
                                study.getTitle(),
                                "applicationsUrl",
                                "https://back-office-stage.studyclub.life/studies/"
                                        + study.getId()
                                        + "?tab=crew"));
        assertThat(row.getStatus()).isEqualTo(NotificationStatus.PENDING);
        verifyNoInteractions(mail);
        poller.poll();
        verify(mail)
                .send(
                        eq(MailCategory.NOTIFY),
                        eq(captain.getEmail()),
                        eq("[StudyClub] 테스트 <스터디>에 새 신청이 도착했어요"),
                        argThat(
                                body ->
                                        body.contains("테스트 &lt;스터디&gt;")
                                                && body.contains("?tab=crew")
                                                && !body.contains(applicant.getEmail())
                                                && !body.contains(applicant.getNickname())));
        assertThat(onlyMail().getStatus()).isEqualTo(NotificationStatus.SENT);
    }

    @Test
    @DisplayName("담당 캡틴 자신의 신청은 접수하지만 메일과 누락 경고를 만들지 않는다")
    void skipsSelfWithoutWarning() {
        submit(captain);
        assertThat(notifications.findAll()).isEmpty();
        verify(skipLog, never()).logSkipped(any());
    }

    @ParameterizedTest
    @EnumSource(StudyApplicationMailSkipped.Reason.class)
    @DisplayName("담당자나 템플릿 누락은 신청을 막지 않고 커밋 후 사유를 운영 경고로 남긴다")
    void skipsMissingPrerequisites(StudyApplicationMailSkipped.Reason reason) {
        switch (reason) {
            case OWNER_MISSING ->
                    jdbc.update(
                            "UPDATE STUDY SET OWNER_CAPTAIN_ID = NULL WHERE ID = ?", study.getId());
            case OWNER_ACCOUNT_NOT_FOUND ->
                    jdbc.update(
                            "UPDATE STUDY SET OWNER_CAPTAIN_ID = ? WHERE ID = ?",
                            888888L,
                            study.getId());
            case OWNER_NOT_ADMIN ->
                    jdbc.update(
                            "UPDATE ACCOUNT SET SYSTEM_ROLE = 'MEMBER' WHERE ID = ?",
                            captain.getId());
            case TEMPLATE_MISSING -> templates.deleteAll();
        }
        Long id = submit(applicant);
        assertThat(applications.findById(id)).isPresent();
        assertThat(notifications.findAll()).isEmpty();
        verify(skipLog)
                .logSkipped(
                        argThat(
                                event ->
                                        event.applicationId().equals(id)
                                                && event.reason() == reason));
        verify(ops, timeout(3000))
                .send(
                        eq(OpsAlertNotifier.Level.WARN),
                        anyString(),
                        argThat(
                                fields ->
                                        fields.get("사유").equals(reason.name())
                                                && fields.get("최근 신청 ID").equals(id.toString())
                                                && !fields.toString()
                                                        .contains(applicant.getNickname())));
    }

    @Test
    @DisplayName("예약 DB 오류면 신청서와 명부도 롤백하고 실제 발송은 시작하지 않는다")
    void reservationFailureRollsBackApplication() {
        doThrow(new IllegalStateException("reservation unavailable"))
                .when(notifications)
                .save(any(Notification.class));
        assertThatThrownBy(() -> submit(applicant)).isInstanceOf(IllegalStateException.class);
        assertThat(applications.existsByStudyIdAndAccountId(study.getId(), applicant.getId()))
                .isFalse();
        assertThat(participants.findFirstByStudyIdAndAccountId(study.getId(), applicant.getId()))
                .isEmpty();
        verifyNoInteractions(mail);
    }

    @Test
    @DisplayName("롤백된 신청의 누락은 커밋 후 로그나 운영 경고로 남기지 않는다")
    void rollbackDoesNotReportSkip() {
        templates.deleteAll();
        new TransactionTemplate(transactions)
                .executeWithoutResult(
                        status -> {
                            submit(applicant);
                            status.setRollbackOnly();
                        });
        verify(skipLog, never()).logSkipped(any());
        assertThat(applications.existsByStudyIdAndAccountId(study.getId(), applicant.getId()))
                .isFalse();
    }

    @Test
    @DisplayName("중복 신청 요청은 메일 예약도 중복으로 만들지 않는다")
    void duplicateRequestDoesNotDuplicateMail() {
        submit(applicant);
        assertThatThrownBy(() -> submit(applicant))
                .isInstanceOf(com.studyclub.common.error.BusinessException.class);
        assertThat(notifications.count()).isEqualTo(1);
    }

    @Test
    @DisplayName("동일 조건 템플릿마다 예약하며 초기 시드는 기존 문구를 덮어쓰거나 중복 삽입하지 않는다")
    void templatesFanOutAndSeedIsIdempotent() throws Exception {
        assertThat(templates.findAll())
                .singleElement()
                .extracting(NotificationTemplate::getBody)
                .isEqualTo(html);
        templates.save(
                NotificationTemplate.create(
                        NotificationEventType.STUDY_APPLICATION_RECEIVED,
                        "[StudyClub] 추가",
                        "추가 문구",
                        captain.getId()));
        jdbc.execute(
                Files.readString(
                        Path.of(
                                "../notification/src/main/resources/db/migration/V68__study_application_received_email.sql")));
        submit(applicant);
        assertThat(templates.count()).isEqualTo(2);
        assertThat(notifications.count()).isEqualTo(2);
    }

    @Test
    @DisplayName("발송 실패는 신청을 취소하지 않고 같은 행을 재발송할 수 있다")
    void providerFailureCanBeResent() {
        Long id = submit(applicant);
        doThrow(new MailSendException(NotificationErrorType.PROVIDER_ERROR, "test", null))
                .when(mail)
                .send(any(), anyString(), anyString(), anyString());
        poller.poll();
        assertThat(applications.findById(id)).isPresent();
        Notification row = onlyMail();
        assertThat(row.getStatus()).isEqualTo(NotificationStatus.FAILED);
        assertThat(canResend(row)).isTrue();
        assertThat(resend.resend(List.of(row.getId())).accepted()).containsExactly(row.getId());
        assertThat(onlyMail().getStatus()).isEqualTo(NotificationStatus.PENDING);
    }

    @Test
    @DisplayName("담당자가 바뀌면 목록과 재발송이 같은 판정으로 이전 캡틴의 실패 건을 제외한다")
    void oldCaptainCannotReceiveResend() {
        submit(applicant);
        Notification row = failed();
        Account next = account(SystemRole.ADMIN);
        owners.change(study.getId(), next.getId(), captain.getId());
        assertThat(canResend(row)).isFalse();
        assertThat(resend.resend(List.of(row.getId())).skipped())
                .containsExactly(
                        new NotificationResendResponse.Skipped(
                                row.getId(), ResendSkipReason.STATE_CHANGED));
    }

    @Test
    @DisplayName("연결 신청이 없어지거나 담당자 권한이 없어져도 이전 알림을 재발송하지 않는다")
    void missingApplicationAndRolePreventResend() {
        submit(applicant);
        Notification row = failed();
        jdbc.update("UPDATE ACCOUNT SET SYSTEM_ROLE = 'MEMBER' WHERE ID = ?", captain.getId());
        assertThat(canResend(row)).isFalse();
        jdbc.update("UPDATE ACCOUNT SET SYSTEM_ROLE = 'ADMIN' WHERE ID = ?", captain.getId());
        applications.deleteById(row.getReferenceId());
        assertThat(canResend(row)).isFalse();
        assertThat(resend.resend(List.of(row.getId())).accepted()).isEmpty();
    }

    @Test
    @DisplayName("신청 예약과 담당자 변경이 겹치면 먼저 잠근 신청은 기존 캡틴, 다음 신청은 새 캡틴에게 간다")
    void assignmentWaitsForReservation() throws Exception {
        Account next = account(SystemRole.ADMIN);
        try (var pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch reached = new CountDownLatch(1), release = new CountDownLatch(1);
            blockReservation(reached, release);
            Future<Long> submission = pool.submit(() -> submit(applicant));
            assertThat(reached.await(10, TimeUnit.SECONDS)).isTrue();
            Future<?> change =
                    pool.submit(() -> owners.change(study.getId(), next.getId(), captain.getId()));
            try {
                assertThatThrownBy(() -> change.get(200, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
            } finally {
                release.countDown();
            }
            submission.get(15, TimeUnit.SECONDS);
            change.get(15, TimeUnit.SECONDS);
            assertThat(onlyMail().getRecipientUserId()).isEqualTo(captain.getId());
            submit(account(SystemRole.MEMBER));
            assertThat(notifications.findAll())
                    .extracting(Notification::getRecipientUserId)
                    .containsExactlyInAnyOrder(captain.getId(), next.getId());
        }
    }

    @Test
    @DisplayName("캡틴 탈퇴가 진행 중인 신청 예약 뒤에 와도 새 메일을 비식별화하고 대기를 취소한다")
    void deletionCleansConcurrentReservation() throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch reached = new CountDownLatch(1), release = new CountDownLatch(1);
            blockReservation(reached, release);
            Future<Long> submission = pool.submit(() -> submit(applicant));
            assertThat(reached.await(10, TimeUnit.SECONDS)).isTrue();
            Future<?> leave =
                    pool.submit(() -> deletion.deleteAccount(captain.getId(), LeaveReason.OTHER));
            try {
                assertThatThrownBy(() -> leave.get(200, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
            } finally {
                release.countDown();
            }
            submission.get(15, TimeUnit.SECONDS);
            leave.get(15, TimeUnit.SECONDS);
            assertThat(accounts.findById(captain.getId())).isEmpty();
            assertThat(onlyMail().getStatus()).isEqualTo(NotificationStatus.CANCELLED);
            assertThat(onlyMail().getRecipientValue()).isNotEqualTo(captain.getEmail());
        }
    }

    @Test
    @DisplayName("먼저 탈퇴한 담당자의 신청 알림은 만들지 않고 담당자 없음으로 기록한다")
    void deletionBeforeSubmissionSkipsMail() {
        deletion.deleteAccount(captain.getId(), LeaveReason.OTHER);
        submit(applicant);
        assertThat(notifications.findAll()).isEmpty();
        verify(skipLog)
                .logSkipped(
                        argThat(
                                e ->
                                        e.reason()
                                                == StudyApplicationMailSkipped.Reason
                                                        .OWNER_MISSING));
    }

    @Test
    @DisplayName("담당자 변경이 먼저 시작되면 재발송은 커밋을 기다린 뒤 최신 담당자로 판정한다")
    void resendWaitsForOwnerChange() throws Exception {
        submit(applicant);
        Notification row = failed();
        Account next = account(SystemRole.ADMIN);
        try (var pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch changed = new CountDownLatch(1), release = new CountDownLatch(1);
            Future<?> change =
                    pool.submit(
                            () ->
                                    new TransactionTemplate(transactions)
                                            .executeWithoutResult(
                                                    status -> {
                                                        owners.change(
                                                                study.getId(),
                                                                next.getId(),
                                                                captain.getId());
                                                        changed.countDown();
                                                        await(release);
                                                    }));
            assertThat(changed.await(10, TimeUnit.SECONDS)).isTrue();
            Future<NotificationResendResponse> result =
                    pool.submit(() -> resend.resend(List.of(row.getId())));
            try {
                assertThatThrownBy(() -> result.get(200, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
            } finally {
                release.countDown();
            }
            change.get(15, TimeUnit.SECONDS);
            assertThat(result.get(15, TimeUnit.SECONDS).skipped())
                    .containsExactly(
                            new NotificationResendResponse.Skipped(
                                    row.getId(), ResendSkipReason.STATE_CHANGED));
        }
    }

    @Test
    @DisplayName("신청 알림을 동시에 재발송해도 한쪽만 접수하고 다른 쪽은 최신 PENDING을 읽는다")
    void concurrentResendsReadFreshStatus() throws Exception {
        submit(applicant);
        Notification row = failed();
        try (var pool = Executors.newFixedThreadPool(2)) {
            CyclicBarrier start = new CyclicBarrier(2);
            Callable<NotificationResendResponse> request =
                    () -> {
                        start.await(10, TimeUnit.SECONDS);
                        return resend.resend(List.of(row.getId()));
                    };
            Future<NotificationResendResponse> a = pool.submit(request);
            Future<NotificationResendResponse> b = pool.submit(request);
            var results = List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
            assertThat(results.stream().flatMap(r -> r.accepted().stream()))
                    .containsExactly(row.getId());
            assertThat(results.stream().flatMap(r -> r.skipped().stream()))
                    .containsExactly(
                            new NotificationResendResponse.Skipped(
                                    row.getId(), ResendSkipReason.NOT_FAILED));
        }
    }

    @Test
    @DisplayName("담당 캡틴도 동시에 신청하면 계정 잠금을 역순으로 잡지 않아 두 신청이 모두 끝난다")
    void captainApplyingConcurrentlyDoesNotDeadlock() throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            CountDownLatch reached = new CountDownLatch(1), release = new CountDownLatch(1);
            blockReservation(reached, release);
            Future<Long> member = pool.submit(() -> submit(applicant));
            assertThat(reached.await(10, TimeUnit.SECONDS)).isTrue();
            Future<Long> owner = pool.submit(() -> submit(captain));
            try {
                assertThatThrownBy(() -> owner.get(200, TimeUnit.MILLISECONDS))
                        .isInstanceOf(TimeoutException.class);
            } finally {
                release.countDown();
            }
            assertThat(member.get(15, TimeUnit.SECONDS)).isNotNull();
            assertThat(owner.get(15, TimeUnit.SECONDS)).isNotNull();
            assertThat(notifications.count()).isEqualTo(1);
        }
    }

    private void await(CountDownLatch latch) {
        try {
            if (!latch.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("test timeout");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private void blockReservation(CountDownLatch reached, CountDownLatch release) {
        doAnswer(
                        invocation -> {
                            reached.countDown();
                            if (!release.await(10, TimeUnit.SECONDS))
                                throw new IllegalStateException("test timeout");
                            return invocation.callRealMethod();
                        })
                .when(reservationListener)
                .onSubmitted(any(com.studyclub.domain.application.StudyApplicationSubmitted.class));
    }

    private Account account(SystemRole role) {
        String key = UUID.randomUUID().toString().substring(0, 8);
        Account account = new Account(key + "@example.com", "nick-" + key, null, role);
        account.completeOnboarding("nick-" + key, "Asia/Seoul", Instant.now());
        account.linkDiscord(key, "handle-" + key);
        account.changeDiscordNickname("별명");
        return accounts.save(account);
    }

    private Long submit(Account who) {
        return service.submit(
                who.getId(),
                study.getId(),
                new SubmitStudyApplicationRequest("별명", List.of("mon"), null, Map.of()));
    }

    private Notification onlyMail() {
        return notifications.findAll().getFirst();
    }

    private Notification failed() {
        Notification row = onlyMail();
        Instant token = Instant.now();
        row.markProcessing(token);
        row.markFailed(NotificationErrorType.PROVIDER_ERROR, token);
        return notifications.save(row);
    }

    private boolean canResend(Notification row) {
        return query.list(null, null, List.of(row.getId()), 0, 20).items().getFirst().canResend();
    }
}
