/**
 * 로그인 화면용 사용자 문구.
 * access_denied · Failed to fetch · NEXT_PUBLIC_* · 백엔드(api) 같은 원문은 노출하지 않는다.
 */

export function loginErrorFromOAuthPopup(errorCode: string): string {
  const code = errorCode.toLowerCase();
  if (code === 'access_denied' || code.includes('denied') || code.includes('cancel')) {
    return 'Google 로그인이 취소됐어요. 다시 로그인해 주세요.';
  }
  return 'Google 로그인을 완료하지 못했어요. 다시 로그인해 주세요.';
}

export function loginErrorFromExchange(status: number, body: unknown): string {
  const obj =
    body && typeof body === 'object'
      ? (body as { errorCode?: string; errorMessage?: string; message?: string })
      : {};
  const code = String(obj.errorCode ?? '').toUpperCase();
  const message = String(obj.errorMessage ?? obj.message ?? '').toLowerCase();

  if (code.includes('SOCIAL_LOGIN_EMAIL') || (message.includes('email') && message.includes('verif'))) {
    return '이메일 인증이 완료된 Google 계정으로 로그인해 주세요.';
  }
  if (
    code.includes('ACCOUNT_LINK_REQUIRED') ||
    message.includes('link_required') ||
    message.includes('같은 이메일')
  ) {
    return '이미 가입된 이메일이에요. 기존에 가입한 방법으로 로그인해 주세요.';
  }
  if (status === 409) {
    return '이미 가입된 이메일이에요. 기존에 가입한 방법으로 로그인해 주세요.';
  }
  if (status === 502 || status === 503 || status === 0) {
    return '로그인 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  if (status === 400 || status === 401) {
    return 'Google 로그인을 완료하지 못했어요. 다시 로그인해 주세요.';
  }
  return '로그인 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function loginErrorFromCaught(err: unknown): string {
  if (!(err instanceof Error)) {
    return '로그인 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  const msg = err.message.toLowerCase();
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('백엔드') ||
    msg.includes('next_public')
  ) {
    return '로그인 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  // exchange 에서 이미 사용자 문구를 넣어 던진 경우 그대로 쓴다.
  if (
    msg.includes('google') ||
    msg.includes('로그인') ||
    msg.includes('이메일') ||
    msg.includes('가입된')
  ) {
    return err.message;
  }
  return '로그인 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export const LOGIN_NOT_CONFIGURED_MESSAGE = '지금은 Google 로그인을 이용할 수 없어요.';
