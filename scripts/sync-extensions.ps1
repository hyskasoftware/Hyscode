#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Syncs workspace extension source files → ~/.hyscode/extensions/
  Run this after editing any extension in the extensions/ folder.
#>

$src   = Join-Path $PSScriptRoot "..\extensions"
$dest  = Join-Path $HOME ".hyscode\extensions"

if (-not (Test-Path $dest)) {
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

$count = 0
foreach ($extDir in Get-ChildItem $src -Directory) {
  $target = Join-Path $dest $extDir.Name
  if (Test-Path $target) {
    Copy-Item -Path (Join-Path $extDir.FullName "*") -Destination $target -Recurse -Force
    Write-Host "  ✓ $($extDir.Name)"
    $count++
  } else {
    Write-Host "  ⚠  $($extDir.Name) not installed — skipping (install first via the app)"
  }
}

Write-Host ""
Write-Host "Synced $count extension(s). Reload the app to pick up changes."
