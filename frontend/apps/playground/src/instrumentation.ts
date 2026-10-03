export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
    const { setupServer } = await import('msw/node');
    setupServer().listen({ onUnhandledRequest: 'bypass' });
  }
}
