// Generalized version of the wrapper both apps independently built this
// session for logging unhandled API route exceptions. DB-agnostic — takes
// a logger callback so each app supplies its own query() against its own
// Postgres database rather than this package owning a connection.
export interface ApiErrorLogEntry {
  method: string;
  path: string;
  status: number;
  errorMessage: string;
}

type Handler<Req, Ctx> = (req: Req, ctx?: Ctx) => Promise<Response>;

export function createApiErrorLogWrapper<Req extends { method: string; url: string }, Ctx = unknown>(
  logEntry: (entry: ApiErrorLogEntry) => Promise<void>,
) {
  return function withApiErrorLog(handler: Handler<Req, Ctx>): Handler<Req, Ctx> {
    return async (req, ctx) => {
      try {
        return await handler(req, ctx);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await logEntry({
          method: req.method,
          path: new URL(req.url).pathname,
          status: 500,
          errorMessage: message.slice(0, 2000),
        }).catch(() => {}); // logging failure must never mask the original error
        return Response.json({ error: 'Internal server error.' }, { status: 500 });
      }
    };
  };
}
