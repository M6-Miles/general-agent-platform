import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '15s',
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'] },
};

export default function () {
  const base = __ENV.BASE_URL || 'http://localhost:8000';
  check(http.get(`${base}/health`), { 'health is 200': (r) => r.status === 200 });
  check(http.get(`${base}/ready`), { 'ready is 200': (r) => r.status === 200 });
  sleep(1);
}
