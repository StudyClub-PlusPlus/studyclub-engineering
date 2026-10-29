-- 애플 로그인 — 탈퇴 때 애플 쪽 연결을 끊으려면(/auth/revoke) 로그인 때 받은 refresh token 이 필요하다. 구글은 비워 둔다.
ALTER TABLE ACCOUNT_IDENTITY
    ADD COLUMN PROVIDER_REFRESH_TOKEN VARCHAR(1024) NULL;
