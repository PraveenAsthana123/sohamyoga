import http from 'node:http';
import fs from 'node:fs';

const listenHost = process.env.OLLAMA_BRIDGE_HOST || '0.0.0.0';
const listenPort = Number(process.env.OLLAMA_BRIDGE_PORT || 11435);
const listenSocket = process.env.OLLAMA_LISTEN_SOCKET || '';
const targetHost = process.env.OLLAMA_TARGET_HOST || '127.0.0.1';
const targetPort = Number(process.env.OLLAMA_TARGET_PORT || 11434);
const targetSocket = process.env.OLLAMA_TARGET_SOCKET || '';

const server = http.createServer((request, response) => {
  const upstream = http.request({
    ...(targetSocket ? { socketPath: targetSocket } : { host: targetHost, port: targetPort }),
    method: request.method,
    path: request.url,
    headers: { ...request.headers, host: process.env.OLLAMA_UPSTREAM_HOST || `${targetHost}:${targetPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on('error', (error) => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: `Ollama bridge unavailable: ${error.message}` }));
  });
  request.pipe(upstream);
});

if (listenSocket) {
  try { fs.unlinkSync(listenSocket); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  server.listen(listenSocket, () => {
    fs.chmodSync(listenSocket, 0o666);
    process.stdout.write(`Ollama host bridge listening on ${listenSocket}\n`);
  });
} else {
  server.listen(listenPort, listenHost, () => {
    process.stdout.write(`Ollama Docker bridge listening on http://${listenHost}:${listenPort}\n`);
  });
}

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
