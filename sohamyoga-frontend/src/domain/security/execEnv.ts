import os from 'os';

// Scanner CLIs (trivy/checkov/semgrep) are installed via pipx/~/.local/bin,
// which a service-manager-launched Next.js process may not inherit in PATH
// even though an interactive shell does. Prepend it explicitly so scans work
// regardless of how this process was started.
export function scannerEnv(): NodeJS.ProcessEnv {
  const localBin = `${os.homedir()}/.local/bin`;
  return { ...process.env, PATH: `${localBin}:${process.env.PATH ?? ''}` };
}
