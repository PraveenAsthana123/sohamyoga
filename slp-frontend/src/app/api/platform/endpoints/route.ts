export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function port(name: string, fallback: string) {
  const value = process.env[name] || fallback;
  return /^\d{4,5}$/.test(value) ? value : fallback;
}

export async function GET() {
  const host = '127.0.0.1';
  return Response.json({
    portal: `http://${host}:${port('SOHAM_FRONTEND_PORT', '8085')}`,
    backend: `http://${host}:${port('SOHAM_BACKEND_PORT', '15070')}`,
    paperclip: `http://${host}:${port('SOHAM_PAPERCLIP_PORT', '3200')}`,
    openclaw: `http://${host}:${port('SOHAM_OPENCLAW_PORT', '18889')}`,
    ollamaDirector: `http://${host}:${port('SOHAM_OLLAMA_GATEWAY_PORT', '8091')}`,
  });
}
