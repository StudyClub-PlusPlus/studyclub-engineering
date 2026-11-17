package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipant;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyCategory;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
import com.studyclub.domain.study.StudyKind;
import com.studyclub.domain.study.StudyProgram;
import com.studyclub.domain.study.StudyProgramRepository;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * HTTP 표면(서비스 키 · 검증 · 204)과 웹 기준 조회. 맞추는 판정은 {@link DiscordRoleSyncServiceTest} 가 본다 — 여기서는 서비스를
 * 목으로 둬서 비동기 작업이 돌지 않는다.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "discord.api-key=" + DiscordRoleSyncIntegrationTest.API_KEY)
@AutoConfigureTestRestTemplate
class DiscordRoleSyncIntegrationTest {

    static final String API_KEY = "discord-role-sync-test-key";

    @Autowired TestRestTemplate rest;
    @Autowired AccountRepository accountRepository;
    @Autowired StudyProgramRepository studyProgramRepository;
    @Autowired StudyRepository studyRepository;
    @Autowired StudyGroupRepository studyGroupRepository;
    @Autowired StudyParticipantRepository studyParticipantRepository;
    @MockitoBean DiscordRoleSyncService discordRoleSyncService;

    @BeforeEach
    void useModernHttpClient() {
        // 바디 있는 요청에 4xx/204 가 오면 레거시 클라이언트가 못 읽는다
        rest.getRestTemplate().setRequestFactory(new JdkClientHttpRequestFactory());
    }

    private ResponseEntity<Map> send(HttpMethod method, String path, Object body, String apiKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null) {
            headers.set("X-API-Key", apiKey);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), Map.class);
    }

    private static String snowflake() {
        return String.valueOf(ThreadLocalRandom.current().nextLong(1L << 56, Long.MAX_VALUE));
    }

    @Test
    void 변경_알림은_204_이고_서비스에_넘긴다() {
        var res =
                send(
                        HttpMethod.POST,
                        "/api/discord/role-changes",
                        Map.of(
                                "discordUserId", snowflake(),
                                "role", "NAVIGATOR",
                                "change", "ADDED",
                                "occurredAt", "2026-10-26T01:00:00Z"),
                        API_KEY);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(discordRoleSyncService).onRoleChanged(any());
    }

    @Test
    void 명단은_204_이고_빈_배열도_받는다() {
        var res =
                send(
                        HttpMethod.PUT,
                        "/api/discord/role-members",
                        Map.of(
                                "snapshotAt", "2026-10-26T00:00:00Z",
                                "captains", java.util.List.of(),
                                "navigators", java.util.List.of(snowflake())),
                        API_KEY);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(discordRoleSyncService).onRoleMembers(any());
    }

    @Test
    void role_값이_목록_밖이거나_snowflake_가_아니면_400() {
        var badRole =
                send(
                        HttpMethod.POST,
                        "/api/discord/role-changes",
                        Map.of(
                                "discordUserId", snowflake(),
                                "role", "ADMIN",
                                "change", "ADDED",
                                "occurredAt", "2026-10-26T01:00:00Z"),
                        API_KEY);
        var badId =
                send(
                        HttpMethod.PUT,
                        "/api/discord/role-members",
                        Map.of(
                                "snapshotAt", "2026-10-26T00:00:00Z",
                                "captains", java.util.List.of("abc"),
                                "navigators", java.util.List.of()),
                        API_KEY);

        assertThat(badRole.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(badRole.getBody()).containsEntry("errorCode", "INVALID_INPUT");
        assertThat(badId.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(discordRoleSyncService, never()).onRoleChanged(any());
        verify(discordRoleSyncService, never()).onRoleMembers(any());
    }

    @Test
    void 서비스_키가_없거나_틀리면_401() {
        Map<String, Object> body =
                Map.of(
                        "snapshotAt", "2026-10-26T00:00:00Z",
                        "captains", java.util.List.of(),
                        "navigators", java.util.List.of());

        assertThat(send(HttpMethod.PUT, "/api/discord/role-members", body, null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(send(HttpMethod.PUT, "/api/discord/role-members", body, "wrong").getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(discordRoleSyncService, never()).onRoleMembers(any());
    }

    @Test
    void 웹_navigator_는_진행_중_스터디의_활동_휴식_LEADER_이고_연동한_사람이다() {
        Account active = linked(SystemRole.MEMBER);
        Account paused = linked(SystemRole.MEMBER);
        Account withdrawn = linked(SystemRole.MEMBER);
        Account member = linked(SystemRole.MEMBER);
        Account endedStudy = linked(SystemRole.MEMBER);
        Account unlinked = account(SystemRole.MEMBER);
        Study ongoing = study(StudyStatus.ONGOING);
        Study ended = study(StudyStatus.ENDED);
        participant(active, ongoing, ParticipantRole.LEADER, ParticipantStatus.ACTIVE);
        participant(paused, ongoing, ParticipantRole.LEADER, ParticipantStatus.PAUSED);
        participant(withdrawn, ongoing, ParticipantRole.LEADER, ParticipantStatus.WITHDRAWN);
        participant(member, ongoing, ParticipantRole.MEMBER, ParticipantStatus.ACTIVE);
        participant(endedStudy, ended, ParticipantRole.LEADER, ParticipantStatus.ACTIVE);
        participant(unlinked, ongoing, ParticipantRole.LEADER, ParticipantStatus.ACTIVE);

        assertThat(studyParticipantRepository.findNavigatorDiscordIds())
                .contains(active.getDiscordId(), paused.getDiscordId())
                .doesNotContain(
                        withdrawn.getDiscordId(), member.getDiscordId(), endedStudy.getDiscordId())
                .doesNotContainNull();
    }

    @Test
    void 웹_captain_은_디스코드를_연동한_ADMIN_이다() {
        Account captain = linked(SystemRole.ADMIN);
        Account crew = linked(SystemRole.MEMBER);
        account(SystemRole.ADMIN);

        assertThat(accountRepository.findCaptainDiscordIds())
                .contains(captain.getDiscordId())
                .doesNotContain(crew.getDiscordId())
                .doesNotContainNull();
    }

    private Account account(SystemRole role) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return accountRepository.save(
                new Account("rolesync-" + suffix + "@example.com", "rs" + suffix, null, role));
    }

    private Account linked(SystemRole role) {
        Account account = account(role);
        account.linkDiscord(snowflake(), "handle");
        return accountRepository.save(account);
    }

    private Study study(StudyStatus status) {
        StudyProgram program =
                studyProgramRepository.save(
                        StudyProgram.builder()
                                .title("role sync")
                                .studyKind(StudyKind.STUDY)
                                .build());
        return studyRepository.save(
                Study.builder()
                        .programId(program.getId())
                        .title("role sync 스터디")
                        .oneLineSummary("테스트용")
                        .category(StudyCategory.ALGORITHM)
                        .description("설명")
                        .status(status)
                        .startAt(Instant.now())
                        .build());
    }

    private void participant(
            Account account, Study study, ParticipantRole role, ParticipantStatus status) {
        StudyGroup group =
                studyGroupRepository
                        .findFirstByStudyIdOrderByIdAsc(study.getId())
                        .orElseGet(
                                () ->
                                        studyGroupRepository.save(
                                                StudyGroup.defaultOf(study.getId())));
        studyParticipantRepository.save(
                StudyParticipant.builder()
                        .accountId(account.getId())
                        .studyId(study.getId())
                        .studyGroupId(group.getId())
                        .status(status)
                        .participantRole(role)
                        .joinedAt(Instant.now())
                        .build());
    }
}
