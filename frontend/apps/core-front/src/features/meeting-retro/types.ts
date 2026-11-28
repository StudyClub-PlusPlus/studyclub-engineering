import type { z } from 'zod';

import type {
  apiRetroListSchema,
  apiRetroStatusSchema,
  apiRetroViewerSchema,
} from '@/features/meeting-retro/response-schema';

export type ApiRetroStatus = z.infer<typeof apiRetroStatusSchema>;
export type ApiRetroList = z.infer<typeof apiRetroListSchema>;
export type ApiRetroViewer = z.infer<typeof apiRetroViewerSchema>;

export type RetroSectionKey = 'GOOD' | 'IMPROVE' | 'FEELING';
export type RetroAnswers = { good: string; improve: string; feeling: string };
