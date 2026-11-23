import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { getQueryClient } from '@/lib/query-client';

function Tab({ queryFn }: { queryFn: () => Promise<string> }) {
  const { data } = useQuery({ queryKey: ['tab-data'], queryFn });
  return <p>{data}</p>;
}

it('탭을 옮겼다 돌아오면(다시 마운트) 데이터를 다시 불러온다', async () => {
  const queryFn = vi.fn().mockResolvedValueOnce('처음').mockResolvedValueOnce('다시');
  const tree = () => (
    <QueryClientProvider client={getQueryClient()}>
      <Tab queryFn={queryFn} />
    </QueryClientProvider>
  );

  const first = render(tree());
  await screen.findByText('처음');
  first.unmount();

  render(tree());
  await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  await screen.findByText('다시');
});
