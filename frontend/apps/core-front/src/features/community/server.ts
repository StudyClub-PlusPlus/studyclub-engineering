import { site as siteData } from '@studyclub/mock';
import { type Operator, type Site } from '@studyclub/types';

// TODO(api): GET /api/operators — 운영진 API 가 생기면 연동. 빈 목록이면 소개 페이지가 섹션을 숨긴다.
export async function getOperators(): Promise<Operator[]> {
  return [];
}

export async function getSite(): Promise<Site> {
  return siteData;
}

export async function getOperatorMap(): Promise<Record<string, Operator>> {
  const ops = await getOperators();
  return Object.fromEntries(ops.map((o) => [o.id, o]));
}
