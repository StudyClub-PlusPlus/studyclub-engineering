import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { ApplicationFormEditor } from './ApplicationFormEditor';

afterEach(cleanup);
it.each(['질문 1 수정', '질문 1 아래로', '질문 2 위로', '설문지 제목·설명 수정'])(
  '%s 클릭은 저장하지 않는다',
  async (name) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ApplicationFormEditor
        initialValues={{
          title: '제목',
          description: '',
          questions: [
            { id: 'a', label: '첫 질문', type: 'text', required: false },
            { id: 'b', label: '둘째 질문', type: 'text', required: false },
          ],
        }}
        title='제목'
        summary=''
        readOnly={false}
        saving={false}
        saved={false}
        onSave={onSave}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name }));
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  },
);

it('선택지와 기타 삭제는 저장을 누를 때까지 서버에 반영하지 않는다', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <ApplicationFormEditor
      initialValues={{
        title: '제목',
        description: '',
        questions: [
          { id: 'a', label: '선호 시간', type: 'radio', required: false, options: ['오전', '오후'], allowOther: true },
        ],
      }}
      title='제목'
      summary=''
      readOnly={false}
      saving={false}
      saved={false}
      onSave={onSave}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '질문 1 수정' }));
  await userEvent.click(screen.getByRole('button', { name: '오전 삭제' }));
  await userEvent.click(screen.getByRole('button', { name: '기타 삭제' }));
  expect(onSave).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].questions[0]).toMatchObject({ options: ['오후'], allowOther: false });
});

it('지원자 폼에 붙는 기본 문항인 참여 가능한 요일을 고칠 수 없게 보여 준다', () => {
  render(
    <ApplicationFormEditor
      initialValues={{ title: '제목', description: '', questions: [] }}
      title='제목'
      summary=''
      readOnly={false}
      saving={false}
      saved={false}
      onSave={vi.fn()}
    />,
  );
  expect(screen.getByText('참여 가능한 요일')).toBeTruthy();
  for (const day of ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']) {
    expect(screen.getByRole('checkbox', { name: day })).toHaveProperty('disabled', true);
  }
});
