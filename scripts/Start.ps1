$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $gameRoot
function Open-CapybaraBrowser {
  try { Start-Process 'http://127.0.0.1:4175/' }
  catch { Write-Host 'Server is ready. Open http://127.0.0.1:4175/ in your browser.' }
}
try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4175/__capy_health__' -TimeoutSec 2
  if ($health.app -eq 'capybara-defense') { Open-CapybaraBrowser; exit 0 }
  throw 'Port 4175 is already in use by another application.'
} catch [System.Net.WebException] { }
if (!(Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js 22.12+ is required.' }
if (!(Test-Path -LiteralPath 'node_modules\vite\package.json')) {
  & npm.cmd ci --offline --ignore-scripts
  if ($LASTEXITCODE -ne 0) { & npm.cmd ci --ignore-scripts }
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed. See the errors above.' }
$runtimeDir = Join-Path $gameRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$serverFile = Join-Path $PSScriptRoot 'server.mjs'
Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('"' + $serverFile + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.log') -RedirectStandardError (Join-Path $runtimeDir 'server-error.log')
$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 200
  try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:4175/__capy_health__' -TimeoutSec 1; if ($health.app -eq 'capybara-defense') { $ready=$true; break } } catch { }
}
if (!$ready) { throw 'Server did not start. Check .runtime\server-error.log. Port 4175 may be occupied.' }
Open-CapybaraBrowser
