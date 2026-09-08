package com.studyclub.domain.account;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, Long> {

    Optional<Account> findByEmail(String email);

    /**
     * 온보딩 완료 처리 전용 — 행을 잠근다. 두 탭에서 동시에 완료 요청을 보내도 한쪽이
     * 먼저 커밋할 때까지 다른 쪽을 블록시켜, {@code UserRegisteredEvent} 가 두 번 나가는
     * 걸 막는다 (specs/user-onboarding/spec.md). 일반 조회(findByEmail)에는 락을 걸지 않는다 —
     * 로그인 등 훨씬 빈번한 경로의 동시성을 불필요하게 낮추지 않기 위해서다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a where a.email = :email")
    Optional<Account> findByEmailForUpdate(@Param("email") String email);

    boolean existsByNickname(String nickname);

    /**
     * 온보딩 닉네임 중복 검사 전용 — 대소문자 무시. DB(MySQL)는 utf8mb4_unicode_ci 라 이미
     * 대소문자를 구분하지 않지만, 테스트(H2)는 그렇지 않으므로 환경에 상관없이 같은 동작을
     * 보장하려면 JPQL 에서 명시적으로 비교해야 한다.
     */
    boolean existsByNicknameIgnoreCase(String nickname);
}
