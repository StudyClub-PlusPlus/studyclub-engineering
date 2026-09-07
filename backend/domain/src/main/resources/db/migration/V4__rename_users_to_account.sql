-- V4 — USERS 테이블을 ACCOUNT 로 변경.
-- V1 당시 복수형 USERS 로 생성됐으나, 도메인 개념(Account)과 나머지 테이블 규칙에 맞게 교체한다.
-- MySQL 은 RENAME TABLE 시 FK 참조도 자동으로 갱신한다.

RENAME TABLE USERS TO ACCOUNT;
