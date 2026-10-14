import { createServer } from 'node:http';

const port = Number(process.env.APP_API_MOCK_PORT ?? '4702');

createServer((request, response) => {
  if (request.method === 'GET' && request.url?.startsWith('/api/admin/studies?')) {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ items: [], total: 0, offset: 0, limit: 1000 }));
    return;
  }
  response.writeHead(404);
  response.end();
}).listen(port, '127.0.0.1');
