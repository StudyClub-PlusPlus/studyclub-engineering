/**
 * 메일 템플릿 목록 — playground `/proto/mail` 이 읽는다. 시안 HTML 은 같은 폴더의 `<key>.html` 이다.
 *
 * 새 메일은 `user-registered-email.html` 을 복사해 파일을 만들고 여기에 한 줄 추가한다.
 * `subject` 는 DB `NOTIFICATION_TEMPLATE.SUBJECT` 에 들어갈 그대로, `sample` 은 미리보기에 채울 예시 값이다.
 * 반영은 이 파일 PR → `V{n}` 마이그레이션 (docs/mail-templates/README.md).
 */
export type MailTemplateMeta = {
  /** 파일 이름(확장자 뺀 것) */
  key: string;
  name: string;
  subject: string;
  sample: Record<string, string>;
};

export const MAIL_TEMPLATES: MailTemplateMeta[] = [
  {
    key: 'user-registered-email',
    name: '회원가입 환영 (USER_REGISTERED)',
    subject: '[StudyClub] 회원가입을 환영합니다',
    sample: { nickname: '스터디메이트' },
  },
  {
    key: 'study-notice-email',
    name: '스터디 반 공지 (STUDY_NOTICE)',
    // studyTitle 은 서버가 25자로 잘라 넣는다 — 제목 전체가 40자를 넘지 않게 ([StudyClub] 12자 + 공지)
    subject: '[StudyClub] {{studyTitle}} 공지',
    sample: {
      studyTitle: 'DDIA 2판 읽기',
      groupName: '수요일반',
      senderName: '태윤',
      title: '이번 주 모임 장소가 바뀌었어요',
      body: '수요일 20:30 모임은 온라인으로 진행합니다.\n링크는 디스코드 로비 채널에 올려 둘게요.',
    },
  },
];
