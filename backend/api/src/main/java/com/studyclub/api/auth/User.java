package com.studyclub.api.auth;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 최소 User — 구글 프로필 + 역할. 신청/출석 등은 이후 얹는다.
 *
 * <p><b>구글이 주는 프로필 문자열은 길이를 믿지 않는다.</b> 이름·사진 URL 은 우리가 못 정하는
 * 외부 입력이고, 컬럼보다 길면 INSERT 가 터져 <b>로그인 전체가 500</b> 이 된다
 * (2026-08-24 실제 사고: picture 가 varchar(512) 를 넘겨 백오피스 첫 로그인이 막혔다).
 *
 * <p>1차 해법은 <b>컬럼을 실제 값이 들어갈 만큼 넓히는 것</b>(picture 2048). 그래야 아바타를
 * 잃지 않는다. 다만 길이는 구글이 정하는 값이라 넓히는 것만으로는 "다시는 안 터진다"고 말할 수
 * 없으므로, <b>진입 지점 가드를 backstop 으로 같이 둔다</b> — 넘치더라도 500 대신 값만 포기한다.
 */
@Entity
@Table(name = "USERS", uniqueConstraints = @UniqueConstraint(name = "uk_users_email", columnNames = "email"))
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    private String name;

    @Column(length = 2048)
    private String picture;

    @Column(name = "google_sub")
    private String googleSub;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.STUDENT;

    /** 컬럼 길이 상한. 엔티티가 자기 한계를 알고 있어야 호출부마다 방어하지 않는다. */
    private static final int NAME_MAX = 255;
    private static final int PICTURE_MAX = 2048;

    /** 컬럼 길이 상한. 엔티티가 자기 한계를 알고 있어야 호출부마다 방어하지 않는다. */
    private static final int NAME_MAX = 255;
    private static final int PICTURE_MAX = 2048;

    protected User() {
    }

    public User(String email, String name, String picture, String googleSub, Role role) {
        this.email = email;
        this.name = clip(name, NAME_MAX);
        this.picture = dropIfTooLong(picture, PICTURE_MAX);
        this.googleSub = googleSub;
        this.role = role != null ? role : Role.STUDENT;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    public String getPicture() {
        return picture;
    }

    public String getGoogleSub() {
        return googleSub;
    }

    public Role getRole() {
        return role;
    }

    public void setName(String name) {
        this.name = clip(name, NAME_MAX);
    }

    public void setPicture(String picture) {
        this.picture = dropIfTooLong(picture, PICTURE_MAX);
    }

    /** 이름은 잘라서라도 남긴다 — 잘린 이름도 사람을 알아보는 데 쓸모가 있다. */
    static String clip(String v, int max) {
        return v == null || v.length() <= max ? v : v.substring(0, max);
    }

    /**
     * backstop. 컬럼(2048)을 넓혀 뒀으니 여기 걸릴 일은 사실상 없지만, 걸리면 URL 은
     * 자르지 않고 버린다 — 잘린 URL 은 깨진 이미지라 없느니만 못하다.
     * 아바타만 기본 이미지로 떨어지고 로그인은 통과한다.
     */
    static String dropIfTooLong(String v, int max) {
        return v == null || v.length() <= max ? v : null;
    }

    public void setGoogleSub(String googleSub) {
        this.googleSub = googleSub;
    }

    public void setRole(Role role) {
        this.role = role;
    }
}
