import { createServer } from 'node:http';

const port = Number(process.env.APP_API_MOCK_PORT ?? '4702');
const catalogStudies = process.env.APP_API_MOCKING === 'enabled' ? [{
  studyId: 1, programId: 1, title: 'AI 논문 스터디', category: 'AI_ML', studyKind: 'STUDY',
  status: 'OPEN', recruitStatus: 'RECRUITING', recruitmentCapacity: 20, currentApplicants: 8,
  recruitmentStartAt: '2026-09-01T00:00:00Z', recruitDeadlineAt: null,
  startAt: '2026-10-05T00:00:00Z', timezone: 'KST', hasApplicationForm: true, authorNickname: '테스트캡틴',
}] : [];

createServer((request, response) => {
  if (request.method === 'GET' && request.url?.startsWith('/api/admin/studies?')) {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ items: catalogStudies, total: catalogStudies.length, offset: 0, limit: 100 }));
    return;
  }
  response.writeHead(404);
  response.end();
}).listen(port, '127.0.0.1');
