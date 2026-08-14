#!/usr/bin/env bash
# Local HTTPS certs for docker-compose. Do not commit the generated files.
set -euo pipefail
cd "$(dirname "$0")"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/CN=localhost"
echo "Wrote server.key and server.crt (gitignored)."
