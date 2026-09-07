package com.studyclub.domain.support;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * 모든 엔티티의 부모. <b>새 엔티티는 예외 없이 이걸 상속한다.</b>
 *
 * <p>감사 컬럼을 손으로 채우지 않는다 — {@code createdAt = Instant.now()} 를 필드에 박으면
 * 엔티티가 늘어날 때마다 같은 코드가 복사되고, 한 군데만 빠뜨려도 "언제 만들어졌는지 모르는 행"이
 * 생긴다. 채우는 주체는 {@code @EnableJpaAuditing} 이 켠 {@link AuditingEntityListener} 다.
 *
 * <p>시각은 {@link Instant} (UTC). {@code LocalDateTime} 을 쓰면 서버 타임존이 바뀔 때
 * 과거 데이터의 의미가 조용히 달라진다 — 스터디원이 3개 타임존에 흩어져 있어 특히 위험하다.
 * 표시용 타임존 변환은 화면 계층의 일이다.
 *
 * <p>수정자/생성자(user) 감사는 넣지 않았다. 필요해지면 {@code @CreatedBy}/{@code @LastModifiedBy}
 * 와 {@code AuditorAware} 를 여기 얹는다 — 엔티티는 손대지 않아도 된다.
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
