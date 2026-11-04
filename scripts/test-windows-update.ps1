$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') { throw 'Use somente o runner Windows descartável.' }
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$base = Join-Path $env:RUNNER_TEMP 'Pulse-Analytics-Setup-0.3.0-x64.exe'
Invoke-WebRequest 'https://github.com/maumau1902-bit/app-mrj/raw/refs/heads/pulse-downloads/Pulse-Analytics-Setup-0.3.0-x64.exe' -OutFile $base
Invoke-WebRequest 'https://raw.githubusercontent.com/maumau1902-bit/app-mrj/pulse-downloads/pulse-0.3.0.json' -OutFile "$base.json"
node scripts/verify-signed-installer.cjs $base "$base.json"
if ($LASTEXITCODE -ne 0) { throw 'Pacote inicial não confere com a assinatura.' }
$installDir = Join-Path $env:RUNNER_TEMP ('pulse-update-' + [guid]::NewGuid().ToString('N'))
$exe = Join-Path $installDir 'Pulse Analytics.exe'
try {
 $p = Start-Process -FilePath $base -ArgumentList "/S /D=$installDir" -Wait -PassThru
 if ($p.ExitCode -ne 0) { throw 'Instalação inicial falhou.' }
 node scripts/test-live-update.cjs $exe update
 if ($LASTEXITCODE -ne 0) { throw 'Fluxo interno de atualização falhou.' }
 $deadline = (Get-Date).AddSeconds(120)
 $restarted = $false
 do {
  Start-Sleep -Milliseconds 500
  $running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -eq $exe } catch { $false } })
  if ((Test-Path $exe) -and ((Get-Item $exe).VersionInfo.ProductVersion -eq $version) -and $running.Count -gt 0) { $restarted = $true; break }
 } while ((Get-Date) -lt $deadline)
 if (!$restarted) { throw 'A versão nova não foi instalada/reaberta no prazo.' }
 $running | Stop-Process -Force
 Start-Sleep -Seconds 2
 node scripts/test-live-update.cjs $exe verify
 if ($LASTEXITCODE -ne 0) { throw 'Versão/cadastros não foram preservados.' }
 Write-Output "PASS: atualização real 0.3.0 -> $version, instalação, reinício e preservação das empresas."
 } catch {
 $detail = $_.Exception.Message
 if (Test-Path $exe) { $detail += ' ObservedVersion=' + (Get-Item $exe).VersionInfo.ProductVersion }
 $paths = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like '*Pulse*' } | ForEach-Object { try { $_.Path } catch {} })
 $detail += ' RunningPaths=' + ($paths -join ';') + ' ExpectedPath=' + $exe
 $detail = $detail.Replace('%','%25').Replace("`r",'%0D').Replace("`n",'%0A')
 Write-Output "::error title=Native update diagnostics::$detail"
 throw
} finally {
 Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -eq $exe } catch { $false } } | Stop-Process -Force
 $uninstall = Join-Path $installDir 'Uninstall Pulse Analytics.exe'
 if (Test-Path $uninstall) { Start-Process -FilePath $uninstall -ArgumentList '/S' -Wait }
}
