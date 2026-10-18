-- 리브랜딩: StudyClub++ → StudyClub, studyclub-plusplus.com → studyclub.life (2026-10-18)
--   V14·V38 은 이미 적용돼 체크섬이 잠겨 있어 고치지 않고, 저장된 템플릿을 여기서 바꾼다.
--   운영자가 편집한 템플릿이 있을 수 있어 통째로 덮지 않고 문자열만 치환한다.
--   치환 순서: 로고의 <span>++</span> → 도메인 → 이름.
UPDATE NOTIFICATION_TEMPLATE
   SET BODY = REPLACE(REPLACE(REPLACE(
                BODY,
                'StudyClub<span style="color:#5267D8;">++</span>', 'StudyClub'),
                'studyclub-plusplus.com', 'studyclub.life'),
                'StudyClub++', 'StudyClub'),
       SUBJECT = REPLACE(SUBJECT, 'StudyClub++', 'StudyClub'),
       UPDATED_AT = UTC_TIMESTAMP(6)
 WHERE BODY LIKE '%StudyClub%' OR BODY LIKE '%studyclub-plusplus.com%' OR SUBJECT LIKE '%StudyClub++%';
