$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$mergeScriptPath = Join-Path $repoRoot "merge.ps1"
$tmpDir = Join-Path $repoRoot "tmp"
$scriptName = [System.IO.Path]::GetFileNameWithoutExtension($MyInvocation.MyCommand.Path)
$csvFileName = "{0}.csv" -f $scriptName
$tmpCsvPath = Join-Path $tmpDir $csvFileName


$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
$session.Cookies.Add((New-Object System.Net.Cookie("ASP.NET_SessionId", "yxfgnrcs1xerfdpg33ghuekl", "/", "www.unclaimedmonies.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("__RequestVerificationToken", "RA-E1orQqfoXXHTpMXoSUqRb7pINtm2iPuKvxrNy9aKPQ50NfvZWukYIys0RFjd6jFnS-lRbVPQD6dz0N5-wC0WpVFxE-4BSaOVMSq43ZJA1", "/", "www.unclaimedmonies.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_sp_ses.7dfa", "*", "/", ".unclaimedmonies.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_sp_id.7dfa", "938d3dea-41f1-4bef-868e-71d0f9fb2be5.1782285528.6.1786839798.1786711720.219b4b1f-3b8f-428a-aeb8-4718b19bffaa.06c7dc0c-61f7-4357-8c8e-4f1b2e07c9d5.0795218e-fe88-4ae5-a648-0f0a798db23e.1786839571609.8", "/", ".unclaimedmonies.gov.sg")))
$response = Invoke-WebRequest -UseBasicParsing -Uri "https://www.unclaimedmonies.gov.sg/Monies/MoniesListJson" `
-Method "POST" `
-WebSession $session `
-Headers @{
"authority"="www.unclaimedmonies.gov.sg"
  "method"="POST"
  "path"="/Monies/MoniesListJson"
  "scheme"="https"
  "accept"="*/*"
  "accept-encoding"="gzip, deflate, br, zstd"
  "accept-language"="en-US,en;q=0.9"
  "dnt"="1"
  "origin"="https://www.unclaimedmonies.gov.sg"
  "priority"="u=1, i"
  "referer"="https://www.unclaimedmonies.gov.sg/Monies/MoniesList/9b74e09b-9b0c-4ed9-a5d3-a45327457e13"
  "sec-ch-ua"="`"Not=A?Brand`";v=`"99`", `"Google Chrome`";v=`"151`", `"Chromium`";v=`"151`""
  "sec-ch-ua-mobile"="?0"
  "sec-ch-ua-platform"="`"Windows`""
  "sec-fetch-dest"="empty"
  "sec-fetch-mode"="cors"
  "sec-fetch-site"="same-origin"
  "x-requested-with"="XMLHttpRequest"
} `
-ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
-Body "sort=YearCollected-desc&page=1&pageSize=20&group=&filter=&id=9b74e09b-9b0c-4ed9-a5d3-a45327457e13&alphabetfilter=&__RequestVerificationToken=R0_sZ1zC0t-9hUva3o0Jlco8B_gPxiHDPWqqy0HHmRlUwVF7a7U9MIXW2G89FGo3dweXYkMwknoqpPWmr_rbOHfOl7BMvepR-bo-wTnzm4c1"

if (-not (Test-Path $tmpDir)) {
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
}

Write-Output "Scraping Unclaimed Monies (unclaimed_gov)..."

try {
    $json = $response.Content | ConvertFrom-Json

    $items = if ($json.Data) { $json.Data } else { $json }

    if ($null -eq $items -or $items.Count -eq 0) {
        Write-Output "No data found. Check if session/tokens are expired."
        exit 1
    }

    $rows = @(foreach ($item in $items) {
        # Robust mapping to handle different potential JSON property names
        # We need: MoniesId, ClaimedName, LastKnownStreetAddress, CategoryName, YearCollected, AgencyName, CreatedDate, Remarks

        $obj = [ordered]@{}
        $obj["MoniesId"] = if ($item.MoniesId) { $item.MoniesId } else { $item.Id }
        $obj["ClaimedName"] = if ($item.ClaimedName) { $item.ClaimedName } else { $item.OwnerName }
        $obj["LastKnownStreetAddress"] = if ($item.LastKnownStreetAddress) { $item.LastKnownStreetAddress } else { $item.Address }
        $obj["CategoryName"] = if ($item.CategoryName) { $item.CategoryName } else { $item.Category }
        $obj["YearCollected"] = if ($item.YearCollected) { $item.YearCollected } else { $item.Year }
        $obj["AgencyName"] = if ($item.AgencyName) { $item.AgencyName } else { $item.SourceAgency }
        $obj["CreatedDate"] = if ($item.CreatedDate) { $item.CreatedDate } else { $item.DateAdded }

        # Capture government-provided remarks/descriptions
        $obj["Remarks"] = if ($null -ne $item.Remarks) { $item.Remarks } else { $item.Description }

        [PSCustomObject]$obj
    })

    $rows | Export-Csv -Path $tmpCsvPath -NoTypeInformation -Encoding UTF8
    Write-Output "Scraped $($rows.Count) rows."

    if (Test-Path $mergeScriptPath) {
        & $mergeScriptPath -file $csvFileName -target "unclaimed_monies.csv" -KeyColumns "MoniesId"
    }
}
catch {
    Write-Error "Failed to scrape: $_"
    exit 1
}
