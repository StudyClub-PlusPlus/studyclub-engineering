package com.studyclub.api.sitenotice;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;

/** 콘솔 목록 조건. {@code q} 는 정규화된 값(앞뒤 공백 제거, 빈 문자열은 null). */
public record AdminSiteNoticeListFilter(String q, Sort sort, Order order) {

    public enum Sort {
        /** 게시 시각 = 등록 시각이라 {@code ID} 순서와 같다. 기본값. */
        PUBLISHED_AT,
        TITLE,
        UPDATED_AT;

        static Sort parse(String value) {
            return switch (value) {
                case "publishedAt" -> PUBLISHED_AT;
                case "title" -> TITLE;
                case "updatedAt" -> UPDATED_AT;
                default ->
                        throw new BusinessException(
                                ErrorCode.INVALID_INPUT,
                                "sort 는 publishedAt·title·updatedAt 중 하나여야 합니다.");
            };
        }
    }

    public enum Order {
        ASC,
        DESC;

        static Order parse(String value) {
            return switch (value) {
                case "asc" -> ASC;
                case "desc" -> DESC;
                default ->
                        throw new BusinessException(
                                ErrorCode.INVALID_INPUT, "order 는 asc·desc 중 하나여야 합니다.");
            };
        }
    }
}
