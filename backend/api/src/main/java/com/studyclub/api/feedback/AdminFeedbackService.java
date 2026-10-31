package com.studyclub.api.feedback;

import com.studyclub.api.feedback.AdminFeedbackListResponse.FeedbackSummary;
import com.studyclub.api.feedback.AdminFeedbackListResponse.Person;
import com.studyclub.api.feedback.FeedbackQueryDao.AdminFilter;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackImageRepository;
import com.studyclub.domain.feedback.FeedbackReplied;
import com.studyclub.domain.feedback.FeedbackRepository;
import com.studyclub.domain.feedback.FeedbackStatus;
import com.studyclub.domain.feedback.FeedbackType;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 운영 콘솔의 문의·오류 신고 — 목록 · 상세 · 처리 (specs/feedback/spec.md). 요청자가 캡틴인지는 {@code @RequireAdmin} 이 이미
 * 봤다.
 *
 * <p>상태와 회신의 규칙(완료는 회신으로만, 회신 뒤 상태 고정)은 {@link Feedback} 이 지킨다 — 여기서는 요청을 고르고 그 메서드를 부른다.
 */
@Service
public class AdminFeedbackService {

    static final int MAX_QUERY_LENGTH = 100;

    static final String STATUS = "status";
    static final String REPLY = "reply";
    static final String ADMIN_MEMO = "adminMemo";
    private static final List<String> PATCH_KEYS = List.of(STATUS, REPLY, ADMIN_MEMO);

    private final FeedbackRepository feedbackRepository;
    private final FeedbackImageRepository feedbackImageRepository;
    private final FeedbackQueryDao feedbackQueryDao;
    private final AccountRepository accountRepository;
    private final ApplicationEventPublisher eventPublisher;

