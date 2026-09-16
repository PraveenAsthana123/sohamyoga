import { NextResponse } from 'next/server';

// TODO: Replace with real GitHub OAuth credentials from environment variables:
//   GITHUB_CLIENT_ID=your_client_id
//   GITHUB_REDIRECT_URI=https://yourdomain.com/api/auth/github/callback
//
// Full OAuth flow:
//   1. This route redirects the user to GitHub's authorization page.
//   2. GitHub redirects back to /api/auth/github/callback with ?code=...
//   3. The callback route POSTs to https://github.com/login/oauth/access_token
//      with client_id, client_secret, and code to get an access_token.
//   4. Use the access_token to fetch the user profile from https://api.github.com/user.
//   5. Create/look up the local user account and issue a session cookie.

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID ?? 'TODO_REPLACE_WITH_REAL_CLIENT_ID';
  const redirectUri = process.env.GITHUB_REDIRECT_URI ?? 'http://localhost:3000/api/auth/github/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
  });

  const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return NextResponse.redirect(githubAuthUrl, { status: 302 });
}
