# Starts AuraTrack Hub when you log in (a scheduled task), and restarts it if it stops. Run once, in PowerShell, next to hub.mjs.
# Needs Node 24 or newer (https://nodejs.org).
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hub = if ($env:HUB_FILE) { $env:HUB_FILE } else { Join-Path $dir 'hub.mjs' }
if (-not (Test-Path $hub)) { throw "Cannot find hub.mjs at $hub. Build it first: pnpm build" }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node 24 or newer is needed (https://nodejs.org)' }
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$hub`"" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'AuraTrack Hub' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'AuraTrack Hub'
Write-Host 'AuraTrack Hub is running. Status page: http://localhost:8420/status'
