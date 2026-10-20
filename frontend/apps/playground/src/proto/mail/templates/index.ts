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
];
