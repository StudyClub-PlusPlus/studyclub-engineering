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
 *
 * 「문의·오류 신고」는 예외다. 프로필 드롭다운에 있던 것을 **이리로 옮겼다** — 눌러야 나오는
 * 자리라 할 말이 생긴 사람이 찾지 못했다. 사람이 내려다보는 곳은 화면 맨 아래다.
 */
export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className='mt-20 border-t border-(--color-border)'>
      <div className='mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between'>
        <p className='type-label-sm text-(--color-fg-faint)'>
          © {new Date().getFullYear()} StudyClub · preview · dummy data
        </p>

        <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
          {/* 쓰는 창이 바로 열린다. 로그인하지 않았으면 로그인으로 보낸다 */}
          <Link
            href={`/proto/core/${locale}/my/feedbacks?write=1`}
            data-anno='feedback:1'
            className='type-label-sm text-(--color-fg-muted) hover:text-(--color-fg)'
          >
            {m('nav.feedback', locale)}
          </Link>

          {/* data-anno 를 직접 달지 않는다 — 푸터는 모든 화면에 뜨므로 약관과 무관한 화면마다
              설명 없는 배지가 하나씩 붙는다. 약관·방침 화면의 spec 이 이 표식을 selector 로 가리킨다. */}
          <div data-legal-links className='flex flex-wrap gap-x-5 gap-y-2 type-label-sm text-(--color-fg-faint)'>
            <Link href={`/proto/core/${locale}/terms`} className='hover:text-(--color-fg-muted)'>
              {m('nav.terms', locale)}
            </Link>
            <Link href={`/proto/core/${locale}/privacy`} className='font-semibold hover:text-(--color-fg-muted)'>
              {m('nav.privacy', locale)}
            </Link>
            {/* 가입하다 막힌 사람을 위한 운영 메일 — 링크·폼이 아니라 글자만 (문의·오류 신고는 로그인해야 쓴다) */}
            <span className='select-all'>contact@studyclub.life</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
