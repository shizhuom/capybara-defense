param([Parameter(Mandatory=$true)][string]$Name,[Parameter(Mandatory=$true)][string[]]$Files)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$gameRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$baseRoot = Join-Path $gameRoot '.runtime\m3-review-base'
$archive = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $gameRoot 'backups\m2-before-m3.zip'))
$sections = @("M3 review against m2-before-m3.zip; generated $(Get-Date -Format o)")
try {
  foreach ($relative in $Files) {
    $normalized = $relative.Replace('\','/')
    $baseFile = [System.IO.Path]::GetFullPath((Join-Path $baseRoot $relative))
    $currentFile = [System.IO.Path]::GetFullPath((Join-Path $gameRoot $relative))
    if (-not $baseFile.StartsWith($baseRoot + '\') -or -not $currentFile.StartsWith($gameRoot + '\')) { throw 'Review path escapes game directory' }
    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $baseFile)) | Out-Null
    $entry = $archive.GetEntry($normalized)
    if ($entry) {
      $reader = [System.IO.StreamReader]::new($entry.Open())
      try { $original = $reader.ReadToEnd() } finally { $reader.Dispose() }
    } else { $original = '' }
    [System.IO.File]::WriteAllText($baseFile,$original,[System.Text.UTF8Encoding]::new($false))
    $sections += (& git -c core.safecrlf=false diff --no-index --no-color --unified=20 -- $baseFile $currentFile 2>&1 | Out-String)
  }
} finally { $archive.Dispose() }
$output = Join-Path $gameRoot "verification\m3-review-$Name.diff"
[System.IO.File]::WriteAllText($output,($sections -join "`n"),[System.Text.UTF8Encoding]::new($false))
Write-Output $output
exit 0
