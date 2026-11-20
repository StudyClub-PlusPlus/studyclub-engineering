import { studies } from '@studyclub/mock';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudyInfoCard } from './StudyInfoCard';

vi.mock('@/features/schedule/queries', () => ({ useStudyMeetings: () => ({ data: undefined }) }));

const group = { id: '10', name: '수요일반', timeZone: 'Asia/Seoul', startAt: '20:30' };
function setup(discordChannelUrl: string | null, driveUrlOverride: string | null) {
  return render(
    <StudyInfoCard
      study={{ ...studies[0], id: '20' }}
      group={group}
      groupId={10}
      canEdit={false}
      onDirty={vi.fn()}
      discordChannelUrl={discordChannelUrl}
      driveUrlOverride={driveUrlOverride}
    />,
  );
}
afterEach(cleanup);

describe('StudyInfoCard links', () => {
  it('says links are coming instead of hiding the row when none are set', () => {
    setup('', '');
    expect(screen.queryByRole('link', { name: /디스코드|자료실/ })).toBeNull();
    expect(screen.getByText('디스코드 · 자료실 링크는 아직 준비 중이에요')).toBeInTheDocument();
  });

  it('names only the missing link', () => {
    setup('https://discord.com/channels/1/2', '');
    expect(screen.getByRole('link', { name: /디스코드/ })).toBeInTheDocument();
    expect(screen.getByText('자료실 링크는 아직 준비 중이에요')).toBeInTheDocument();
  });

  it('shows no notice when both links exist', () => {
    setup('https://discord.com/channels/1/2', 'https://drive.google.com/x');
    expect(screen.queryByText(/준비 중이에요/)).toBeNull();
  });
});
