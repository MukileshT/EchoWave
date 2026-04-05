$repo = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$iss = Join-Path $PSScriptRoot "EchoWave.iss"
$dist = Join-Path $repo "dist\echowave-Portable"
$exe = Join-Path $repo "echowave-launcher.exe"

if (-not (Test-Path $exe)) {
  Write-Error "Missing echowave-launcher.exe. Run npm run package:launcher first."
  exit 1
}

if (-not (Test-Path $dist)) {
  Write-Error "Missing dist/echowave-Portable. Run the portable bundle step first."
  exit 1
}

$possible = @(
  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
  "C:\Program Files\Inno Setup 6\ISCC.exe",
  "V:\runtimes\Inno Setup 6\ISCC.exe"
)

$ISCC = $possible | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $ISCC) {
  Write-Error "Inno Setup 6 not found. Install it, then re-run this script."
  exit 1
}

# Use a unique output folder to avoid file locks
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $PSScriptRoot ("Output-" + $timestamp)
New-Item -ItemType Directory -Path $outputDir | Out-Null
$outputBase = "echowave-Setup-" + $timestamp

& $ISCC $iss /DOutputDir="$outputDir" /DOutputBaseFilename="$outputBase"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Installer built. Look for echowave-Setup.exe in tools/installer or the script output folder."
