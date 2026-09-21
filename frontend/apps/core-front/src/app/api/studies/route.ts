// 스터디 목록 검색 — 브라우저가 필터를 바꿀 때 부른다. 같은 출처로 받아 백엔드에 넘긴다(CORS 불필요).
import { NextResponse, type NextRequest } from 'next/server';

import { fetchStudies, type StudySearch } from '@/lib/api';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const search: StudySearch = {
    keyword: p.get('keyword') ?? undefined,
    status: (p.get('status') ?? undefined) as StudySearch['status'],
    timezone: (p.get('timezone') ?? undefined) as StudySearch['timezone'],
    category: p.get('category') ?? undefined,
    sort: (p.get('sort') ?? undefined) as StudySearch['sort'],
  };
  try {
    return NextResponse.json(await fetchStudies(search));
  } catch (e) {
    console.error('[api/studies]', e);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