    public AdminFeedbackService(
            FeedbackRepository feedbackRepository,
            FeedbackImageRepository feedbackImageRepository,
            FeedbackQueryDao feedbackQueryDao,
            AccountRepository accountRepository,
            ApplicationEventPublisher eventPublisher) {
        this.feedbackRepository = feedbackRepository;
        this.feedbackImageRepository = feedbackImageRepository;
        this.feedbackQueryDao = feedbackQueryDao;
        this.accountRepository = accountRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public AdminFeedbackListResponse list(
            FeedbackType type, FeedbackStatus status, String q, int offset, int limit) {
        FeedbackService.requirePage(offset, limit);
        AdminFilter filter = new AdminFilter(type, status, normalizeQuery(q));

        long total = feedbackQueryDao.countForAdmin(filter);
        if (total == 0 || offset >= total) {
            return new AdminFeedbackListResponse(List.of(), total, offset, limit);
        }
        List<Feedback> rows = feedbackQueryDao.findForAdmin(filter, offset, limit);
        // 한 페이지의 제출자 · 완료 처리자를 모아 계정을 한 번에 읽는다 (N+1 금지)
        Map<Long, String> nicknames =
                nicknames(
                        rows.stream()
                                .flatMap(f -> Stream.of(f.getAccountId(), f.getDoneByAccountId()))
                                .filter(Objects::nonNull)
                                .collect(Collectors.toSet()));
        List<FeedbackSummary> items =
                rows.stream()
                        .map(
                                f ->
                                        new FeedbackSummary(
                                                f.getId(),
                                                f.getCreatedAt(),
                                                f.getType(),
                                                f.getTitle(),
                                                new Person(nicknames.get(f.getAccountId())),
                                                f.getStatus(),
                                                doneBy(f, nicknames)))
                        .toList();
        return new AdminFeedbackListResponse(items, total, offset, limit);
    }

    @Transactional(readOnly = true)
    public AdminFeedbackDetailResponse detail(Long feedbackId) {
        return toDetail(find(feedbackRepository.findById(feedbackId)));
    }

    /**
     * {@code status} · {@code reply} · {@code adminMemo} 중 하나만 바꾼다. 회신은 계정 → 문의, 나머지는 문의 행을 잠근다 — 두
     * 캡틴이 동시에 첫 회신을 보내도 완료 처리자 · 회신 시각이 한 번만 정해진다.
     *
     * @param body 요청 본문 그대로. 키가 있는데 값이 null 인 것과 키가 없는 것을 가르기 위해 맵으로 받는다
     */
    @Transactional
    public AdminFeedbackDetailResponse patch(
            Long requesterId, Long feedbackId, Map<String, Object> body) {
        String key = singleKey(body);
        if (REPLY.equals(key)) {
            // 탈퇴와 같은 순서(계정 → 문의)로 잠근다. 예약 뒤 탈퇴는 방금 만든 메일까지 비식별화하고,
            // 탈퇴가 먼저면 리스너가 수신자 없음으로 건너뛴다. 문의 엔티티는 아래 잠금 조회에서 처음 읽는다.
            feedbackRepository
                    .findAccountIdById(feedbackId)
                    .ifPresent(accountRepository::findByIdForUpdate);
        }
        Feedback feedback = find(feedbackRepository.findByIdForUpdate(feedbackId));
        String value = (String) body.get(key);
        switch (key) {
            case STATUS -> feedback.changeStatus(parseStatus(value));
            case REPLY -> {
                String reply = FeedbackService.trimmed(value);
                FeedbackService.requireLength(REPLY, reply, Feedback.REPLY_MIN, Feedback.REPLY_MAX);
                if (feedback.reply(reply, requesterId, Instant.now())) {
                    eventPublisher.publishEvent(FeedbackReplied.of(feedback));
                }
            }
            case ADMIN_MEMO -> {
                if (value.length() > Feedback.ADMIN_MEMO_MAX) {
                    throw new BusinessException(
                            ErrorCode.INVALID_INPUT,
                            ADMIN_MEMO + " 은 " + Feedback.ADMIN_MEMO_MAX + "자 이하여야 합니다.");
                }
                feedback.changeAdminMemo(value.isBlank() ? "" : value);
            }
            default -> throw new IllegalStateException("고르지 않은 키 " + key);
        }
        return toDetail(feedback);
    }

    private AdminFeedbackDetailResponse toDetail(Feedback feedback) {
        Set<Long> ids = new HashSet<>();
        ids.add(feedback.getAccountId());
        if (feedback.getDoneByAccountId() != null) {
            ids.add(feedback.getDoneByAccountId());
        }
        Map<Long, String> nicknames = nicknames(ids);
        AdminFeedbackDetailResponse.Viewport viewport =
                feedback.getViewportWidth() == null || feedback.getViewportHeight() == null
                        ? null
                        : new AdminFeedbackDetailResponse.Viewport(
                                feedback.getViewportWidth(), feedback.getViewportHeight());
        return new AdminFeedbackDetailResponse(
                feedback.getId(),
                feedback.getCreatedAt(),
                feedback.getType(),
                feedback.getTitle(),
                new Person(nicknames.get(feedback.getAccountId())),
                feedback.getStatus(),
                doneBy(feedback, nicknames),
                feedback.selectableStatuses(),
                feedback.getContent(),
                FeedbackService.images(feedbackImageRepository, feedback.getId()),
                feedback.getBrowser(),
                viewport,
                FeedbackReply.of(feedback),
                feedback.getAdminMemo());
    }

    /** 완료가 아니면 null. 완료 처리자가 탈퇴했으면 닉네임만 null — 「완료 아님」과 「탈퇴한 사용자」를 가른다. */
    private static Person doneBy(Feedback feedback, Map<Long, String> nicknames) {
        return feedback.getDoneByAccountId() == null
                ? null
                : new Person(nicknames.get(feedback.getDoneByAccountId()));
    }

    /** 계정 ID → 닉네임. 없는(탈퇴한) 계정은 맵에 없다. */
    private Map<Long, String> nicknames(Collection<Long> accountIds) {
        if (accountIds.isEmpty()) {
            return Map.of();
        }
        return accountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(Account::getId, Account::getNickname));
    }

    private static Feedback find(Optional<Feedback> found) {
        return found.orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "삭제되었거나 없는 문의·오류 신고입니다."));
    }

    private static String normalizeQuery(String q) {
        String trimmed = q == null ? null : q.strip();
        if (trimmed != null && trimmed.length() > MAX_QUERY_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "q 는 " + MAX_QUERY_LENGTH + "자 이하여야 합니다.");
        }
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }

    /** 세 키 중 정확히 하나, 값은 문자열. 메모를 지우려면 null 이 아니라 {@code ""} 를 보낸다. */
    private static String singleKey(Map<String, Object> body) {
        List<String> present =
                body == null ? List.of() : PATCH_KEYS.stream().filter(body::containsKey).toList();
        if (present.size() != 1) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "status · reply · adminMemo 중 하나만 보내 주세요.");
        }
        String key = present.get(0);
        if (!(body.get(key) instanceof String)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, key + " 이 올바르지 않습니다.");
        }
        return key;
    }

    private static FeedbackStatus parseStatus(String value) {
        return Arrays.stream(FeedbackStatus.values())
                .filter(status -> status.name().equals(value))
                .findFirst()
                .orElseThrow(
                        () ->
                                new BusinessException(
                                        ErrorCode.INVALID_INPUT, "status 가 올바르지 않습니다."));
    }
}
