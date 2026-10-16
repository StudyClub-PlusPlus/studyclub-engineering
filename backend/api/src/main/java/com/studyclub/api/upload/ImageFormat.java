package com.studyclub.api.upload;

/** 받는 이미지 형식 셋. 확장자와 Content-Type 은 파일 앞 바이트로 판정한 결과에서 나온다 — 브라우저가 보낸 값은 믿지 않는다. */
public enum ImageFormat {
    JPEG("image/jpeg", "jpg"),
    PNG("image/png", "png"),
    WEBP("image/webp", "webp");

    private final String contentType;
    private final String extension;

    ImageFormat(String contentType, String extension) {
        this.contentType = contentType;
        this.extension = extension;
    }

    public String contentType() {
        return contentType;
    }

    public String extension() {
        return extension;
    }
}
