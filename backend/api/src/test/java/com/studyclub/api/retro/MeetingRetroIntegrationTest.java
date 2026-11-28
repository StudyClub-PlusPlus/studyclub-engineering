package com.studyclub.api.retro;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.studyclub.api.auth.JwtService;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.retro.RetroSection;
import com.studyclub.domain.retro.StudyMeetingRetro;
import com.studyclub.domain.retro.StudyMeetingRetroLike;
import com.studyclub.domain.retro.StudyMeetingRetroLikeRepository;
import com.studyclub.domain.retro.StudyMeetingRetroRepository;
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
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 회고 API 통합 테스트 (specs/meeting-retro/spec.md).
 *
 * <p>계정 ID 7001–7006 을 고정으로 쓴다 — 다른 테스트와 충돌하지 않는 범위로 골랐다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class MeetingRetroIntegrationTest {

    private static final Long CAPTAIN_ID = 7001L;
    private static final Long NAVIGATOR_ID = 7002L;
    private static final Long MEMBER_A_ID = 7003L;
    private static final Long MEMBER_B_ID = 7004L;
    private static final Long OUTSIDER_ID = 7005L;

    @Autowired TestRestTemplate rest;
    @Autowired JwtService jwt;
    @Autowired AccountRepository accountRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @Autowired StudyProgramRepository programRepo;
    @Autowired StudyRepository studyRepo;
    @Autowired StudyGroupRepository groupRepo;
    @Autowired StudyMeetingRepository meetingRepo;
    @Autowired StudyParticipantRepository participantRepo;
    @Autowired StudyMeetingRetroRepository retroRepo;
    @Autowired StudyMeetingRetroLikeRepository likeRepo;

    private Study study;
    private StudyGroup group;

    /** 끝난 회차 (endAt = 2일 전). {@code nextMeeting} 덕분에 기한(5일 뒤)이 아직 남아 있어 회고를 쓸 수 있다. */
    private StudyMeeting endedMeeting;

    /** 미래 회차 (scheduledAt = 5일 뒤). {@code endedMeeting} 의 기한이 된다. */
    private StudyMeeting nextMeeting;

    private StudyParticipant navigator;
    private StudyParticipant memberA;
    private StudyParticipant memberB;

    @BeforeEach
    void setUp() {
        likeRepo.deleteAll();
        retroRepo.deleteAll();
        participantRepo.deleteAll();
        meetingRepo.deleteAll();
        groupRepo.deleteAll();
        studyRepo.deleteAll();
        programRepo.deleteAll();

        insertAccountIfAbsent(CAPTAIN_ID, "캡틴", "captain@retro-it.com", SystemRole.ADMIN);
        insertAccountIfAbsent(NAVIGATOR_ID, "네비", "navigator@retro-it.com", SystemRole.MEMBER);
        insertAccountIfAbsent(MEMBER_A_ID, "멤버A", "membera@retro-it.com", SystemRole.MEMBER);
        insertAccountIfAbsent(MEMBER_B_ID, "멤버B", "memberb@retro-it.com", SystemRole.MEMBER);
        insertAccountIfAbsent(OUTSIDER_ID, "외부인", "outsider@retro-it.com", SystemRole.MEMBER);

        var program =
                programRepo.save(
                        StudyProgram.builder()
                                .title("회고 테스트 프로그램")
                                .studyKind(StudyKind.STUDY)
                                .build());

        study =
                studyRepo.save(
                        Study.builder()
                                .programId(program.getId())
                                .title("회고 테스트 스터디")
                                .oneLineSummary("테스트용")
                                .category(StudyCategory.ALGORITHM)
                                .description("설명")
                                .status(StudyStatus.OPEN)
                                .startAt(Instant.now().minus(30, ChronoUnit.DAYS))
                                .build());

        group =
                groupRepo.save(
                        new StudyGroup(
                                study.getId(),
                                "A반",
                                Instant.now().minus(21, ChronoUnit.DAYS),
                                "Asia/Seoul",
                                10));

        // 끝난 회차: scheduledAt = 2일 전, endAt = 2일 전 + 2시간
        Instant meetingStart = Instant.now().minus(2, ChronoUnit.DAYS);
        endedMeeting =
                meetingRepo.save(
                        new StudyMeeting(
                                group.getId(),
                                meetingStart,
                                meetingStart,
                                meetingStart.plus(2, ChronoUnit.HOURS)));

        // 다음 회차: 5일 뒤 — endedMeeting 의 기한
        nextMeeting =
                meetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().plus(5, ChronoUnit.DAYS), null));

        Instant joinedEarly = Instant.now().minus(10, ChronoUnit.DAYS);
        navigator =
                participantRepo.save(
                        StudyParticipant.builder()
                                .accountId(NAVIGATOR_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.LEADER)
                                .joinedAt(joinedEarly)
                                .build());
        memberA =
                participantRepo.save(
                        StudyParticipant.builder()
                                .accountId(MEMBER_A_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(joinedEarly)
                                .build());
        memberB =
                participantRepo.save(
                        StudyParticipant.builder()
                                .accountId(MEMBER_B_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(joinedEarly)
                                .build());
    }

    // ── 회고 작성 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("회고_최초_작성_201_DB에_저장된다")
    void 회고_최초_작성_201_DB에_저장된다() {
        var response =
                writeRetro(
                        study.getId(),
                        endedMeeting.getId(),
                        MEMBER_A_ID,
                        Map.of("good", "좋았어요", "improve", "더 잘 해봐요", "feeling", "즐거웠어요"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        List<StudyMeetingRetro> saved = retroRepo.findAll();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getGood()).isEqualTo("좋았어요");
        assertThat(saved.get(0).getMeetingId()).isEqualTo(endedMeeting.getId());
        assertThat(saved.get(0).getParticipantId()).isEqualTo(memberA.getId());
    }

    @Test
    @DisplayName("회고_수정_200_공감은_남는다")
    void 회고_수정_200_공감은_남는다() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "처음 내용", "improve", "개선점", "feeling", "소감"));
        StudyMeetingRetro retro = retroRepo.findAll().get(0);

        // memberB 가 GOOD 에 공감 추가
        likeRepo.save(StudyMeetingRetroLike.of(retro.getId(), RetroSection.GOOD, MEMBER_B_ID));

        var response =
                writeRetro(
                        study.getId(),
                        endedMeeting.getId(),
                        MEMBER_A_ID,
                        Map.of("good", "수정된 내용", "improve", "수정된 개선점", "feeling", ""));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        StudyMeetingRetro updated = retroRepo.findById(retro.getId()).orElseThrow();
        assertThat(updated.getGood()).isEqualTo("수정된 내용");
        assertThat(updated.getFeeling()).isEqualTo("");
        // 공감은 그대로
        assertThat(likeRepo.countByRetroIdAndSection(retro.getId(), RetroSection.GOOD))
                .isEqualTo(1);
    }

    @Test
    @DisplayName("회고_작성_실패_미팅_미종료_409_RETRO_NOT_OPEN")
    void 회고_작성_실패_미팅_미종료_409() {
        StudyMeeting future =
                meetingRepo.save(
                        StudyMeeting.schedule(
                                group.getId(), Instant.now().plus(1, ChronoUnit.DAYS), null));

        var response =
                writeRetro(
                        study.getId(),
                        future.getId(),
                        MEMBER_A_ID,
                        Map.of("good", "좋았어요", "improve", "개선점", "feeling", ""));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("errorCode")).isEqualTo("RETRO_NOT_OPEN");
    }

    @Test
    @DisplayName("회고_작성_실패_킥오프_회차_409_RETRO_NOT_OPEN")
    void 회고_작성_실패_킥오프_회차_409() {
        StudyMeeting kickoff =
                meetingRepo.save(
                        StudyMeeting.kickoff(
                                group.getId(), Instant.now().minus(30, ChronoUnit.DAYS)));

        var response =
                writeRetro(
                        study.getId(),
                        kickoff.getId(),
                        MEMBER_A_ID,
                        Map.of("good", "좋았어요", "improve", "개선점", "feeling", ""));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("errorCode")).isEqualTo("RETRO_NOT_OPEN");
    }

    @Test
    @DisplayName("회고_작성_실패_기한_초과_409_RETRO_CLOSED")
    void 회고_작성_실패_기한_초과_409() {
        // oldMeeting(20일 전) 의 기한 = closerNext(15일 전) < 지금 → CLOSED
        Instant oldStart = Instant.now().minus(20, ChronoUnit.DAYS);
        StudyMeeting oldMeeting =
                meetingRepo.save(
                        new StudyMeeting(
                                group.getId(),
                                oldStart,
                                oldStart,
                                oldStart.plus(2, ChronoUnit.HOURS)));
        meetingRepo.save(
                StudyMeeting.schedule(
                        group.getId(), Instant.now().minus(15, ChronoUnit.DAYS), null));

        var response =
                writeRetro(
                        study.getId(),
                        oldMeeting.getId(),
                        MEMBER_A_ID,
                        Map.of("good", "좋았어요", "improve", "개선점", "feeling", ""));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("errorCode")).isEqualTo("RETRO_CLOSED");
    }

    @Test
    @DisplayName("회고_작성_실패_반_참여자_아님_403")
    void 회고_작성_실패_비참여자_403() {
        var response =
                writeRetro(
                        study.getId(),
                        endedMeeting.getId(),
                        OUTSIDER_ID,
                        Map.of("good", "좋았어요", "improve", "개선점", "feeling", ""));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("회고_작성_실패_명부에_없는_캡틴은_작성_불가_403")
    void 회고_작성_실패_명부에_없는_캡틴_403() {
        var response =
                writeRetro(
                        study.getId(),
                        endedMeeting.getId(),
                        CAPTAIN_ID,
                        Map.of("good", "좋았어요", "improve", "개선점", "feeling", ""));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("회고_작성_명부에_있는_캡틴은_작성_201")
    void 회고_작성_명부에_있는_캡틴_201() {
        StudyParticipant captainRow =
                participantRepo.save(
                        StudyParticipant.builder()
                                .accountId(CAPTAIN_ID)
                                .studyGroupId(group.getId())
                                .studyId(study.getId())
                                .status(ParticipantStatus.ACTIVE)
                                .participantRole(ParticipantRole.MEMBER)
                                .joinedAt(Instant.now().minus(10, ChronoUnit.DAYS))
                                .build());

        var response =
                writeRetro(
                        study.getId(),
                        endedMeeting.getId(),
                        CAPTAIN_ID,
                        Map.of("good", "좋았어요", "improve", "개선점", "feeling", ""));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(
                        retroRepo.findByMeetingIdAndParticipantId(
                                endedMeeting.getId(), captainRow.getId()))
                .isPresent();
    }

    // ── 회고 목록 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("회고_목록_크루에게는_missing이_빈_배열")
    @SuppressWarnings("unchecked")
    void 회고_목록_크루에게는_missing이_빈_배열() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선", "feeling", ""));

        var response = getRetroList(study.getId(), endedMeeting.getId(), MEMBER_B_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = response.getBody();
        assertThat(((Number) body.get("meetingId")).longValue()).isEqualTo(endedMeeting.getId());
        assertThat(body.get("open")).isEqualTo(true);
        assertThat(body.get("targets")).isNull(); // 크루에게는 작성 현황 미노출
        assertThat((List<?>) body.get("retros")).hasSize(1);
        assertThat((List<?>) body.get("missing")).isEmpty();
    }

    @Test
    @DisplayName("회고_목록_네비게이터에게는_미작성자가_missing에_포함된다")
    @SuppressWarnings("unchecked")
    void 회고_목록_네비게이터에게는_missing에_미작성자_포함() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선", "feeling", ""));

        var response = getRetroList(study.getId(), endedMeeting.getId(), NAVIGATOR_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = response.getBody();
        assertThat(((Number) body.get("targets")).intValue()).isEqualTo(3); // 네비게이터에게는 노출
        List<Map<?, ?>> missing = (List<Map<?, ?>>) body.get("missing");
        // memberB 와 navigator 가 미작성 (둘 다 쓸 사람)
        assertThat(missing).hasSizeGreaterThanOrEqualTo(1);
        assertThat(missing)
                .anyMatch(m -> ((Number) m.get("participantId")).longValue() == memberB.getId());
    }

    @Test
    @DisplayName("회고_목록_공감_수가_올바르게_집계된다")
    @SuppressWarnings("unchecked")
    void 회고_목록_공감_수_집계() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선", "feeling", "소감"));
        StudyMeetingRetro retro = retroRepo.findAll().get(0);
        likeRepo.save(StudyMeetingRetroLike.of(retro.getId(), RetroSection.GOOD, MEMBER_B_ID));
        likeRepo.save(StudyMeetingRetroLike.of(retro.getId(), RetroSection.GOOD, NAVIGATOR_ID));
        likeRepo.save(StudyMeetingRetroLike.of(retro.getId(), RetroSection.FEELING, MEMBER_B_ID));

        var response = getRetroList(study.getId(), endedMeeting.getId(), MEMBER_A_ID);

        List<Map<?, ?>> retros = (List<Map<?, ?>>) response.getBody().get("retros");
        Map<?, ?> likes = (Map<?, ?>) retros.get(0).get("likes");
        assertThat(((Number) likes.get("GOOD")).intValue()).isEqualTo(2);
        assertThat(((Number) likes.get("IMPROVE")).intValue()).isEqualTo(0);
        assertThat(((Number) likes.get("FEELING")).intValue()).isEqualTo(1);
    }

    // ── 뷰어 컨텍스트 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("뷰어_컨텍스트_내_회고_ID와_공감_맵_반환")
    @SuppressWarnings("unchecked")
    void 뷰어_컨텍스트_내_회고_ID와_공감_맵_반환() {
        // memberA 작성
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선", "feeling", "소감"));
        StudyMeetingRetro retro = retroRepo.findAll().get(0);

        // memberB 가 GOOD 에 공감
        likeRepo.save(StudyMeetingRetroLike.of(retro.getId(), RetroSection.GOOD, MEMBER_B_ID));

        // memberA — 자기 retroId, 공감 없음
        var responseA = getViewerContext(study.getId(), endedMeeting.getId(), MEMBER_A_ID);
        assertThat(responseA.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> bodyA = responseA.getBody();
        assertThat(((Number) bodyA.get("retroId")).longValue()).isEqualTo(retro.getId());
        assertThat((Map<?, ?>) bodyA.get("liked")).isEmpty();

        // memberB — retroId null, liked 에 retro 포함
        var responseB = getViewerContext(study.getId(), endedMeeting.getId(), MEMBER_B_ID);
        Map<?, ?> bodyB = responseB.getBody();
        assertThat(bodyB.get("retroId")).isNull();
        Map<String, ?> liked = (Map<String, ?>) bodyB.get("liked");
        assertThat(liked).containsKey(String.valueOf(retro.getId()));
        Map<String, Boolean> sections =
                (Map<String, Boolean>) liked.get(String.valueOf(retro.getId()));
        assertThat(sections).containsEntry("GOOD", true);
        assertThat(sections).containsEntry("IMPROVE", false);
        assertThat(sections).containsEntry("FEELING", false);
    }

    // ── 공감 ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("공감_누르기_멱등_같은_요청_두_번_count_1")
    @SuppressWarnings("unchecked")
    void 공감_누르기_멱등() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선", "feeling", ""));
        StudyMeetingRetro retro = retroRepo.findAll().get(0);

        var r1 = putLike(study.getId(), endedMeeting.getId(), retro.getId(), "GOOD", MEMBER_B_ID);
        var r2 = putLike(study.getId(), endedMeeting.getId(), retro.getId(), "GOOD", MEMBER_B_ID);

        assertThat(r1.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(r2.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = r2.getBody();
        assertThat(((Number) body.get("count")).intValue()).isEqualTo(1);
        assertThat(body.get("liked")).isEqualTo(true);
    }

    @Test
    @DisplayName("공감_취소_멱등_없어도_에러없이_count_0")
    @SuppressWarnings("unchecked")
    void 공감_취소_멱등() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선", "feeling", ""));
        StudyMeetingRetro retro = retroRepo.findAll().get(0);

        var r = deleteLike(study.getId(), endedMeeting.getId(), retro.getId(), "GOOD", MEMBER_B_ID);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<?, ?> body = r.getBody();
        assertThat(((Number) body.get("count")).intValue()).isEqualTo(0);
        assertThat(body.get("liked")).isEqualTo(false);
    }

    @Test
    @DisplayName("공감_실패_자기_회고_403")
    void 공감_실패_자기_회고_403() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선", "feeling", ""));
        StudyMeetingRetro retro = retroRepo.findAll().get(0);

        var r = putLike(study.getId(), endedMeeting.getId(), retro.getId(), "GOOD", MEMBER_A_ID);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("공감_기한_지나도_누를_수_있다")
    @SuppressWarnings("unchecked")
    void 공감_기한_지나도_가능() {
        // 기한이 지난 회차에 회고를 직접 삽입
        Instant oldStart = Instant.now().minus(20, ChronoUnit.DAYS);
        StudyMeeting oldMeeting =
                meetingRepo.save(
                        new StudyMeeting(
                                group.getId(),
                                oldStart,
                                oldStart,
                                oldStart.plus(2, ChronoUnit.HOURS)));
        meetingRepo.save(
                StudyMeeting.schedule(
                        group.getId(), Instant.now().minus(15, ChronoUnit.DAYS), null));
        StudyMeetingRetro retro =
                retroRepo.save(
                        StudyMeetingRetro.write(
                                oldMeeting.getId(), memberA.getId(), "좋았어요", "개선점", ""));

        var r = putLike(study.getId(), oldMeeting.getId(), retro.getId(), "GOOD", MEMBER_B_ID);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((Number) ((Map<?, ?>) r.getBody()).get("count")).intValue()).isEqualTo(1);
    }

    // ── 회차별 회고 상태 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("retro_status_미작성이면_retroMine_false")
    @SuppressWarnings("unchecked")
    void retro_status_미작성이면_retroMine_false() {
        var response = getRetroStatus(study.getId(), group.getId(), MEMBER_A_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<?, ?>> meetings = (List<Map<?, ?>>) response.getBody().get("meetings");

        Map<?, ?> ended =
                meetings.stream()
                        .filter(
                                m ->
                                        ((Number) m.get("meetingId")).longValue()
                                                == endedMeeting.getId())
                        .findFirst()
                        .orElseThrow();

        assertThat(ended.get("retroOpen")).isEqualTo(true);
        assertThat(ended.get("retroMine")).isEqualTo(false);
        assertThat(ended.get("retroDeadline")).isNotNull();
        // 실제 종료 시각(END_AT)이 있으면 그것
        assertThat(Instant.parse((String) ended.get("meetingEndAt")))
                .isCloseTo(endedMeeting.getEndAt(), within(1, ChronoUnit.SECONDS));

        // 미래 회차(nextMeeting)는 retroOpen=false
        Map<?, ?> future =
                meetings.stream()
                        .filter(
                                m ->
                                        ((Number) m.get("meetingId")).longValue()
                                                == nextMeeting.getId())
                        .findFirst()
                        .orElseThrow();
        assertThat(future.get("retroOpen")).isEqualTo(false);
        // 실제 종료 시각이 없으면 예정 시각 + 기본 진행 시간 120분
        assertThat(Instant.parse((String) future.get("meetingEndAt")))
                .isCloseTo(
                        nextMeeting.getScheduledAt().plus(120, ChronoUnit.MINUTES),
                        within(1, ChronoUnit.SECONDS));
    }

    @Test
    @DisplayName("retro_status_작성완료_retroMine_true")
    @SuppressWarnings("unchecked")
    void retro_status_작성완료_retroMine_true() {
        writeRetro(
                study.getId(),
                endedMeeting.getId(),
                MEMBER_A_ID,
                Map.of("good", "좋았어요", "improve", "개선점", "feeling", ""));

        var response = getRetroStatus(study.getId(), group.getId(), MEMBER_A_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<?, ?>> meetings = (List<Map<?, ?>>) response.getBody().get("meetings");

        Map<?, ?> ended =
                meetings.stream()
                        .filter(
                                m ->
                                        ((Number) m.get("meetingId")).longValue()
                                                == endedMeeting.getId())
                        .findFirst()
                        .orElseThrow();

        assertThat(ended.get("retroMine")).isEqualTo(true);
    }

    @Test
    @DisplayName("retro_status_킥오프회차_null_필드")
    @SuppressWarnings("unchecked")
    void retro_status_킥오프회차_null_필드() {
        StudyMeeting kickoff =
                meetingRepo.save(
                        StudyMeeting.kickoff(
                                group.getId(), Instant.now().minus(30, ChronoUnit.DAYS)));

        var response = getRetroStatus(study.getId(), group.getId(), MEMBER_A_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<?, ?>> meetings = (List<Map<?, ?>>) response.getBody().get("meetings");

        Map<?, ?> kickoffItem =
                meetings.stream()
                        .filter(m -> ((Number) m.get("meetingId")).longValue() == kickoff.getId())
                        .findFirst()
                        .orElseThrow();

        assertThat(kickoffItem.get("meetingEndAt")).isNull();
        assertThat(kickoffItem.get("retroDeadline")).isNull();
        assertThat(kickoffItem.get("retroOpen")).isNull();
        assertThat(kickoffItem.get("retroMine")).isNull();
    }

    @Test
    @DisplayName("retro_status_캡틴_retroMine_null")
    @SuppressWarnings("unchecked")
    void retro_status_캡틴_retroMine_null() {
        var response = getRetroStatus(study.getId(), group.getId(), CAPTAIN_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<Map<?, ?>> meetings = (List<Map<?, ?>>) response.getBody().get("meetings");

        Map<?, ?> ended =
                meetings.stream()
                        .filter(
                                m ->
                                        ((Number) m.get("meetingId")).longValue()
                                                == endedMeeting.getId())
                        .findFirst()
                        .orElseThrow();

        assertThat(ended.get("retroMine")).isNull();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private ResponseEntity<Map> writeRetro(
            Long studyId, Long meetingId, Long accountId, Object body) {
        return rest.exchange(
                "/api/me/studies/{studyId}/meetings/{meetingId}/retro",
                HttpMethod.PUT,
                authenticatedRequest(body, accountId),
                Map.class,
                studyId,
                meetingId);
    }

    private ResponseEntity<Map> getRetroList(Long studyId, Long meetingId, Long accountId) {
        return rest.exchange(
                "/api/studies/{studyId}/meetings/{meetingId}/retros",
                HttpMethod.GET,
                authenticatedRequest(null, accountId),
                Map.class,
                studyId,
                meetingId);
    }

    private ResponseEntity<Map> getRetroStatus(Long studyId, Long studyGroupId, Long accountId) {
        String url =
                "/api/me/studies/"
                        + studyId
                        + "/retros/status"
                        + (studyGroupId != null ? "?studyGroupId=" + studyGroupId : "");
        return rest.exchange(url, HttpMethod.GET, authenticatedRequest(null, accountId), Map.class);
    }

    private ResponseEntity<Map> getViewerContext(Long studyId, Long meetingId, Long accountId) {
        return rest.exchange(
                "/api/me/studies/{studyId}/meetings/{meetingId}/retros",
                HttpMethod.GET,
                authenticatedRequest(null, accountId),
                Map.class,
                studyId,
                meetingId);
    }

    private ResponseEntity<Map> putLike(
            Long studyId, Long meetingId, Long retroId, String section, Long accountId) {
        return rest.exchange(
                "/api/studies/{studyId}/meetings/{meetingId}/retros/{retroId}/likes/{section}",
                HttpMethod.PUT,
                authenticatedRequest(null, accountId),
                Map.class,
                studyId,
                meetingId,
                retroId,
                section);
    }

    private ResponseEntity<Map> deleteLike(
            Long studyId, Long meetingId, Long retroId, String section, Long accountId) {
        return rest.exchange(
                "/api/studies/{studyId}/meetings/{meetingId}/retros/{retroId}/likes/{section}",
                HttpMethod.DELETE,
                authenticatedRequest(null, accountId),
                Map.class,
                studyId,
                meetingId,
                retroId,
                section);
    }

    private HttpEntity<Object> authenticatedRequest(Object body, Long accountId) {
        String email = accountRepository.findById(accountId).orElseThrow().getEmail();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwt.issueAccess(String.valueOf(accountId), email));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
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
