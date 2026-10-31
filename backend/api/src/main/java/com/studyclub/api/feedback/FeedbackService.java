package com.studyclub.api.feedback;

import com.studyclub.api.upload.UploadService;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackImage;
import com.studyclub.domain.feedback.FeedbackImageRepository;
import com.studyclub.domain.feedback.FeedbackRepository;
import com.studyclub.domain.storage.StorageObject;
import com.studyclub.domain.storage.StoragePurpose;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 크루 쪽 문의 — 제출 · 내 문의 목록 · 상세 (specs/feedback/spec.md). 온보딩 여부는 {@code @RequireOnboarding} 이 이미 봤다.
 *
 * <p>「본인 것만」은 권한이 아니라 조회 조건이다 — 남의 것과 없는 번호를 가르지 않고 같은 404 를 준다.
 */
@Service
public class FeedbackService {

    static final int MAX_LIMIT = 100;
    static final int VIEWPORT_MAX = 10_000;

    private final FeedbackRepository feedbackRepository;
    private final FeedbackImageRepository feedbackImageRepository;
    private final FeedbackQueryDao feedbackQueryDao;
    private final UploadService uploadService;
    private final Duration minInterval;
    private final int dailyMax;

    public FeedbackService(
            FeedbackRepository feedbackRepository,
            FeedbackImageRepository feedbackImageRepository,
            FeedbackQueryDao feedbackQueryDao,
            UploadService uploadService,
            @Value("${feedback.rate-limit.min-interval-seconds:60}") long minIntervalSeconds,
            @Value("${feedback.rate-limit.daily-max:20}") int dailyMax) {
        this.feedbackRepository = feedbackRepository;
        this.feedbackImageRepository = feedbackImageRepository;
        this.feedbackQueryDao = feedbackQueryDao;
        this.uploadService = uploadService;
        this.minInterval = Duration.ofSeconds(minIntervalSeconds);
        this.dailyMax = dailyMax;
    }

    /**
     * 제출 — rate limit → 검증 → 저장 → 이미지 연결, 한 트랜잭션. 이미지 하나라도 못 이으면 전체 롤백이고, 앞에서 이은 번호도 {@code
     * PENDING} 으로 돌아간다.
     *
     * @param userAgent 요청 헤더 원문. 줄인 값만 저장한다
     */
    @Transactional
    public MyFeedbackItem submit(Long accountId, FeedbackSubmitRequest request, String userAgent) {
        Instant now = Instant.now();
        checkRateLimit(accountId, now);

        if (request.type() == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "type 을 골라 주세요.");
        }
        String title = trimmed(request.title());
        String content = trimmed(request.content());
        requireLength("title", title, Feedback.TITLE_MIN, Feedback.TITLE_MAX);
        requireLength("content", content, Feedback.CONTENT_MIN, Feedback.CONTENT_MAX);
        List<Long> fileIds = imageFileIds(request.imageFileIds());
        FeedbackSubmitRequest.Viewport viewport = request.viewport();
        if (viewport != null) {
            requireViewport("viewport.width", viewport.width());
            requireViewport("viewport.height", viewport.height());
        }

        Feedback feedback =
                feedbackRepository.save(
                        new Feedback(
                                accountId,
                                request.type(),
                                title,
                                content,
                                BrowserLabel.describe(userAgent),
                                viewport == null ? null : viewport.width(),
                                viewport == null ? null : viewport.height()));
        for (int order = 0; order < fileIds.size(); order++) {
            StorageObject attached =
                    uploadService.attach(
                            fileIds.get(order), accountId, StoragePurpose.FEEDBACK, now);
            feedbackImageRepository.save(
                    new FeedbackImage(
                            feedback.getId(),
                            attached.getId(),
                            uploadService.publicUrl(attached),
                            order));
        }
        return MyFeedbackItem.from(feedback);
    }

    @Transactional(readOnly = true)
    public MyFeedbackListResponse getMine(Long accountId, int offset, int limit) {
        requirePage(offset, limit);
        long total = feedbackQueryDao.countMine(accountId);
        // offset 이 마지막 페이지를 넘으면 에러가 아니라 빈 페이지다
        if (total == 0 || offset >= total) {
            return new MyFeedbackListResponse(List.of(), total, offset, limit);
        }
        List<MyFeedbackItem> items =
                feedbackQueryDao.findMine(accountId, offset, limit).stream()
                        .map(MyFeedbackItem::from)
                        .toList();
        return new MyFeedbackListResponse(items, total, offset, limit);
    }

    @Transactional(readOnly = true)
    public MyFeedbackDetailResponse getMine(Long accountId, Long feedbackId) {
        Feedback feedback =
                feedbackRepository
                        .findByIdAndAccountId(feedbackId, accountId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "찾을 수 없는 문의입니다."));
        return new MyFeedbackDetailResponse(
                feedback.getId(),
                feedback.getType(),
                feedback.getTitle(),
                feedback.getContent(),
                feedback.submitterStatus(),
                feedback.getCreatedAt(),
                images(feedbackImageRepository, feedback.getId()),
                FeedbackReply.of(feedback));
    }

    static List<FeedbackImageUrl> images(FeedbackImageRepository repository, Long feedbackId) {
        return repository.findAllByFeedbackIdOrderByDisplayOrderAsc(feedbackId).stream()
                .map(image -> new FeedbackImageUrl(image.getImageUrl()))
                .toList();
    }

    static void requirePage(int offset, int limit) {
        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset 은 0 이상이어야 합니다.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "limit 은 1 이상 " + MAX_LIMIT + " 이하여야 합니다.");
        }
    }

    static String trimmed(String value) {
        return value == null ? null : value.strip();
    }

    /** 글자 수는 {@link String#length()} (UTF-16) — 화면의 {@code string.length} 와 같은 단위다. */
    static void requireLength(String field, String value, int min, int max) {
        if (value == null || value.length() < min || value.length() > max) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, field + " 은 " + min + "~" + max + "자여야 합니다.");
        }
    }

    /** 60초 안에 한 건, 24시간 안에 {@code dailyMax} 건. 동시에 두 번 눌러 둘 다 통과해도 해가 없어 잠그지 않는다. */
    private void checkRateLimit(Long accountId, Instant now) {
        boolean tooSoon =
                feedbackRepository.countByAccountIdAndCreatedAtAfter(
                                accountId, now.minus(minInterval))
                        > 0;
        boolean tooMany =
                feedbackRepository.countByAccountIdAndCreatedAtAfter(
                                accountId, now.minus(Duration.ofHours(24)))
                        >= dailyMax;
        if (tooSoon || tooMany) {
            throw new BusinessException(ErrorCode.TOO_MANY_REQUESTS);
        }
    }

    private static List<Long> imageFileIds(List<Long> requested) {
        if (requested == null) {
            return List.of();
        }
        if (requested.size() > FeedbackImage.MAX_PER_FEEDBACK) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT,
                    "이미지는 " + FeedbackImage.MAX_PER_FEEDBACK + "장까지 첨부할 수 있습니다.");
        }
        if (requested.contains(null) || new HashSet<>(requested).size() != requested.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "imageFileIds 가 올바르지 않습니다.");
        }
        return requested;
    }

    private static void requireViewport(String field, Integer value) {
        if (value == null || value < 1 || value > VIEWPORT_MAX) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, field + " 은 1~" + VIEWPORT_MAX + " 이어야 합니다.");
        }
    }
}
