# Validates Accept: text/markdown content negotiation for a URL.
param(
  [string]$Url = "https://www.ravndalstudio.com/"
)

$ErrorActionPreference = "Stop"

$response = Invoke-WebRequest -Uri $Url -Headers @{ Accept = "text/markdown" } -UseBasicParsing
$contentType = $response.Headers["Content-Type"]

if (-not $contentType -or $contentType -notmatch "text/markdown") {
  Write-Error "Expected Content-Type text/markdown; got: $contentType"
}

$tokens = $response.Headers["x-markdown-tokens"]
Write-Host "OK: $Url returned $contentType"
if ($tokens) {
  Write-Host "x-markdown-tokens: $tokens"
}

if ($response.Content.Length -lt 20) {
  Write-Warning "Markdown body looks very short; check conversion."
}
