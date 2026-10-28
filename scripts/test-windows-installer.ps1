$ErrorActionPreference = 'Stop'
# This script deliberately installs/uninstalls only on a disposable GitHub-hosted runner.
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') {
  throw 'Execute somente em runner Windows hospedado e descartável do GitHub Actions.'
}
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installer = (Resolve-Path "release/Pulse-Analytics-Setup-$version-x64.exe").Path
if ($env:PULSE_PUBLISHER_NAME) {
  $signature = Get-AuthenticodeSignature -LiteralPath $installer
  if ($signature.Status -ne 'Valid') { throw 'Assinatura Authenticode inválida.' }
  $publisher = $signature.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
  if ($publisher -ne $env:PULSE_PUBLISHER_NAME) { throw 'Editor da assinatura não corresponde ao configurado.' }
}
$installDir = Join-Path $env:RUNNER_TEMP ('pulse-install-' + [guid]::NewGuid().ToString('N'))
$installedExe = Join-Path $installDir 'Pulse Analytics.exe'
try {
  # NSIS requires /D to be the last argument, without quotes around its path.
  $process = Start-Process -FilePath $installer -ArgumentList "/S /D=$installDir" -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Instalador terminou com código $($process.ExitCode)." }
  if (!(Test-Path -LiteralPath $installedExe) -or !(Test-Path -LiteralPath (Join-Path $installDir 'resources/app.asar'))) { throw 'Instalação incompleta.' }
  node scripts/test-desktop.cjs $installedExe
  if ($LASTEXITCODE -ne 0) { throw 'Validação do aplicativo instalado falhou.' }
} finally {
  $uninstaller = Join-Path $installDir 'Uninstall Pulse Analytics.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Desinstalador terminou com código $($process.ExitCode)." }
    $deadline = (Get-Date).AddSeconds(30)
    while ((Test-Path -LiteralPath $installedExe) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
    if (Test-Path -LiteralPath $installedExe) { throw 'Executável permaneceu após desinstalação.' }
  }
}
Write-Output 'PASS: instalação silenciosa, inicialização, interface e desinstalação no Windows.'
