package com.studyclub.api.sitenotice;

import com.studyclub.api.sitenotice.AdminSiteNoticeListFilter.Order;
import com.studyclub.api.sitenotice.AdminSiteNoticeListFilter.Sort;
import com.studyclub.api.sitenotice.AdminSiteNoticeListResponse.Summary;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.sitenotice.SiteNotice;
import com.studyclub.domain.sitenotice.SiteNoticeRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 콘솔의 공지 쓰기·읽기. 요청자가 캡틴인지는 {@code @RequireAdmin} 이 이미 봤다 — 여기서 다시 보지 않는다
 * (specs/authz-guards/spec.md).
 */
@Service
@Transactional(readOnly = true)
public class AdminSiteNoticeService {

    static final int MAX_LIMIT = 100;
    static final int MAX_QUERY_LENGTH = 100;

    /** 출석부·신청자 목록과 같은 문구 — 작성자 계정이 탈퇴해 없을 때. */
    static final String WITHDRAWN_AUTHOR_NAME = "탈퇴한 회원";

    private final SiteNoticeRepository siteNoticeRepository;
    private final SiteNoticeDao siteNoticeDao;
    private final AccountRepository accountRepository;

    public AdminSiteNoticeService(
            SiteNoticeRepository siteNoticeRepository,
            SiteNoticeDao siteNoticeDao,
            AccountRepository accountRepository) {
        this.siteNoticeRepository = siteNoticeRepository;
        this.siteNoticeDao = siteNoticeDao;
        this.accountRepository = accountRepository;
    }

    public AdminSiteNoticeListResponse getNotices(
            String q, String sort, String order, int offset, int limit) {
        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset 은 0 이상이어야 합니다.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "limit 은 1 이상 " + MAX_LIMIT + " 이하여야 합니다.");
        }
        AdminSiteNoticeListFilter filter =
                new AdminSiteNoticeListFilter(
                        normalizeQuery(q), Sort.parse(sort), Order.parse(order));

        long total = siteNoticeDao.countForAdmin(filter);
        if (total == 0 || offset >= total) {
            return new AdminSiteNoticeListResponse(List.of(), total, offset, limit);
        }
        List<SiteNotice> notices = siteNoticeDao.findForAdmin(filter, offset, limit);
        Map<Long, String> nicknames =
                nicknamesOf(notices.stream().map(SiteNotice::getAuthorAccountId).toList());
        List<Summary> items =
                notices.stream()
                        .map(
                                notice ->
                                        new Summary(
                                                notice.getId(),
                                                notice.getTitle(),
                                                authorName(nicknames, notice),
                                                notice.getCreatedAt(),
                                                notice.getUpdatedAt()))
                        .toList();
        return new AdminSiteNoticeListResponse(items, total, offset, limit);
    }

    public AdminSiteNoticeDetailResponse getNotice(Long noticeId) {
        SiteNotice notice = findAlive(noticeId);
        String authorName =
                accountRepository
                        .findById(notice.getAuthorAccountId())
                        .map(Account::getNickname)
                        .orElse(WITHDRAWN_AUTHOR_NAME);
        return new AdminSiteNoticeDetailResponse(
                notice.getId(),
                notice.getTitle(),
                notice.getBody(),
                authorName,
                notice.getCreatedAt(),
                notice.getUpdatedAt());
    }

    @Transactional
    public Long create(Long authorAccountId, SiteNoticeRequest request) {
        SiteNotice notice = new SiteNotice(authorAccountId, request.title(), request.body());
        return siteNoticeRepository.save(notice).getId();
    }

    /** 값이 그대로여도 성공이다. 바뀐 게 없으면 더티 체킹이 UPDATE 를 내지 않아 {@code UPDATED_AT} 도 그대로다. */
    @Transactional
    public void update(Long noticeId, SiteNoticeRequest request) {
        findAlive(noticeId).edit(request.title(), request.body());
    }

    /** 이미 삭제된 공지는 없는 것과 같아 두 번째는 404 다. */
    @Transactional
    public void remove(Long noticeId) {
        findAlive(noticeId).remove(Instant.now());
    }

    private SiteNotice findAlive(Long noticeId) {
        return siteNoticeRepository
                .findByIdAndRemovedAtIsNull(noticeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    private Map<Long, String> nicknamesOf(List<Long> accountIds) {
        return accountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(Account::getId, Account::getNickname));
    }

    private static String authorName(Map<Long, String> nicknames, SiteNotice notice) {
        return nicknames.getOrDefault(notice.getAuthorAccountId(), WITHDRAWN_AUTHOR_NAME);
    }

    private static String normalizeQuery(String q) {
        if (q == null) {
            return null;
        }
        String trimmed = q.trim();
        if (trimmed.length() > MAX_QUERY_LENGTH) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "q 는 " + MAX_QUERY_LENGTH + "자 이하여야 합니다.");
        }
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed;
    }
}
