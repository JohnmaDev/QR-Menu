import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';

describe('Backend Foundation Tests', () => {
  it('GET /healthz returns status ok', async () => {
    const app = buildApp({ logger: false });
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.status).toBe('ok');
    expect(json).toHaveProperty('timestamp');
    expect(json).toHaveProperty('uptime');
    await app.close();
  });
});
