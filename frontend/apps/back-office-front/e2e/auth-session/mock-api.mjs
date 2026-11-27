import { createServer } from 'node:http';

const attempts = new Map();
const account = {
  id: 1,
  email: 'test@example.com',
  nickname: '테스트크루',
  picture: null,
  role: 'MEMBER',
  timeZone: 'Asia/Seoul',
  onboardingCompletedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  discordNickname: null,
};

createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin === 'http://localhost:4890' || origin === 'http://localhost:4891') {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'content-type, x-user-nickname');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  const send = (status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(data));
  };
  if (request.method === 'OPTIONS') return send(200, {});
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/health') return send(200, {});
  if (path === '/auth/refresh' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const { refreshToken } = JSON.parse(body);
    const count = attempts.get(refreshToken) ?? 0;
    attempts.set(refreshToken, count + 1);
    if (refreshToken === 'revoked') return send(401, { message: 'invalid refresh' });
    if (refreshToken.startsWith('retry-') && count === 0) return send(503, { message: 'temporarily unavailable' });
    return send(200, { accessToken: 'browser-test-access', accessTokenExpiresIn: 900 });
  }
  if (path === '/api/me/marketing-consent') return send(200, { agreed: false, agreedAt: null });
  if (path === '/api/me') return send(200, account);
  if (path === '/api/admin/studies') return send(200, { items: [], total: 0, offset: 0, limit: 100 });
  return send(404, { message: 'not found' });
}).listen(4892, '127.0.0.1');
