param([switch]$Preview)
$ErrorActionPreference = 'Stop'
$gameRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $gameRoot '.runtime'))
$runtimeBoundary = $runtimeRoot + [IO.Path]::DirectorySeparatorChar
$names = @('m3-review-base','m3-profile-switch-before','p1-review-baseline','p1-ui-before-fix','p1-review-pack.mjs','p1-sync-before-fix.mjs','p1-audio-manifest-before-fix.ts')
if (Test-Path -LiteralPath $runtimeRoot) {
  if ((Get-Item -LiteralPath $runtimeRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing a linked runtime directory.' }
}
$targets = @()
foreach ($name in $names) {
  $targetPath = [IO.Path]::GetFullPath((Join-Path $runtimeRoot $name))
  if (!$targetPath.StartsWith($runtimeBoundary,[StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup target is outside this game runtime.' }
  if (!(Test-Path -LiteralPath $targetPath)) { continue }
  $targetItem = Get-Item -LiteralPath $targetPath
  if ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing a linked cache: $name" }
  if ($targetItem.PSIsContainer) {
    $links = @(Get-ChildItem -LiteralPath $targetPath -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
    if ($links.Count -gt 0) { throw "Refusing a cache containing links: $name" }
  }
  $targets += $targetPath
}
foreach ($targetPath in $targets) {
  if ($Preview) { Write-Output "Would remove: $targetPath" }
  else { Remove-Item -LiteralPath $targetPath -Recurse -Force; Write-Output "Removed: $targetPath" }
}
Write-Output 'Only named verification copies were selected. Server records, browser data and backups are retained.'
