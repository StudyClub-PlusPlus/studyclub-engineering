-- 현재 DB 의 구조를 erd.json 한 덩어리로 — 언어·ORM 무관 (mysql CLI 만 있으면 된다). specs/schema §수집기
--   mysql --default-character-set=utf8mb4 -h <host> -u <user> -p<pw> <db> -N -B -r < erd.sql > erd.json
--   (문자셋을 안 주면 한글 default 가 ?? 로 깨진다)
-- 순서가 필요한 배열은 GROUP_CONCAT … ORDER BY 로 만든다 — JSON_ARRAYAGG 는 순서를 보장하지 않는다
SET SESSION group_concat_max_len = 16777216;
-- extract.cjs 와 같은 모양. Flyway 기록 테이블은 뺀다
SELECT JSON_OBJECT(
  'engine', CONCAT('mysql ', SUBSTRING_INDEX(VERSION(), '-', 1)),
  'tables', COALESCE((
    SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT(
      'name', t.TABLE_NAME,
      'columns', (
        SELECT CAST(CONCAT('[', GROUP_CONCAT(JSON_OBJECT(
          'name', c.COLUMN_NAME,
          'type', c.COLUMN_TYPE,
          'nullable', CAST(IF(c.IS_NULLABLE = 'YES', 'true', 'false') AS JSON),
          'default', c.COLUMN_DEFAULT,
          'pk', CAST(IF(c.COLUMN_KEY = 'PRI', 'true', 'false') AS JSON),
          'extra', c.EXTRA) ORDER BY c.ORDINAL_POSITION SEPARATOR ','), ']') AS JSON)
        FROM information_schema.COLUMNS c WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME),
      'fks', COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT('name', k.n, 'columns', k.cols, 'refTable', k.rt, 'refColumns', k.rcols))
        FROM (
          SELECT CONSTRAINT_NAME n, MIN(REFERENCED_TABLE_NAME) rt,
                 CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(COLUMN_NAME) ORDER BY ORDINAL_POSITION), ']') AS JSON) cols,
                 CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(REFERENCED_COLUMN_NAME) ORDER BY ORDINAL_POSITION), ']') AS JSON) rcols
          FROM information_schema.KEY_COLUMN_USAGE kc
          WHERE TABLE_SCHEMA = t.TABLE_SCHEMA AND TABLE_NAME = t.TABLE_NAME AND REFERENCED_TABLE_NAME IS NOT NULL
          GROUP BY CONSTRAINT_NAME) k), JSON_ARRAY()),
      'indexes', COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT('name', i.n, 'columns', i.cols, 'unique', CAST(IF(i.nu = 0, 'true', 'false') AS JSON)))
        FROM (
          SELECT INDEX_NAME n, MIN(NON_UNIQUE) nu, CAST(CONCAT('[', GROUP_CONCAT(JSON_QUOTE(COLUMN_NAME) ORDER BY SEQ_IN_INDEX), ']') AS JSON) cols
          FROM information_schema.STATISTICS st
          WHERE TABLE_SCHEMA = t.TABLE_SCHEMA AND TABLE_NAME = t.TABLE_NAME AND INDEX_NAME <> 'PRIMARY'
          GROUP BY INDEX_NAME) i), JSON_ARRAY())) ORDER BY t.TABLE_NAME SEPARATOR ','), ']') AS JSON)
    FROM information_schema.TABLES t
    WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_NAME NOT IN ('flyway_schema_history')), JSON_ARRAY())
) AS erd;
