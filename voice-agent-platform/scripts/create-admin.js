#!/usr/bin/env node
// Creates (or updates the password of) an admin_user row so the admin UI
// has a real login. No extra dependency: parses .env itself and uses the
// same scrypt hashing the app uses at src/lib/auth.ts (duplicated here
// deliberately — this script must run standalone via plain `node`, without
// pulling in Next.js's module resolution).
//
// Usage:
//   node scripts/create-admin.js <email> <password> ["Display Name"]
// Or set BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD in .env and run
// with no arguments.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function main() {
  loadEnvFile();

  const email = process.argv[2] || process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.argv[3] || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.argv[4] || 'Admin';

  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password> ["Display Name"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (checked process.env and .env).');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const passwordHash = hashPassword(password);
    const result = await client.query(
      `INSERT INTO admin_user (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()
       RETURNING id, email, display_name, created_at`,
      [email.toLowerCase().trim(), passwordHash, displayName]
    );
    console.log('Admin user ready:', result.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
