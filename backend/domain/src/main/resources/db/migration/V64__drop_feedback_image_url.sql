-- 문의 첨부는 비공개 폴더로 옮겨 공개 주소를 저장하지 않는다. 주소는 권한을 확인하는 API 가 만든다.
ALTER TABLE FEEDBACK_IMAGE DROP COLUMN IMAGE_URL;
