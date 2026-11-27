package com.studyclub.api.timezone;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.time.TimeZoneIds;
import com.studyclub.domain.account.AccountRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 헤더 · 모집 선택기의 회원 시간대 후보. 서버 메모리에 60초 두고, 회원 시간대가 바뀐 트랜잭션이 커밋되면 비운다 ({@link
 * MemberTimeZoneCacheInvalidator}). specs/timezone/spec.md §6
 *
 * <p>서버가 여러 대면 다른 서버의 캐시는 TTL 로만 갱신된다 — 최대 60초 늦을 수 있다.
 */
@Service
public class MemberTimeZoneCandidateService {

    static final Duration TTL = Duration.ofSeconds(60);
    private static final Logger log = LoggerFactory.getLogger(MemberTimeZoneCandidateService.class);

    private final AccountRepository accountRepository;
    private final Clock clock;
    private final AtomicReference<Snapshot> cache = new AtomicReference<>();
    // 스냅숏은 집계를 시작한 세대를 기억한다. 집계 중에 무효화가 오면 세대가 달라 그 스냅숏은 읽히지 않는다
    private final AtomicLong generation = new AtomicLong();

    @Autowired
    public MemberTimeZoneCandidateService(AccountRepository accountRepository) {
        this(accountRepository, Clock.systemUTC());
    }

    MemberTimeZoneCandidateService(AccountRepository accountRepository, Clock clock) {
        this.accountRepository = accountRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MemberTimeZoneCandidatesResponse candidates() {
        Instant now = clock.instant();
        Snapshot cached = cache.get();
        if (cached != null
                && cached.generation() == generation.get()
                && now.isBefore(cached.expiresAt())) {
            return cached.response();
        }
        long startedGeneration = generation.get();
        MemberTimeZoneCandidatesResponse fresh;
        try {
            fresh = new MemberTimeZoneCandidatesResponse(now, aggregate());
        } catch (DataAccessException e) {
            log.warn("회원 시간대 후보 집계 실패", e);
            throw new BusinessException(ErrorCode.TIME_ZONE_CANDIDATES_UNAVAILABLE);
        }
        cache.set(new Snapshot(fresh, now.plus(TTL), startedGeneration));
        return fresh;
    }

    public void invalidate() {
        generation.incrementAndGet();
        cache.set(null);
    }

    // 무효 값은 빼고 deprecated 링크는 정본으로 합친다. 1인 1표 — 계정 행이 하나라 GROUP BY 합이 곧 인원이다
    private List<MemberTimeZoneCandidatesResponse.Item> aggregate() {
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : accountRepository.countOnboardedByTimeZone()) {
            TimeZoneIds.normalize((String) row[0])
                    .ifPresent(zone -> counts.merge(zone, (Long) row[1], Long::sum));
        }
        return counts.entrySet().stream()
                .filter(entry -> entry.getValue() > 0)
                .map(
                        entry ->
                                new MemberTimeZoneCandidatesResponse.Item(
                                        entry.getKey(), entry.getValue()))
                .sorted(
                        Comparator.comparingLong(MemberTimeZoneCandidatesResponse.Item::memberCount)
                                .reversed()
                                .thenComparing(MemberTimeZoneCandidatesResponse.Item::timeZone))
                .toList();
    }

    private record Snapshot(
            MemberTimeZoneCandidatesResponse response, Instant expiresAt, long generation) {}
}
