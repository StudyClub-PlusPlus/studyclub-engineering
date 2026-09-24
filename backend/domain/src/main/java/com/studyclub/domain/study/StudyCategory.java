package com.studyclub.domain.study;

/**
 * 스터디 분야 (11종). 실제로 열린 스터디에서 뽑은 목록이라 기획이 정하고 enum 이 따라간다. 순서는 목록에 보이는 순서다.
 *
 * <p>2026-09-21 14종 → 11종으로 합쳤다 (CS → ALGORITHM, BACKEND·FRONTEND·MOBILE → SOFTWARE, PLANNING·PM →
 * PRODUCT, DESIGN → OTHER).
 */
public enum StudyCategory {
    AI_ML,
    ALGORITHM,
    DATA,
    SOFTWARE,
    CAREER,
    BOOK_CLUB,
    LANGUAGE,
    LIFESTYLE,
    PRODUCT,
    BUSINESS,
    OTHER
}
