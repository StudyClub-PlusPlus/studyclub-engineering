import Link from 'next/link';

import type { Locale } from '@core/lib/content';
import { m } from '@core/lib/i18n';

/**
 * 푸터.
 *
 * 상단 내비게이션과 같은 링크를 되풀이하지 않는다 — 스터디·행사·가이드·공지·소개·디스코드·멘토링은
 * 전부 위에 있다. 같은 것을 두 번 두면 아래로 내려온 사람이 "여기 뭔가 다른 게 있나" 하고
 * 다시 훑게 되고, 정작 푸터에만 있는 약관·방침이 그 사이에 묻힌다.
 *
 * 그래서 푸터에는 **여기에만 있는 것**만 남긴다.
 */
export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className='mt-20 border-t border-(--color-border)'>
      <div className='mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between'>
        <p className='text-xs text-(--color-fg-faint)'>
          © {new Date().getFullYear()} StudyClub++ · preview · dummy data
        </p>

        {/* data-anno 를 직접 달지 않는다 — 푸터는 모든 화면에 뜨므로 약관과 무관한 화면마다
            설명 없는 배지가 하나씩 붙는다. 약관·방침 화면의 spec 이 이 표식을 selector 로 가리킨다. */}
        <div data-legal-links className='flex flex-wrap gap-x-5 gap-y-2 text-xs text-(--color-fg-faint)'>
          <Link href={`/proto/core/${locale}/terms`} className='hover:text-(--color-fg-muted)'>
            {m('nav.terms', locale)}
          </Link>
          <Link href={`/proto/core/${locale}/privacy`} className='font-semibold hover:text-(--color-fg-muted)'>
            {m('nav.privacy', locale)}
          </Link>
        </div>
      </div>
    </footer>
  );
}
