import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react';

import type { ButtonSize, ButtonVariant } from './Button';
import { cx } from './cx';

/**
 * design-system.md §9-1 — 페이지를 옮기는 링크인데 Button 과 같은 모양이어야 하는 자리(「스터디 둘러보기」, 디스코드 · 자료실 열기).
 * 누르면 무언가를 하는 것은 Button, 다른 주소로 가는 것은 ButtonLink 다. 모양 · 크기 · 변형은 Button 과 같다(buttons.css 의 sc-button).
 * 'use client' 를 달지 않는다 — 서버 컴포넌트가 `linkAs={Link}`(함수)를 넘기려면 이 부품도 서버에서 그려져야 한다.
 */
export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** 새 탭으로 연다 — target=_blank 와 rel=noopener noreferrer 를 붙인다. 바깥 사이트(디스코드 · 드라이브 · 신청 폼)에 쓴다. */
  external?: boolean;
  /** 앱 안 이동은 next/link 를 넘긴다(`linkAs={Link}`). 기본은 a. */
  linkAs?: ElementType;
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  external = false,
  linkAs: LinkComponent = 'a',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <LinkComponent
      {...rest}
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      data-variant={variant}
      data-size={size}
      className={cx('sc-button', size === 'sm' ? 'type-label-sm' : 'type-label-lg', className)}
    >
      <span className='sc-button-content'>
        {leadingIcon && (
          <span className='sc-button-icon' aria-hidden='true'>
            {leadingIcon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span className='sc-button-icon' aria-hidden='true'>
            {trailingIcon}
          </span>
        )}
      </span>
    </LinkComponent>
  );
}
