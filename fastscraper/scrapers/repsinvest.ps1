
## 2. copy the session code in
## 3. put $data = 
## 4. ask chatgpt how to extract into csv
$repoRoot = Split-Path -Path $PSScriptRoot -Parent
$csvFileName = "{0}.csv" -f [System.IO.Path]::GetFileNameWithoutExtension($MyInvocation.MyCommand.Name)
$tmpCsvPath = Join-Path $repoRoot (Join-Path "tmp" $csvFileName)
$mergeScriptPath = Join-Path $repoRoot "merge.ps1"


$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
$session.Cookies.Add((New-Object System.Net.Cookie("PHPSESSID", "f94b5b3a6b52cde560e87fa90b0877a1", "/", "repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("default", "60ceb8510f2b669c036fad144713f784", "/", "repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("language", "en-gb", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("currency", "SGD", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_gcl_au", "1.1.1911047881.1778412576", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_BS5KYNH2R9", "GS2.1.s1778412576`$o1`$g0`$t1778412576`$j60`$l0`$h0", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_gid", "GA1.3.707352765.1778412576", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_gat_gtag_UA_91183327_1", "1", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga", "GA1.1.631944621.1778412576", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_CHT568C714", "GS2.1.s1778412576`$o1`$g1`$t1778412576`$j60`$l0`$h0", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_fbp", "fb.2.1778412576643.147269498704558472", "/", ".repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("twk_idm_key", "JQGFeWP0EcrDUw8Aoc2zr", "/", "repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("TawkConnectionTime", "0", "/", "repsinvest.com.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("twk_uuid_5ac1bd1ed7591465c7091a95", "%7B%22uuid%22%3A%221.92RImMwuc8WFPnbqaSZL4XCts6AY2N6gPY7LTOzlGwavNIgY5SQd76wtm47urGHmWiJReWbpNxW70BvEEoWxd7VZqXDxPRHkz0PlkGVAUkfX9s9ut7Zr26A2wPfB%22%2C%22version%22%3A3%2C%22domain%22%3A%22repsinvest.com.sg%22%2C%22ts%22%3A1778412577885%7D", "/", ".repsinvest.com.sg")))
$data = Invoke-WebRequest -UseBasicParsing -Uri "https://repsinvest.com.sg/reps-list-2" `
-WebSession $session `
-Headers @{
"authority"="repsinvest.com.sg"
  "method"="GET"
  "path"="/reps-list-2"
  "scheme"="https"
  "accept"="text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
 # "accept-encoding"="gzip, deflate, br, zstd"
  "accept-language"="en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,ko;q=0.6"
  "dnt"="1"
  "priority"="u=0, i"
  "referer"="https://repsinvest.com.sg/reps-list-2"
  "sec-ch-ua"="`"Google Chrome`";v=`"147`", `"Not.A/Brand`";v=`"8`", `"Chromium`";v=`"147`""
  "sec-ch-ua-mobile"="?1"
  "sec-ch-ua-platform"="`"iOS`""
  "sec-fetch-dest"="document"
  "sec-fetch-mode"="navigate"
  "sec-fetch-site"="same-origin"
  "sec-fetch-user"="?1"
  "upgrade-insecure-requests"="1"
}
################## PUT $data at top and ASK CHATGPT TO WRITE CODE TO EXTRACT $data INTO CSV ##################

# Flatten items
#Write-Host $data.Content
# =========================
# LOAD HTML (from your request)
# =========================
$html = $data.Content
# Match all table rows
$all = [regex]::Matches($html, '<tr id="product-\d+">(.*?)</tr>', 'Singleline')

$rows = foreach ($row in $all) {

    $cells = [regex]::Matches($row.Groups[1].Value, '<td.*?>(.*?)</td>', 'Singleline') |
        ForEach-Object {
            # Remove HTML tags + cleanup
            ($_.Groups[1].Value -replace '<.*?>', '' -replace '&nbsp;', ' ').
                Trim()
        }

    # Skip invalid all
    if ($cells.Count -ge 9) {

        [PSCustomObject]@{
            Status           = $cells[0]
            ReferenceNo      = $cells[1]
            PlanType         = $cells[2]
            InitialSum       = $cells[3]
            MaturityYear     = $cells[5]   # Ignore Years to Maturity
            AnnualPremium    = $cells[6]
            MaturityValue    = $cells[7]
            AnnualReturnsPct = $cells[8]
        }
    }
}


# Export CSV
$rows | Export-Csv $tmpCsvPath -NoTypeInformation -Encoding UTF8
& $mergeScriptPath $csvFileName
