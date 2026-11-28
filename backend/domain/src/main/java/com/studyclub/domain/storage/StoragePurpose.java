package com.studyclub.domain.storage;

/** 올린 파일의 용도. 저장소 폴더를 정하고, 연결할 때 「프로필용으로 올린 파일을 썸네일에 꽂는」 일을 막는다. */
public enum StoragePurpose {
    PROFILE("gigs/profiles", true),
    STUDY_THUMBNAIL("gigs/thumbnails", true),
    /** 문의·오류 신고 첨부. 비공개 폴더 — 권한을 확인하는 API 가 읽어서 내준다 (specs/feedback/spec.md). */
    FEEDBACK("private/feedbacks", false);

    private final String folder;
    private final boolean publicFile;

    StoragePurpose(String folder, boolean publicFile) {
        this.folder = folder;
        this.publicFile = publicFile;
    }

    /** 저장소 안의 폴더. {@code gigs/} 는 S3 문서가 공개 파일 폴더로 정한 곳이고, 그 밖은 CDN 으로 열리지 않는다. */
    public String folder() {
        return folder;
    }

    /** 공개 주소(CDN)로 내주는 용도인가. 아니면 응답에 주소를 싣지 않고 API 가 권한을 확인한 뒤 내준다. */
    public boolean isPublic() {
        return publicFile;
    }
}
