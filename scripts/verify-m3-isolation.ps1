$ErrorActionPreference = 'Stop'
$gameRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $gameRoot '../..'))
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $gameRoot 'verification/m3-protected-before.json') | ConvertFrom-Json
$protectedPaths = @{}
$changed = @()
$missing = @()
foreach ($entry in $manifest) {
  $protectedPaths[$entry.path] = $true
  $target = Join-Path $repoRoot $entry.path
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { $missing += $entry.path; continue }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash -ne $entry.sha256) { $changed += $entry.path }
}
$trackedDiff = @(& git -C $repoRoot -c "safe.directory=$($repoRoot.Replace('\','/'))" diff --name-only HEAD --)
if ($LASTEXITCODE -ne 0) { throw 'Unable to check tracked baseline diff' }
$otherFiles = @(& git -C $repoRoot -c "safe.directory=$($repoRoot.Replace('\','/'))" ls-files --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Unable to check untracked files' }
$unexpected = @($otherFiles | Where-Object { -not $_.StartsWith('games/capybara-defense/') -and -not $protectedPaths.ContainsKey($_) })
$outsideTracked = @($trackedDiff | Where-Object { -not $_.StartsWith('games/capybara-defense/') })
$result = [ordered]@{
  checkedAt = (Get-Date -Format o)
  protectedFileCount = @($manifest).Count
  changedProtectedFiles = $changed
  missingProtectedFiles = $missing
  changedTrackedOutsideGame = $outsideTracked
  unexpectedUntrackedOutsideGame = $unexpected
  passed = ($changed.Count -eq 0 -and $missing.Count -eq 0 -and $outsideTracked.Count -eq 0 -and $unexpected.Count -eq 0)
}
$output = Join-Path $gameRoot 'verification/m3-isolation.json'
[System.IO.File]::WriteAllText($output,($result | ConvertTo-Json -Depth 5),[System.Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 5
if (-not $result.passed) { exit 1 }
