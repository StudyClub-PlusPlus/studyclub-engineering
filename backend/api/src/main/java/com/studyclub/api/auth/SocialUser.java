package com.studyclub.api.auth;

import com.studyclub.domain.account.Issuer;

/**
 * 소셜 로그인 제공자가 "이 사람이다" 라고 답한 결과. 제공자마다 모양이 달라서({@link GoogleOAuthClient}·{@link AppleOAuthClient})
 * 여기서 하나로 맞춘 뒤 가입·조회는 같은 경로를 탄다.
 *
 * @param emailVerified 제공자가 이메일 소유를 확인했는지. 모르면 false
 * @param name 표시 이름. 애플은 code 교환 응답에 이름이 없어 null — 앱이 첫 인가에서 받은 이름을 따로 보낸다
 * @param picture 프로필 사진 URL. 애플은 없다
 * @param refreshToken 탈퇴 때 연결을 끊는 데 쓰는 제공자 refresh token. 애플만 저장한다
 */
public record SocialUser(
        Issuer issuer,
        String sub,
        String email,
        boolean emailVerified,
        String name,
        String picture,
        String refreshToken) {}
