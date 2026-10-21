package com.studyclub.api.attendance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;

import com.studyclub.api.auth.AccountDeletionService;
import com.studyclub.api.meeting.StudyMeetingService;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.attendance.StudyAttendanceRepository;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyMeeting;
import com.studyclub.domain.study.StudyMeetingRepository;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AttendanceWithdrawalConcurrencyIntegrationTest {

    private static final Long LEADER_ACCOUNT_ID = 33001L;
    private static final Long MEMBER_ACCOUNT_ID = 33002L;

    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @Autowired StudyProgramRepository studyProgramRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyGroupRepository studyGroupRepository;
    @Autowired StudyMeetingRepository studyMeetingRepository;
    @MockitoSpyBean StudyParticipantRepository studyParticipantRepository;
    @Autowired StudyAttendanceRepository studyAttendanceRepository;

    @Autowired AttendanceUpsertService attendanceUpsertService;
    @Autowired AccountDeletionService accountDeletionService;
    @Autowired StudyMeetingService studyMeetingService;
    @Autowired EntityManager entityManager;

    private Study study;
    private StudyGroup group;
    private StudyParticipant participantB;

    @BeforeEach
    void setUp() {
        studyAttendanceRepository.deleteAll();
        studyParticipantRepository.deleteAll();
        studyMeetingRepository.deleteAll();
        studyGroupRepository.deleteAll();
        studyRepository.deleteAll();
        studyProgramRepository.deleteAll();

        insertAccountIfAbsent(
                LEADER_ACCOUNT_ID, "리더", "leader@withdraw-concurrency.com", SystemRole.ADMIN);
        insertAccountIfAbsent(
                MEMBER_ACCOUNT_ID, "멤버", "member@withdraw-concurrency.com", SystemRole.MEMBER);

        var program =
                studyProgramRepository.save(
                        StudyProgram.builder()
                                .title("테스트 프로그램")
                                .studyKind(StudyKind.STUDY)
                                .build());

        study =
                studyRepository.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("Upsert 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.OPEN)
                                .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                                .build());

        group =
                studyGroupRepository.save(
                        new StudyGroup(
                                study.getId(),
                                "A반",
                                Instant.now().minus(21, ChronoUnit.DAYS),
                                "Asia/Seoul",
                                10));

        Instant joinedAt = Instant.now().minus(21, ChronoUnit.DAYS);
        studyParticipantRepository.save(
                StudyParticipant.builder()
                        .accountId(LEADER_ACCOUNT_ID)
                        .studyGroupId(group.getId())
                        .studyId(study.getId())
                        .status(ParticipantStatus.ACTIVE)
                        .participantRole(ParticipantRole.LEADER)
                        .joinedAt(joinedAt)
                        .build());
        participantB =
                studyParticipantRepository.save(
                        StudyParticipant.builder()
                                .accountId(MEMBER_ACCOUNT_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(joinedAt)
                                .build());
    }

    @ParameterizedTest
    @CsvSource({"withdraw,delete", "delete,withdraw", "withdraw,signup", "signup,withdraw"})
    @DisplayName("앞 요청의 분반 잠금이 뒤 요청을 막는다 — 탈퇴 상태·중단 시각·발표자 배정을 덮어쓰지 않는다")
    void serializesConflictingRequests(String firstAction, String secondAction) throws Exception {
        var future =
                studyMeetingRepository.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().plus(3, ChronoUnit.DAYS), "미래"));
        CountDownLatch reached = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean first = new AtomicBoolean(true);
        AtomicReference<Instant> withdrawnAt = new AtomicReference<>();
        doAnswer(
                        inv -> {
                            var rows =
                                    entityManager
                                            .createQuery(
                                                    "SELECT p FROM StudyParticipant p WHERE p.id IN :ids AND p.studyId = :studyId ORDER BY p.id",
                                                    StudyParticipant.class)
                                            .setParameter("ids", inv.getArgument(0))
                                            .setParameter("studyId", inv.getArgument(1))
                                            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                                            .getResultList();
                            pauseFirst(firstAction, "withdraw", first, reached, release);
                            return rows;
                        })
                .when(studyParticipantRepository)
                .findByIdInAndStudyIdForUpdate(any(), anyLong());
        doAnswer(
                        inv -> {
                            var rows =
                                    entityManager
                                            .createQuery(
                                                    "SELECT p FROM StudyParticipant p WHERE p.accountId = :accountId ORDER BY p.id",
                                                    StudyParticipant.class)
                                            .setParameter("accountId", inv.getArgument(0))
                                            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                                            .getResultList();
                            if (firstAction.equals("withdraw")) {
                                withdrawnAt.set(rows.getFirst().getLeftAt());
                            }
                            pauseFirst(firstAction, "delete", first, reached, release);
                            return rows;
                        })
                .when(studyParticipantRepository)
                .findByAccountIdForUpdate(anyLong());
        doAnswer(
                        inv -> {
                            var rows =
                                    entityManager
                                            .createQuery(
                                                    "SELECT p FROM StudyParticipant p WHERE p.studyGroupId = :groupId ORDER BY p.id",
                                                    StudyParticipant.class)
                                            .setParameter("groupId", inv.getArgument(0))
                                            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                                            .getResultList();
                            pauseFirst(firstAction, "signup", first, reached, release);
                            return rows;
                        })
                .when(studyParticipantRepository)
                .findByStudyGroupIdForUpdate(anyLong());

        var executor = Executors.newFixedThreadPool(2);
        try {
            var firstRequest = executor.submit(() -> perform(firstAction, future.getId()));
            assertThat(reached.await(10, TimeUnit.SECONDS)).isTrue();
            var secondRequest = executor.submit(() -> perform(secondAction, future.getId()));
            assertThat(awaitBlockedSession()).as("뒤 요청이 실제 DB 잠금 대기 상태여야 한다").isTrue();
            assertThat(secondRequest.isDone()).isFalse();
            release.countDown();
            firstRequest.get(10, TimeUnit.SECONDS);
            if (firstAction.equals("delete") || secondAction.equals("signup")) {
                ErrorCode expected =
                        firstAction.equals("delete")
                                ? ErrorCode.PARTICIPANT_NOT_ACTIVE
                                : ErrorCode.FORBIDDEN;
                assertThatThrownBy(() -> secondRequest.get(10, TimeUnit.SECONDS))
                        .hasRootCauseInstanceOf(BusinessException.class)
                        .satisfies(
                                e ->
                                        assertThat(((BusinessException) e.getCause()).errorCode())
                                                .isEqualTo(expected));
            } else {
                secondRequest.get(10, TimeUnit.SECONDS);
            }
            var saved = studyParticipantRepository.findById(participantB.getId()).orElseThrow();
            assertThat(saved.getStatus())
                    .isEqualTo(
                            firstAction.equals("delete") || secondAction.equals("delete")
                                    ? ParticipantStatus.DELETED
                                    : ParticipantStatus.WITHDRAWN);
            assertThat(saved.getLeftAt()).isNotNull();
            if (secondAction.equals("delete")) {
                assertThat(withdrawnAt.get()).isNotNull();
                assertThat(saved.getLeftAt()).isEqualTo(withdrawnAt.get());
            }
            assertThat(
                            studyMeetingRepository
                                    .findById(future.getId())
                                    .orElseThrow()
                                    .getPresenter1ParticipantId())
                    .isNull();
        } finally {
            release.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private void perform(String action, Long meetingId) {
        switch (action) {
            case "withdraw" ->
                    attendanceUpsertService.upsert(
                            study.getId(),
                            group.getId(),
                            new AttendanceUpsertRequest(
                                    group.getId(), List.of(), List.of(participantB.getId())),
                            LEADER_ACCOUNT_ID,
                            false);
            case "delete" -> accountDeletionService.deleteAccount(MEMBER_ACCOUNT_ID, null);
            case "signup" ->
                    studyMeetingService.signUpPresenter(
                            MEMBER_ACCOUNT_ID, study.getId(), meetingId, 1);
            default -> throw new IllegalArgumentException(action);
        }
    }

    private void pauseFirst(
            String expected,
            String actual,
            AtomicBoolean first,
            CountDownLatch reached,
            CountDownLatch release)
            throws InterruptedException {
        if (expected.equals(actual) && first.getAndSet(false)) {
            reached.countDown();
            if (!release.await(15, TimeUnit.SECONDS)) {
                throw new IllegalStateException("잠금 해제 신호가 오지 않았습니다.");
            }
        }
    }

    private boolean awaitBlockedSession() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            Long blocked =
                    jdbcTemplate.queryForObject(
                            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.SESSIONS WHERE BLOCKER_ID IS NOT NULL",
                            Long.class);
            if (blocked != null && blocked > 0) return true;
            Thread.sleep(20);
        }
        return false;
    }

    private void insertAccountIfAbsent(Long id, String nickname, String email, SystemRole role) {
        if (accountRepository.findById(id).isPresent()) {
            return;
        }
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
                "INSERT INTO ACCOUNT (ID, EMAIL, NICKNAME, SYSTEM_ROLE, TIME_ZONE,"
                        + " ONBOARDING_COMPLETED_AT, CREATED_AT, UPDATED_AT)"
                        + " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id,
                email,
                nickname,
                role.name(),
                "Asia/Seoul",
                now,
                now,
                now);
    }
}
