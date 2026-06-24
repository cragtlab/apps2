$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$mergeScriptPath = Join-Path $repoRoot "merge.ps1"
$tmpDir = Join-Path $repoRoot "tmp"
$scriptName = [System.IO.Path]::GetFileNameWithoutExtension($MyInvocation.MyCommand.Path)
$csvFileName = "{0}.csv" -f $scriptName
$tmpCsvPath = Join-Path $tmpDir $csvFileName

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
$session.Cookies.Add((New-Object System.Net.Cookie("ASP.NET_SessionId", "0etslxtwy0ujqetv0n504hb4", "/", "www.unclaimedmonies.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("__RequestVerificationToken", "KdKpvC40Ugj0Y_yQUtqTLww3vGVGBjBs_KZWa_K8h0nhFeIPloUrNLzHdcpWjcqf2-BAxCD2RpL8PVXBW7sztlD_vBT3R6C7rT7Qk9paMNU1", "/", "www.unclaimedmonies.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_sp_ses.7dfa", "*", "/", ".unclaimedmonies.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_sp_id.7dfa", "938d3dea-41f1-4bef-868e-71d0f9fb2be5.1782285528.1.1782285694..96f0b6ba-bbb3-4bab-a1b4-adeaac38adee..26d6d046-7bd5-48ad-a7f0-d4c06d0a07c6.1782285527914.11", "/", ".unclaimedmonies.gov.sg")))

$headers = @{
    "authority"="www.unclaimedmonies.gov.sg"
    "accept"="*/*"
    "accept-language"="en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,ko;q=0.6"
    "dnt"="1"
    "origin"="https://www.unclaimedmonies.gov.sg"
    "priority"="u=1, i"
    "referer"="https://www.unclaimedmonies.gov.sg/Monies/MoniesList/73fa76c2-3cab-4523-be2d-b7c948c9b597"
    "sec-ch-ua"="`"Chromium`";v=`"148`", `"Google Chrome`";v=`"148`", `"Not/A)Brand`";v=`"99`""
    "sec-ch-ua-mobile"="?0"
    "sec-ch-ua-platform"="`"Windows`""
    "sec-fetch-dest"="empty"
    "sec-fetch-mode"="cors"
    "sec-fetch-site"="same-origin"
    "x-requested-with"="XMLHttpRequest"
}

$body = "sort=YearCollected-desc&page=1&pageSize=100&group=&filter=&id=73fa76c2-3cab-4523-be2d-b7c948c9b597&alphabetfilter=All&__RequestVerificationToken=bH0gsrKnLLGtVoweyDeA3vV1pGCaJr0qzPR4vuWLF7-U2kgBsQEnu-326PJJrqPlDP06_l247CBKuhVd98seCgU805wIZU7hEaaq1mNimVE1"

if (-not (Test-Path $tmpDir)) {
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
}

Write-Output "Scraping Unclaimed Monies..."

try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "https://www.unclaimedmonies.gov.sg/Monies/MoniesListJson" `
        -Method "POST" `
        -WebSession $session `
        -Headers $headers `
        -ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
        -Body $body

    $json = $response.Content | ConvertFrom-Json

    # Typically the list is in a property like 'Data' or 'items'
    # Based on Kendo UI (common for such sites), it might be 'Data'
    $items = if ($json.Data) { $json.Data } else { $json }

    if ($null -eq $items -or $items.Count -eq 0) {
        Write-Output "No data found. Check if session/tokens are expired."
        exit 1
    }

    $rows = @(foreach ($item in $items) {
        # Dynamically capture all properties from the JSON object
        $obj = [ordered]@{}
        foreach ($prop in $item.PSObject.Properties) {
            $obj[$prop.Name] = $prop.Value
        }
        [PSCustomObject]$obj
    })

    $rows | Export-Csv -Path $tmpCsvPath -NoTypeInformation -Encoding UTF8
    Write-Output "Scraped $($rows.Count) rows."

    if (Test-Path $mergeScriptPath) {
        & $mergeScriptPath -file $csvFileName
    }
}
catch {
    Write-Error "Failed to scrape: $_"
    exit 1
}
