package com.studyclub.domain.account;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, Long> {

    Optional<Account> findByEmail(String email);

    /**
     * 행을 잠근다. 두 탭에서 동시에 온보딩 완료 요청을 보내도 한쪽이 먼저 커밋할 때까지 다른 쪽을 블록시켜, {@code UserRegisteredEvent} 가 두 번
     * 나가는 걸 막는다 (specs/user-onboarding/spec.md). 일반 조회(findById)에는 락을 걸지 않는다 — 로그인 등 훨씬 빈번한 경로의
     * 동시성을 불필요하게 낮추지 않기 위해서다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a where a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") Long id);

    /**
     * 계정 권한 변경 전용 — {@code ADMIN} 행을 모두 잠그고 읽는다. 캡틴 둘이 동시에 서로를 내려도 한쪽이 커밋할 때까지 다른 쪽이 기다렸다가 다시 센 값을
     * 보게 해, 캡틴이 0명이 되는 일을 막는다 (specs/admin-users/spec.md 「처리 규칙」). 호출자는 반환된 목록의 크기로 캡틴 수를 센다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select a from Account a where a.systemRole = com.studyclub.domain.account.SystemRole.ADMIN")
    List<Account> findAllAdminsForUpdate();

    /** 계정 권한별 수. 백오피스 회원 목록이 「마지막 캡틴」 잠금 사유를 계산할 때 쓴다 — 잠그지 않는 읽기다. */
    long countBySystemRole(SystemRole systemRole);

    /** 디스코드 유저 ID 다건 → 회원. DISCORD_ID 는 UNIQUE 라 유저당 최대 1행이다. */
    List<Account> findByDiscordIdIn(Collection<String> discordIds);

    boolean existsByNickname(String nickname);

    /**
     * 온보딩 닉네임 중복 검사 전용 — 대소문자 무시. DB(MySQL)는 utf8mb4_unicode_ci 라 이미 대소문자를 구분하지 않지만, 테스트(H2)는 그렇지
     * 않으므로 환경에 상관없이 같은 동작을 보장하려면 JPQL 에서 명시적으로 비교해야 한다.
     */
    boolean existsByNicknameIgnoreCase(String nickname);

    /**
     * 프로필 수정 닉네임 중복 검사 — 자기 행을 뺀 "다른 계정" 만 본다. 자기 닉네임인지를 자바 문자열 비교로 가리지 않는 이유: DB 는 {@code cafe} 와
     * {@code café}, 반각과 전각도 같은 값으로 보는데 자바 비교는 다르다고 봐서, 표기만 바꾸려는 본인을 중복으로 막게 된다.
     */
    boolean existsByNicknameIgnoreCaseAndIdNot(String nickname, Long id);
}
