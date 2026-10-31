'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { StudyCreateDialog } from '@/components/StudyCreateDialog';
import { nextCohortForm, type StudyFormValues } from '@/components/StudyForm';
import type { ApiStudyDetail, ApiStudyProgram } from '@/features/studies/types';
import { http } from '@/lib/http';

/**
 * 클럽 운영 화면 머리의 「다음 기수 만들기」 (playground 정보 탭 명세 1-2). 클럽에만 보인다 — 스터디는 기수가 1개다.
 *
 * 누르면 등록 팝업이 이 클럽으로 정해진 채 열린다. 지금 보는 기수가 최신이 아닐 수 있어, 클럽 목록에서
 * 최신 기수를 찾아 그 값으로 채운다. 최신 기수를 못 찾으면 지금 기수 값으로 연다.
 */
export function NextCohortButton({ detail }: { detail: ApiStudyDetail }) {
  const router = useRouter();
  const [form, setForm] = useState<StudyFormValues | null>(null);
  const [loading, setLoading] = useState(false);

  async function open() {
    if (loading) return;
    setLoading(true);
    let latest = detail;
    try {
      const { items } = await http<{ items: ApiStudyProgram[] }>('/api/admin/study-programs?studyKind=CLUB');
      const latestId = items.find((p) => p.programId === detail.programId)?.latestStudyId;
      if (latestId && latestId !== detail.id) latest = await http<ApiStudyDetail>(`/api/admin/studies/${latestId}`);
    } catch {
      // 최신 기수를 못 읽어도 지금 기수 값으로 시작한다 — 운영자가 고치면 된다
    } finally {
      setLoading(false);
    }
    setForm(nextCohortForm(latest));
  }

  return (
    <>
      <Button size='sm' variant='secondary' leadingIcon={<Plus size={14} />} loading={loading} onClick={() => void open()}>
        다음 기수 만들기
      </Button>
      {form && (
        <StudyCreateDialog
          open
          mode='next'
          title='다음 기수 만들기'
          initial={form}
          onClose={() => setForm(null)}
          onConfirmed={() => {
            // 새 기수는 비공개로 만들어진다 — 목록에서 찾아 들어간다
            router.push('/studies');
            router.refresh();
          }}
        />
      )}
    </>
  );
}
