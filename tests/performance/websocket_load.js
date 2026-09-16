import ws from 'k6/ws';
import { check } from 'k6';

export const options = { thresholds: { checks: ['rate>0.99'], ws_connecting: ['p(95)<1000'] } };
const base = __ENV.WS_URL || 'ws://localhost:8000/ws';
export default function () {
  const response = ws.connect(base, {}, (socket) => {
    socket.setTimeout(() => socket.close(), 1000);
  });
  check(response, { 'websocket handshake succeeds': (r) => r && r.status === 101 });
}
