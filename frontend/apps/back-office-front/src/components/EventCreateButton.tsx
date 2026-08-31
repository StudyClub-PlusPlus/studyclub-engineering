'use client';

import { useEffect, useState } from 'react';

import { Button } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { EventDialog } from '@/components/EventDialog';

/** 행사 등록 버튼 + 팝업. 스터디 등록 버튼과 같은 방식(`?new=1` 로도 열린다). */
export function EventCreateButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setOpen(true);
  }, []);

  return (
    <>
      <Button size='sm' leadingIcon={<Plus size={15} />} onClick={() => setOpen(true)}>
        행사 등록
      </Button>
      <EventDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
