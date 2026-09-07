package com.studyclub.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.api.config.JpaConfig;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

/**
 * {@code BaseEntity} 의 감사 컬럼이 <b>실제로 채워지는지</b>를 지킨다.
 *
 * <p>이건 순수 단위 테스트로 잡히지 않는다 — {@code @CreatedDate} 는 어노테이션일 뿐이고,
 * 값을 채우는 건 {@code @EnableJpaAuditing} 이 켜는 리스너다. 그 한 줄을 지우면
 * <b>컴파일도 되고 엔티티 단위 테스트도 통과하는데 DB 에는 null 이 들어간다.</b>
 * 그래서 persist 까지 하는 슬라이스 테스트로 둔다.
 */
@DataJpaTest
@Import(JpaConfig.class)
class AccountAuditingTest {

    @Autowired
    AccountRepository accounts;

    @Autowired
    EntityManager em;

    @Test
    @DisplayName("저장하면 createdAt·updatedAt 이 자동으로 채워진다 — 엔티티가 손으로 넣지 않는다")
    void fillsAuditColumnsOnInsert() {
        // given
        Instant before = Instant.now();

        // when
        Account saved = accounts.save(new Account("audit@studyclub-plusplus.com", "감사", null, SystemRole.MEMBER));
        em.flush();

        // then
        assertThat(saved.getCreatedAt()).isNotNull().isAfterOrEqualTo(before);
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("수정하면 updatedAt 만 움직이고 createdAt 은 고정이다")
    void movesOnlyUpdatedAtOnModify() {
        // given
        Account saved = accounts.save(new Account("edit@studyclub-plusplus.com", "수정", null, SystemRole.MEMBER));
        em.flush();
        Instant createdAt = saved.getCreatedAt();
        Instant updatedAt = saved.getUpdatedAt();

        // when
        saved.setNickname("수정됨");
        em.flush();

        // then
        assertThat(saved.getCreatedAt()).isEqualTo(createdAt);
        assertThat(saved.getUpdatedAt()).isAfterOrEqualTo(updatedAt);
    }
}
