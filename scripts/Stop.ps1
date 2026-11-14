$ErrorActionPreference='Stop'
$gameRoot=Split-Path -Parent $PSScriptRoot
$recordFile=Join-Path $gameRoot '.runtime\server.json'
if (!(Test-Path -LiteralPath $recordFile)) { Write-Host 'Capybara server is not running.'; exit 0 }
$record=Get-Content -Raw -LiteralPath $recordFile | ConvertFrom-Json
if ($record.app -ne 'capybara-defense') { throw 'Invalid server record.' }
try {
  $health=Invoke-RestMethod -Uri 'http://127.0.0.1:4175/__capy_health__' -TimeoutSec 2
  if ($health.app -ne 'capybara-defense' -or $health.pid -ne $record.pid) { throw 'This port does not belong to this server. Nothing stopped.' }
  Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:4175/__capy_stop__' -Headers @{'X-Capy-Token'=$record.token} -TimeoutSec 3 | Out-Null
  Write-Host 'Capybara server stopped.'
} catch [System.Net.WebException] { Write-Host 'Capybara server is already stopped.' }
