param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [hashtable]$Headers,
    [string]$UserAgent,
    [object[]]$Cookies,
    [string]$ScriptPath
)

$repoRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$mergeScriptPath = Join-Path $repoRoot "merge.ps1"

function Resolve-CallerScriptName {
    param(
        [string]$ExplicitScriptPath
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitScriptPath)) {
        return [System.IO.Path]::GetFileNameWithoutExtension($ExplicitScriptPath)
    }

    $currentPath = $MyInvocation.MyCommand.Path
    $callStack = @(Get-PSCallStack | Where-Object {
        -not [string]::IsNullOrWhiteSpace($_.ScriptName) -and $_.ScriptName -ne $currentPath
    })

    if ($callStack.Count -gt 0) {
        return [System.IO.Path]::GetFileNameWithoutExtension($callStack[0].ScriptName)
    }

    throw "Could not determine the caller script name. Pass -ScriptPath `$PSCommandPath."
}

$scriptName = Resolve-CallerScriptName -ExplicitScriptPath $ScriptPath
$csvFileName = "{0}.csv" -f $scriptName
$tmpCsvPath = Join-Path $repoRoot (Join-Path "tmp" $csvFileName)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

if (-not [string]::IsNullOrWhiteSpace($UserAgent)) {
    $session.UserAgent = $UserAgent
}

foreach ($cookie in @($Cookies)) {
    $session.Cookies.Add(
        (New-Object System.Net.Cookie(
            [string]$cookie.Name,
            [string]$cookie.Value,
            [string]$cookie.Path,
            [string]$cookie.Domain
        ))
    )
}

$invokeParams = @{
    UseBasicParsing = $true
    Uri = $Url
    WebSession = $session
}

if ($Headers) {
    $invokeParams.Headers = $Headers
}

$data = Invoke-WebRequest @invokeParams
$html = $data.Content
$responseUri = if ($data.BaseResponse -and $data.BaseResponse.ResponseUri) {
    $data.BaseResponse.ResponseUri
}
else {
    [uri]$Url
}
$baseUrl = "$($responseUri.Scheme)://$($responseUri.Authority)"
$pattern = '<a\s+[^>]*href\s*=\s*"([^"]+)"[^>]*>(.*?)</a>'
$matches = [regex]::Matches(
    $html,
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase `
    -bor [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$seen = @{}
$rows = foreach ($match in $matches) {
    $link = $match.Groups[1].Value.Trim()

    if ([string]::IsNullOrWhiteSpace($link) -or $link -eq "#") {
        continue
    }

    if ($link -notmatch "^https?://") {
        if ($link.StartsWith("/")) {
            $link = $baseUrl.TrimEnd("/") + $link
        }
        else {
            $link = $baseUrl.TrimEnd("/") + "/" + $link
        }
    }

    if ($seen.ContainsKey($link)) {
        continue
    }

    $seen[$link] = $true

    [PSCustomObject]@{
        Link = $link
        Title = (
            $match.Groups[2].Value `
            -replace "<.*?>", "" `
            -replace "&[#\w]+;", " " `
            -replace "\s+", " "
        ).Trim()
    }
}

$rows | Export-Csv $tmpCsvPath -NoTypeInformation -Encoding UTF8
& $mergeScriptPath $csvFileName
