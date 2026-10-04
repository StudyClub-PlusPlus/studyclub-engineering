package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.discord.StudyDiscordLink;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 봇 create-study 를 불러 STUDY_DISCORD_LINK 를 만든다 (specs/discord-study-link/spec.md).
 *
 * <p><b>일부러 {@code @Transactional} 을 붙이지 않는다.</b> 봇은 느려질 수 있어서 그동안 DB 커넥션을 잡고 있으면 안 되고, 봇이 성공한 뒤 우리
 * 쪽이 롤백되면 디스코드에 고아 카테고리가 남는다. 조회와 저장은 리포지토리 각자의 짧은 트랜잭션이다.
 */
@Service
public class StudyDiscordLinkService {

    private static final Logger log = LoggerFactory.getLogger(StudyDiscordLinkService.class);

    private final DiscordBotClient discordBotClient;
    private final StudyDiscordLinkRepository studyDiscordLinkRepository;
    private final StudyRepository studyRepository;
    private final AccountRepository accountRepository;
    private final TransactionTemplate transactionTemplate;

    public StudyDiscordLinkService(
            DiscordBotClient discordBotClient,
            StudyDiscordLinkRepository studyDiscordLinkRepository,
            StudyRepository studyRepository,
            AccountRepository accountRepository,
            TransactionTemplate transactionTemplate) {
        this.discordBotClient = discordBotClient;
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
        this.studyRepository = studyRepository;
        this.accountRepository = accountRepository;
        this.transactionTemplate = transactionTemplate;
    }

    /**
     * 스터디 등록이 커밋된 뒤 부른다. 어떻게 실패해도 던지지 않는다 — 스터디는 이미 만들어졌고, 연결 없는 스터디는 정상 상태다. 봇이 설정되지 않은
     * 환경(로컬·테스트)에서는 부르지도 않는다.
     */
    public void linkAfterCreate(Long accountId, Long studyId) {
        if (!discordBotClient.isConfigured()) {
            log.info("스터디 {} 디스코드 연결 건너뜀: 봇 설정 없음", studyId);
            return;
        }
        try {
            link(accountId, studyId, null);
        } catch (BusinessException e) {
            log.warn(
                    "스터디 {} 디스코드 연결 실패, POST /api/admin/studies/{}/discord-link 로 다시 붙인다: {}",
                    studyId,
                    studyId,
                    e.getMessage());
        } catch (RuntimeException e) {
            // 메시지는 남기지 않는다 — HTTP 클라이언트 예외 메시지에 헤더 값(API 키)이 실릴 수 있다
            log.warn(
                    "스터디 {} 디스코드 연결 실패 ({}), POST /api/admin/studies/{}/discord-link 로 다시 붙인다",
                    studyId,
                    e.getClass().getName(),
                    studyId);
        }
    }

    /**
     * @param studyName 디스코드에 만들 이름. null 이면 스터디 제목
     */
    public StudyDiscordLinkResponse link(Long accountId, Long studyId, String studyName) {
        Study study =
                studyRepository
                        .findById(studyId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));
        // 봇을 먼저 부르면 STUDY_ID UNIQUE 에 막혀 저장만 실패하고 디스코드에 고아 카테고리가 남는다
        if (studyDiscordLinkRepository.existsByStudyId(studyId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 디스코드에 연결된 스터디입니다.");
        }
        String discordUserId = accountRepository.findById(accountId).orElseThrow().getDiscordId();
        if (discordUserId == null || discordUserId.isBlank()) {
            throw new BusinessException(
                    ErrorCode.CONFLICT, "디스코드 계정을 연동한 계정만 디스코드 스터디를 만들 수 있습니다.");
        }

        String name = studyName != null ? studyName.trim() : study.getTitle();
        DiscordBotClient.CreatedStudy created = discordBotClient.createStudy(name, discordUserId);

        try {
            saveLink(studyId, created);
        } catch (RuntimeException e) {
            log.error(
                    "스터디 {} 디스코드는 만들어졌는데 연결 저장 실패, 손으로 붙이거나 정리: category {}, role {}",
                    studyId,
                    created.discordStudyId(),
                    created.discordRoleId(),
                    e);
            throw e;
        }
        log.info(
                "스터디 {} 디스코드 연결: category {}, role {}",
                studyId,
                created.discordStudyId(),
                created.discordRoleId());
        return new StudyDiscordLinkResponse(created.discordStudyId(), created.discordRoleId());
    }

    /**
     * 봇을 기다리는 동안 스터디가 지워졌거나 다른 요청이 먼저 연결했을 수 있다. 스터디 행을 잠그고 다시 확인한 뒤 저장한다 — 삭제({@code
     * StudyService.delete})도 같은 행을 먼저 잠그므로 둘이 엇갈리지 않는다. 트랜잭션은 이 저장만 감싸고 봇 호출은 밖에 둔다.
     */
    private void saveLink(Long studyId, DiscordBotClient.CreatedStudy created) {
        transactionTemplate.execute(
                status -> {
                    if (studyRepository.findByIdForUpdate(studyId).isEmpty()) {
                        throw new BusinessException(
                                ErrorCode.NOT_FOUND, "디스코드를 만드는 사이 스터디가 삭제되었습니다.");
                    }
                    if (studyDiscordLinkRepository.existsByStudyId(studyId)) {
                        throw new BusinessException(
                                ErrorCode.CONFLICT, "디스코드를 만드는 사이 다른 요청이 먼저 연결했습니다.");
                    }
                    return studyDiscordLinkRepository.save(
                            new StudyDiscordLink(
                                    studyId, created.discordStudyId(), created.discordRoleId()));
                });
    }
}
