package com.studyclub.domain.application;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
        name = "STUDY_APPLICATION",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_study_application_recruitment_account",
                        columnNames = {"RECRUITMENT_ID", "ACCOUNT_ID"}),
        indexes = {@Index(name = "idx_study_application_account", columnList = "ACCOUNT_ID")})
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class StudyApplication extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACCOUNT_ID", nullable = false)
    private Long accountId;

    @Column(name = "RECRUITMENT_ID", nullable = false)
    private Long recruitmentId;

    @Column(name = "FORM_ANSWER", nullable = false, columnDefinition = "json")
    @JdbcTypeCode(SqlTypes.JSON)
    private String formAnswer;

    /**
     * 회원 탈퇴 — {@code FORM_ANSWER.discordNickname} 비식별화. 이 필드는 {@code ACCOUNT.DISCORD_NICKNAME} 의 제출
     * 시점 스냅샷이라, 원본 계정을 지워도 이 행 안에 그대로 남는다 — {@code availableDays}·{@code scheduleAgreed}·{@code
     * answers} 같은 나머지 값은 개인 식별값이 아니라 그대로 둔다(specs/user-leave/spec.md). JSON 파싱·치환은 Jackson 의존성이 없는
     * domain 모듈이 아니라 호출자(서비스 계층)의 책임이다 — 이 메서드는 이미 치환된 JSON 문자열을 그대로 반영만 한다.
     */
    public void applyMaskedFormAnswer(String maskedFormAnswerJson) {
        this.formAnswer = maskedFormAnswerJson;
    }
}
