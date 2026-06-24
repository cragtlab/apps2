
## 2. copy the session code in
## 3. put $data = 
## 4. ask chatgpt how to extract into csv

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
$session.Cookies.Add((New-Object System.Net.Cookie("shell#lang", "en", "/", "discover.nyc.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("sxa_site", "OMW", "/", "discover.nyc.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga", "GA1.1.165559589.1780101428", "/", ".nyc.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_sp_ses.0219", "*", "/", ".nyc.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_sp_id.0219", "fcb09ba9-9872-4c8f-8e63-c72e836a7823.1780101428.3.1780144112.1780103984.eb5da28e-947a-4505-9804-b61167a84cfd.97d67cf5-a2fb-448e-9261-45e9f6d5a493.dfe5b640-ec2e-4b72-94f7-3bd3ea4a8fa8.1780143236323.1", "/", ".nyc.gov.sg")))
$session.Cookies.Add((New-Object System.Net.Cookie("_ga_B8QTVF5W9L", "GS2.1.s1780143235`$o2`$g1`$t1780144112`$j59`$l0`$h1304105751", "/", ".nyc.gov.sg")))
$data = Invoke-WebRequest -UseBasicParsing -Uri "https://discover.nyc.gov.sg/omw/api/dayinthelife/getdayinthelifelisting" `
-Method "POST" `
-WebSession $session `
-Headers @{
"Accept"="*/*"
  "Accept-Encoding"="gzip, deflate"
  "Accept-Language"="en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,ko;q=0.6"
  "DNT"="1"
  "Origin"="https://discover.nyc.gov.sg"
  "Referer"="https://discover.nyc.gov.sg/omw/Day-in-the-Life"
  "Sec-Fetch-Dest"="empty"
  "Sec-Fetch-Mode"="cors"
  "Sec-Fetch-Site"="same-origin"
  "sec-ch-ua"="`"Chromium`";v=`"148`", `"Google Chrome`";v=`"148`", `"Not/A)Brand`";v=`"99`""
  "sec-ch-ua-mobile"="?1"
  "sec-ch-ua-platform"="`"iOS`""
} `
-ContentType "application/json" `
-Body "{`"Job`":`"`",`"Industry`":`"`",`"ItemPerPage`":9,`"CurrentPage`":1}"


### 1. put $data = at top 

$json = $data.Content | ConvertFrom-Json
$rows = $json.Items | ForEach-Object {
    [PSCustomObject]@{
        Id          = $_.Id
        Title       = $_.Title
        Url         = $_.Url
        Description = $_.Description
        Industries  = ($_.IndustryTags.Label -join ', ')
        Worlds      = ($_.WorldTags.Label -join ', ')
#        Image       = $_.Image
    }
}

# View result
$rows


# Export CSV
#$rows | Export-Csv ".\output.csv" -NoTypeInformation -Encoding UTF8
