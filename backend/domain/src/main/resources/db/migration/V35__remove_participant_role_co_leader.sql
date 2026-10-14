-- 부반장(CO_LEADER) 역할을 없앤다 — POL-0001 「스터디 안의 역할은 네비게이터 하나다」 (2026-09-22 결정).
-- 남아 있는 부반장은 네비게이터(LEADER)로 올린다. 그동안 LEADER 와 같은 권한이었으므로 할 수 있는 일은 줄지 않는다.
UPDATE STUDY_PARTICIPANT SET PARTICIPANT_ROLE = 'LEADER' WHERE PARTICIPANT_ROLE = 'CO_LEADER';
