package com.studyclub.api.account;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 최고 관리자 — env {@code SUPER_ADMIN_EMAILS}(콤마 목록)의 사람 (specs/admin-users/spec.md 「최고 관리자」, 청사진
 * super-admin).
 *
 * <p>정본은 env 하나다. 판정은 DB 권한이 아니라 계정 이메일이 목록에 있는가로 한다 — DB 는 부팅마다 채우는 사본이다. 비면 최고 관리자 없음이고 캡틴을 내릴 수
 * 있는 사람이 없다. 코드에 기본 이메일을 두지 않는다.
 */
@Slf4j
@Component
public class SuperAdmins {

    private final AccountRepository accountRepository;
    private final Set<String> emails;

    public SuperAdmins(
            AccountRepository accountRepository, @Value("${super-admin.emails:}") String raw) {
        this.accountRepository = accountRepository;
        this.emails = parse(raw);
    }

    /** split(',') → trim → 소문자 → 빈 칸 버림 → 중복 제거 (순서 유지). */
    static Set<String> parse(String raw) {
        if (raw == null) {
            return Set.of();
        }
        return Arrays.stream(raw.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public boolean isConfigured() {
        return !emails.isEmpty();
    }

    public boolean includes(Account account) {
        return account != null
                && account.getEmail() != null
                && emails.contains(account.getEmail().trim().toLowerCase(Locale.ROOT));
    }

    /**
     * 부팅 동기화(멱등) — 목록의 계정이 크루면 캡틴으로 올린다. 화면에서 무슨 일이 있었든 되돌린다. 아직 가입 전인 사람은 건너뛰고, 가입한 뒤 다음 부팅에 올라간다.
     * 목록이 비면 경고 한 줄.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void syncOnBoot() {
        if (!isConfigured()) {
            log.warn("[super-admin] SUPER_ADMIN_EMAILS 가 비어 있다. 최고 관리자 없음, 캡틴을 내릴 수 있는 사람이 없다");
            return;
        }
        int missing = 0;
        for (String email : emails) {
            Account account = accountRepository.findByEmail(email).orElse(null);
            if (account == null) {
                missing++;
            } else if (account.changeSystemRole(SystemRole.ADMIN)) {
                log.info(
                        "[super-admin] account {} 를 캡틴으로 올렸다 (SUPER_ADMIN_EMAILS)",
                        account.getId());
            }
        }
        if (missing > 0) {
            log.warn(
                    "[super-admin] SUPER_ADMIN_EMAILS 중 {}명은 계정이 아직 없다. 가입 뒤 재기동하면 캡틴이 된다",
                    missing);
        }
    }
}
