# Local Asterisk/PJSIP runtime

This is the open-source PBX test layer for Voice AI. It exposes SIP and a narrow RTP range on loopback only. It contains one generated-secret extension (`1001`) and local echo (`600`) / hello (`700`) tests. There is deliberately no PSTN carrier route.

Run `./setup.sh`, then inspect health with `docker compose ps` and `docker compose exec asterisk asterisk -rx "pjsip show endpoints"`. The generated `.env` is mode 600 and ignored by git.

To reach a real telephone network, an owner must configure a lawful carrier account, owned DID, TLS/SRTP as supported, webhook/origination worker, recording policy, consent and DNC controls. Store provider credentials in the secret manager and put only their key names in the portal.
