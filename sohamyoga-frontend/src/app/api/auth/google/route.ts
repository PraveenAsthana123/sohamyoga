import { NextResponse } from 'next/server';

// TODO: Replace with real Google OAuth credentials from environment variables:
//   GOOGLE_CLIENT_ID=your_client_id
//   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
//
// Full OAuth flow:
//   1. This route redirects the user to Google's consent screen.
//   2. Google redirects back to /api/auth/google/callback with ?code=...
//   3. The callback route exchanges the code for an access_token.
//   4. Use the access_token to fetch the user's Google profile.
//   5. Create/look up the local user account and issue a session cookie.

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? 'TODO_REPLACE_WITH_REAL_CLIENT_ID';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/auth/google/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;

  return NextResponse.redirect(googleAuthUrl, { status: 302 });
}
