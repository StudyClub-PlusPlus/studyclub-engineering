package com.studyclub.domain.storage;

/** 올린 파일의 용도. 저장소 폴더를 정하고, 연결할 때 「프로필용으로 올린 파일을 썸네일에 꽂는」 일을 막는다. */
public enum StoragePurpose {
    PROFILE("gigs/profiles"),
    STUDY_THUMBNAIL("gigs/thumbnails"),
    /** 문의·오류 신고 첨부. 지금은 공개 폴더다 — 비공개 + 서명 URL 은 후속 (specs/feedback/spec.md 「후속 개발」). */
    FEEDBACK("gigs/feedbacks");

    private final String folder;

    StoragePurpose(String folder) {
        this.folder = folder;
    }

    /** 저장소 안의 폴더. {@code gigs/} 는 S3 문서가 공개 파일 폴더로 정한 곳이다. */
    public String folder() {
        return folder;
    }
}
