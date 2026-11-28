import type { z } from 'zod';

import type {
  apiAdminRetrosSchema,
  apiRetroListSchema,
  apiRetroStatusSchema,
} from '@/features/meeting-retro/response-schema';

export type ApiRetroStatus = z.infer<typeof apiRetroStatusSchema>;
export type ApiRetroList = z.infer<typeof apiRetroListSchema>;
export type ApiAdminRetros = z.infer<typeof apiAdminRetrosSchema>;
export type ApiAdminRetro = ApiAdminRetros['items'][number];

export type RetroSectionKey = 'GOOD' | 'IMPROVE' | 'FEELING';
export type RetroSort = 'RECENT' | 'LIKES';

/** `GET /api/admin/retros` 의 조건 — 빈 값은 보내지 않는다. */
export type AdminRetrosQuery = {
  studyId?: number;
  /** studyId 가 있을 때만. */
  meetingId?: number;
  q?: string;
  /** 문항별 보기 — 그 문항을 쓴 회고만. */
  section?: RetroSectionKey;
  /** 표 보기의 보이는 문항. */
  sections?: RetroSectionKey[];
  sort: RetroSort;
  likeSort?: RetroSectionKey;
  likeDir?: 'DESC' | 'ASC';
  offset: number;
  limit: number;
};
