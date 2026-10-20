<#
.SYNOPSIS
  Lesemappe nach Cloudflare Pages (lesemappe.janemmel.de).

.DESCRIPTION
  Baut _site/ (Seiten, PDFs, Prüfung auf fehlende Dateien), richtet beim ersten Mal Pages-Projekt,
  Domain und DNS ein (tools/domain.mjs) und lädt _site/ hoch. Die Seite hat noindex.

  Das Cloudflare-Token kommt aus $env:CLOUDFLARE_API_TOKEN, sonst aus .env hier oder ../kita/.env
  (cloudflare_api_token=...). Es wird nie ausgegeben.

.EXAMPLE
  ./deploy.ps1 -DryRun      # bauen und zeigen, was hochginge
  ./deploy.ps1              # bauen, hochladen
#>
[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$Branch = 'main'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$site = Join-Path $root '_site'
$project = 'lesemappe-janemmel-de'
$accountId = '2b6304381678742e4b09808de636f58f'

node (Join-Path $root 'tools/build.mjs')
if ($LASTEXITCODE -ne 0) { throw "Build fehlgeschlagen ($LASTEXITCODE)" }

$files = @(Get-ChildItem -Path $site -Recurse -File)
$mb = [math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "Hochzuladen: $($files.Count) Dateien, $mb MB" -ForegroundColor Cyan
if ($DryRun) { Write-Host 'Probelauf, nichts hochgeladen.' -ForegroundColor Cyan; return }

# ── Zugang ──
$token = $env:CLOUDFLARE_API_TOKEN
if (-not $token) {
    $envFile = @((Join-Path $root '.env'), (Join-Path $root '../kita/.env')) |
        Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $envFile) { throw 'Keine .env gefunden (erwartet cloudflare_api_token=...)' }
    $token = (Get-Content $envFile |
        Where-Object { $_ -match '^\s*cloudflare_api_token\s*=' } |
        Select-Object -First 1) -replace '^\s*cloudflare_api_token\s*=\s*', '' -replace '^["'']|["'']$', ''
}
if (-not $token -or -not $token.Trim()) { throw 'cloudflare_api_token fehlt oder ist leer' }

$tokenWasSet = [bool]$env:CLOUDFLARE_API_TOKEN
$env:CLOUDFLARE_API_TOKEN = $token.Trim()
$env:CLOUDFLARE_ACCOUNT_ID = $accountId
Push-Location $root
try {
    node (Join-Path $root 'tools/domain.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Einrichtung von Projekt/Domain fehlgeschlagen ($LASTEXITCODE)" }
    npx --yes wrangler@4.139.0 pages deploy $site --project-name $project --branch $Branch --commit-dirty=true --commit-message "Lesemappe"
    if ($LASTEXITCODE -ne 0) { throw "wrangler endete mit $LASTEXITCODE" }
}
finally {
    Pop-Location
    if (-not $tokenWasSet) { $env:CLOUDFLARE_API_TOKEN = $null }
}
