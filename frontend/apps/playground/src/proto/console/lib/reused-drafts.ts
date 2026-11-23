import type { Study } from '@studyclub/types';
import type { StudyFormValues } from '../components/StudyForm';

const key = 'playground.study-reuse.drafts.v1';

export function isReusedDraft(study: Study) {
  return study.id.startsWith('reused-draft-');
}

export function readReusedDrafts(): Study[] {
  return JSON.parse(sessionStorage.getItem(key) ?? '[]');
}

export function saveReusedDraft(form: StudyFormValues) {
  const drafts = readReusedDrafts();
  const number = Math.max(Date.now(), (drafts[0]?.study_id ?? 0) + 1);
  const localized = (value: string) => ({ ko: value, en: value });
  const title = localized(form.title);
  const draft: Study = {
    id: `reused-draft-${number}`,
    study_id: number,
    kind: 'study',
    format: 'online',
    program: { id: String(number), title, kind: 'study' },
    title,
    summary: localized(form.summary),
    description: localized(form.description),
    category: form.category,
    published: false,
    status: 'recruiting',
    recruitment: {
      status: 'closed',
      deadline: form.deadline,
      capacity: form.unlimited ? undefined : Number(form.capacity),
    },
    schedule: localized(form.schedule),
    startAt: form.startAt,
    recruitmentTimeZones: form.recruitmentTimeZones,
    image: form.thumbnail,
    discord_url: form.discordUrl,
    driveUrl: form.driveUrl,
    applicantCount: 0,
    stats: { participants: 0 },
  };
  sessionStorage.setItem(key, JSON.stringify([draft, ...drafts]));
}
