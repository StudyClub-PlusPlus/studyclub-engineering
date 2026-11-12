import { useQuery } from '@tanstack/react-query';

import { joinedStudyIds, toJoinedStudy } from './mapper';
import { getMyStudies } from './repository';
import { studyKeys } from '@/features/studies/keys';

export const myStudyKeys = {
  // 계정을 키에 넣는다 — 같은 브라우저에서 다른 계정으로 다시 로그인해도 앞 사람의 목록이 보이지 않는다
  list: (accountId: number) => ['my-studies', accountId] as const,
};

export function useMyStudies(accountId: number | undefined) {
  return useQuery({
    queryKey: myStudyKeys.list(accountId ?? 0),
    queryFn: async () => {
      const res = await getMyStudies();
      return res.items.map(toJoinedStudy);
    },
    enabled: accountId !== undefined,
  });
}

/** 로그인 회원의 참여 명부. 서버가 relation·role을 판정한다. */
export function useJoinedStudyMemberships() {
  return useQuery({
    queryKey: studyKeys.joined(),
    queryFn: async () => {
      const response = await getMyStudies();
      return { ...response, ids: joinedStudyIds(response.items) };
    },
    retry: false,
  });
}
