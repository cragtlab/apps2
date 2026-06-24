
## 2. copy the session code in
## 3. put $data = 
## 4. ask chatgpt how to extract into csv
$scriptDir = $PSScriptRoot

if (Test-Path (Join-Path $scriptDir "merge.ps1")) {
    $repoRoot = $scriptDir
}
elseif (Test-Path (Join-Path (Split-Path -Path $scriptDir -Parent) "merge.ps1")) {
    $repoRoot = Split-Path -Path $scriptDir -Parent
}
else {
    throw "Could not locate merge.ps1 from $scriptDir"
}

$csvFileName = "{0}.csv" -f [System.IO.Path]::GetFileNameWithoutExtension($MyInvocation.MyCommand.Name)
$tmpCsvPath = Join-Path $repoRoot (Join-Path "tmp" $csvFileName)
$mergeScriptPath = Join-Path $repoRoot "merge.ps1"




############## COPY SESSION CODE BELOW ##############
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
$data = Invoke-WebRequest -UseBasicParsing -Uri "https://www.reactor.school/news-events" `
-WebSession $session `
-Headers @{
"authority"="www.reactor.school"
  "method"="GET"
  "path"="/news-events"
  "scheme"="https"
  "accept"="text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
  "accept-encoding"="gzip, deflate, br, zstd"
}
################## PUT $data at top and ASK CHATGPT TO WRITE CODE TO EXTRACT $data INTO CSV ##################


# Flatten items
$html = $data.Content 
#Write-Host $html

# Extract all links + titles
# Auto base URL

# Auto base URL
$uri = $data.BaseResponse.ResponseUri
$start = "$($uri.Scheme)://$($uri.Host)"

$pattern = '<a\s+[^>]*href\s*=\s*"([^"]+)"[^>]*>(.*?)</a>'

$matches = [regex]::Matches(
    $html,
    $pattern,
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase `
    -bor [System.Text.RegularExpressions.RegexOptions]::Singleline
)

# Track duplicates
$seen = @{}

$rows = foreach ($m in $matches) {

    $link = $m.Groups[1].Value.Trim()

    # Ignore empty / anchors
    if ([string]::IsNullOrWhiteSpace($link) -or $link -eq '#') {
        continue
    }

    # Convert relative -> absolute
    if ($link -notmatch '^https?://') {

        if ($link.StartsWith('/')) {
            $link = $start.TrimEnd('/') + $link
        }
        else {
            $link = $start.TrimEnd('/') + '/' + $link
        }
    }

    # Skip duplicates
    if ($seen.ContainsKey($link)) {
        continue
    }

    $seen[$link] = $true

    [PSCustomObject]@{
        Link  = $link
        Title = (
            $m.Groups[2].Value `
            -replace '<.*?>', '' `
            -replace '&[#\w]+;', ' ' `
            -replace '\s+', ' '
        ).Trim()
    }
}


$rows

$rows | Export-Csv $tmpCsvPath -NoTypeInformation -Encoding UTF8
& $mergeScriptPath $csvFileName
