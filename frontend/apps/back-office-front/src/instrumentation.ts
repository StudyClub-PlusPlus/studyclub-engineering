export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
    const { setupServer } = await import('msw/node');
    const { handlers } = await import('@studyclub/mock/msw/handlers');
    setupServer(...handlers).listen({ onUnhandledRequest: 'bypass' });
  }
}
