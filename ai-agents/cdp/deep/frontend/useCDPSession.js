// useCDPSession — open WebSocket to backend WebLLM bridge.
//
// Per §91.

import { useEffect, useState } from 'react';

export function useCDPSession(backendUrl) {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = backendUrl.replace(/^http/, 'ws') + '/api/v1/webllm-agent/ws';
    const sock = new WebSocket(wsUrl);
    sock.onopen = () => setConnected(true);
    sock.onclose = () => setConnected(false);
    setWs(sock);
    return () => sock.close();
  }, [backendUrl]);

  const runAgent = async (goal, url) => {
    const resp = await fetch(`${backendUrl}/api/v1/webllm-agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, url }),
    });
    return resp.json();
  };

  return { ws, connected, runAgent };
}

export default useCDPSession;
