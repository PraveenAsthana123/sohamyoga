// Real template interpolation for channels with no external renderer (Novu
// renders email/sms/whatsapp externally via mustache; Web Push has no such
// renderer, so this is the local equivalent). Matches the {{variable}}
// convention already referenced in NotificationDispatchJob.ts's header
// comment ("Novu ... does the mustache interpolation externally").
//
// Deliberately minimal: no conditionals/loops, just {{key}} -> string(value).
// An unresolved {{key}} (missing from payload) is left as-is rather than
// silently becoming an empty string or throwing, so a bad template is
// visibly wrong in the rendered output instead of failing the whole send.
export function renderTemplate(text: string, payload: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = payload[key];
    return value === undefined || value === null ? match : String(value);
  });
}
