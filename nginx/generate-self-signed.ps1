# Local HTTPS certs for docker-compose. Do not commit the generated files.
# Run from the nginx folder:  .\generate-self-signed.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout server.key `
  -out server.crt `
  -subj "/CN=localhost"
Write-Host "Wrote server.key and server.crt (gitignored)."
