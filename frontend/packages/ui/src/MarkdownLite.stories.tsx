import type { Meta, StoryObj } from '@storybook/react';

import { MarkdownLite } from './MarkdownLite';

const meta = {
  title: 'UI/MarkdownLite',
  component: MarkdownLite,
  tags: ['autodocs'],
  args: {
    text: '',
  },
  decorators: [
    (Story) => (
      <div className='w-[480px] text-sm leading-relaxed text-fg'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkdownLite>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Headings: Story = {
  name: '제목 (#~###)',
  render: () => <MarkdownLite text={`# H1 제목\n## H2 소제목\n### H3 항목`} />,
};

export const Inline: Story = {
  name: '인라인 — 굵게 · 기울임 · 취소선 · 코드',
  render: () => (
    <MarkdownLite text='**굵게** / *기울임* / ~~취소선~~ / `인라인 코드`' />
  ),
};

export const Lists: Story = {
  name: '목록 — 순서·비순서',
  render: () => (
    <MarkdownLite
      text={`비순서 목록:\n- 항목 A\n- 항목 B\n- 항목 C\n\n순서 목록:\n1. 첫 번째\n2. 두 번째\n3. 세 번째`}
    />
  ),
};

export const CodeBlock: Story = {
  name: '코드 블록',
  render: () => (
    <MarkdownLite text={'```\nconst hello = "world";\nconsole.log(hello);\n```'} />
  ),
};

export const Link: Story = {
  name: '링크',
  render: () => (
    <MarkdownLite text='[StudyClub++ 바로가기](https://studyclub-plusplus.com) 에서 확인하세요.' />
  ),
};

export const Full: Story = {
  name: '전체 — 신청 폼 설명 예시',
  render: () => (
    <MarkdownLite
      className='flex flex-col gap-2'
      text={`## 신청 전 꼭 읽어주세요

**참여 조건**을 확인해 주세요.

- 주 1회 이상 세션 참석 가능한 분
- 과제 제출 의지가 있는 분
- ~~영어 회화 필수~~ (선택 사항으로 변경)

### 일정

1. 오리엔테이션: 킥오프 미팅
2. 본 세션: 매주 목요일 20:00 KST
3. 마무리: 회고 및 결과물 발표

\`\`\`
시간대: KST (UTC+9)
플랫폼: Discord
\`\`\`

자세한 내용은 [노션 페이지](https://notion.so)를 참고해 주세요.`}
    />
  ),
};
