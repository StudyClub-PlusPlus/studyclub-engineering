'use client';

import { useEffect, useMemo, useState } from 'react';

import { parseSheetRows, sheetValueHint, type PasteCell } from '@console/lib/club-sheet';
import { type ClubConfig, type ClubMember } from '@console/lib/clubs';
import { Button, Modal, Textarea } from '@studyclub/ui';

/**
 * 시트에서 붙여넣기 — 시트의 줄을 그대로 복사해 온다. 첫 칸은 디스코드 별명, 그 뒤는 1일부터 차례로 그 날의 값.
 * 빈 칸은 건드리지 않는다. 반영해도 저장 전이다 — 출석부에서 확인한 뒤 「저장」.
 */
export function ClubPasteDialog({
  open,
  club,
  days,
  members,
  onClose,
  onApply,
}: {
  open: boolean;
  club: ClubConfig;
  days: string[];
  members: ClubMember[];
  onClose: () => void;
  onApply: (cells: PasteCell[]) => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const result = useMemo(() => parseSheetRows(text, club, members, days), [text, club, members, days]);
  const valueHint = sheetValueHint(club);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title='시트에서 붙여넣기'
      size='lg'
      footer={
        <Button data-anno='clubbook:5-3' disabled={result.cells.length === 0} onClick={() => onApply(result.cells)}>
          {result.cells.length}칸 반영
        </Button>
      }
    >
      <div className='flex flex-col gap-4 py-2'>
        <Textarea
          data-anno='clubbook:5-1'
          label='시트에서 복사한 줄'
          helper={`첫 칸은 디스코드 별명, 그 뒤는 1일부터 차례로. 값: ${valueHint}. 빈 칸은 그대로 둡니다.`}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'새벽세시\tO\tO\tX\t휴\n모닝커피\tO\t\tO\tO'}
        />
        {text.trim() && (
          <div data-anno='clubbook:5-2' className='rounded-md bg-surface-1 px-4 py-3 type-body-sm'>
            <p className='text-fg'>
              {result.people}명 · {result.cells.length}칸을 반영합니다.
            </p>
            {result.unknownNames.length > 0 && (
              <p className='mt-1 text-error-700'>명단에 없는 이름: {result.unknownNames.join(', ')}</p>
            )}
            {result.badValues.length > 0 && (
              <p className='mt-1 text-error-700'>읽을 수 없는 값: {result.badValues.join(', ')}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
