package com.studyclub.domain.storage;

/**
 * 파일이 있는 오브젝트 스토리지. 지금은 {@link #S3} 만 쓴다.
 *
 * <p>행마다 적어 두는 이유: 다른 저장소로 옮길 때 파일을 복사한 뒤 행의 값만 바꾸면 되게 — 두 저장소가 한동안 같이 있어도 지우기가 행의 값으로 맞는 구현을 고른다.
 */
public enum StorageProvider {
    S3,
    R2
}
