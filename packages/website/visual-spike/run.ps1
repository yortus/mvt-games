# Spike runner: one visual run, refusing to start if the account's failed-logon count is high, and reporting it after.
param([string]$Mode = 'compare', [string]$Label = 'local', [int]$Workers = 1, [string]$Include = '', [switch]$Isolate, [string[]]$VitestArgs = @())
$u = [ADSI]"WinNT://$env:COMPUTERNAME/$env:USERNAME,user"
$before = $u.BadPasswordAttempts
if ($before -ge 4) { throw "Failed logons at $before; waiting for the lockout window before launching a browser" }
$env:SPIKE_MODE = $Mode; $env:SPIKE_LABEL = $Label; $env:SPIKE_WORKERS = "$Workers"
$env:SPIKE_ISOLATE = if ($Isolate) { '1' } else { '0' }
if ($Include) { $env:SPIKE_INCLUDE = $Include } else { Remove-Item Env:SPIKE_INCLUDE -ErrorAction SilentlyContinue }
$env:VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true'
Push-Location (Join-Path $PSScriptRoot '..\..\..')
$sw = [Diagnostics.Stopwatch]::StartNew()
npx vitest run --config packages/website/visual-spike/vitest.config.ts @VitestArgs 2>&1 | ForEach-Object { "$_" } | Where-Object { $_ -notmatch 'vitest:mocks|applyToEnvironment|RemoteException|^\s*$' }
$sw.Stop()
Pop-Location
$u = [ADSI]"WinNT://$env:COMPUTERNAME/$env:USERNAME,user"
"WALL=$([math]::Round($sw.Elapsed.TotalSeconds, 2))s LOGONS before=$before after=$($u.BadPasswordAttempts)"
