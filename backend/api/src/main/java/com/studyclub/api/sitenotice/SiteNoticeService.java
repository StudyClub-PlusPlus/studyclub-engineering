package com.studyclub.api.sitenotice;

import com.studyclub.api.sitenotice.SiteNoticeListResponse.Summary;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.sitenotice.SiteNotice;
import com.studyclub.domain.sitenotice.SiteNoticeRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사용자 사이트의 공지 읽기. 비로그인 방문자도 부른다 — 작성자·수정 시각은 내려 주지 않는다. */
@Service
@Transactional(readOnly = true)
public class SiteNoticeService {

    static final int MAX_LIMIT = 100;

    private final SiteNoticeRepository siteNoticeRepository;
    private final SiteNoticeDao siteNoticeDao;

    public SiteNoticeService(
            SiteNoticeRepository siteNoticeRepository, SiteNoticeDao siteNoticeDao) {
        this.siteNoticeRepository = siteNoticeRepository;
        this.siteNoticeDao = siteNoticeDao;
    }

    public SiteNoticeListResponse getNotices(int offset, int limit) {
        validatePage(offset, limit);
        long total = siteNoticeRepository.countByRemovedAtIsNull();
        // offset 이 마지막 페이지를 넘으면 에러가 아니라 빈 페이지다
        if (total == 0 || offset >= total) {
            return new SiteNoticeListResponse(List.of(), total, offset, limit);
        }
        List<Summary> items =
                siteNoticeDao.findAlive(offset, limit).stream()
                        .map(SiteNoticeService::toSummary)
                        .toList();
        return new SiteNoticeListResponse(items, total, offset, limit);
    }

    public SiteNoticeDetailResponse getNotice(Long noticeId) {
        SiteNotice notice =
                siteNoticeRepository
                        .findByIdAndRemovedAtIsNull(noticeId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        // 이웃도 살아 있는 것 중에서 고른다 — 바로 옆이 삭제됐으면 조건이 그 건을 건너뛴다
        Summary newer =
                siteNoticeRepository
                        .findFirstByRemovedAtIsNullAndIdGreaterThanOrderByIdAsc(noticeId)
                        .map(SiteNoticeService::toSummary)
                        .orElse(null);
        Summary older =
                siteNoticeRepository
                        .findFirstByRemovedAtIsNullAndIdLessThanOrderByIdDesc(noticeId)
                        .map(SiteNoticeService::toSummary)
                        .orElse(null);
        return new SiteNoticeDetailResponse(
                notice.getId(),
                notice.getTitle(),
                notice.getBody(),
                notice.getCreatedAt(),
                newer,
                older);
    }

    private static void validatePage(int offset, int limit) {
        if (offset < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "offset 은 0 이상이어야 합니다.");
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BusinessException(
                    ErrorCode.INVALID_INPUT, "limit 은 1 이상 " + MAX_LIMIT + " 이하여야 합니다.");
        }
    }

    private static Summary toSummary(SiteNotice notice) {
        return new Summary(notice.getId(), notice.getTitle(), notice.getCreatedAt());
    }
}
