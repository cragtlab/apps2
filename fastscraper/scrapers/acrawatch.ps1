$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$driverPath = Join-Path $repoRoot "run-links.generic.ps1"

& $driverPath `
    -Url "https://acrawatch.sg/" `
    -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36" `
    -ScriptPath $PSCommandPath

exit $LASTEXITCODE
