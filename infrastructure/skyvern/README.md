# Skyvern provisioning runtime

Skyvern is an assisted browser worker behind SohamYoga's provisioning state
machine. It may fill approved business fields and extract non-secret IDs, but
must stop for CAPTCHA, OTP/MFA, identity or business verification, legal terms,
OAuth consent, credential display, or any ambiguous irreversible action.

Run `./scripts/setup-skyvern-provisioning.sh`. The script uses the upstream
checkout at `vendor/skyvern` plus the repository-owned Compose override, then
writes the generated API key to OpenBao when the local vault is reachable.

Loopback endpoints:

- UI: `http://127.0.0.1:18080`
- API: `http://127.0.0.1:18000`
- Browser stream: `127.0.0.1:16080`

The upstream revision tested during initial integration was
`98dbe907fff1641b2020e6a7b1042a175e4711bc`.

