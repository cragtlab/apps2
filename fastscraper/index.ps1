Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$scrapersDir = Join-Path $repoRoot "scrapers"
$dataDir = Join-Path $repoRoot "data"
$unreadDir = Join-Path $repoRoot "unread"
$tmpDir = Join-Path $repoRoot "tmp"
$historyPath = Join-Path $tmpDir "scraper-runs.json"
$powershellExe = (Get-Process -Id $PID).Path

if (-not (Test-Path $tmpDir)) {
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
}

if (-not (Test-Path $unreadDir)) {
    New-Item -ItemType Directory -Path $unreadDir | Out-Null
}

function Read-RunHistory {
    if (-not (Test-Path $historyPath)) {
        return @{}
    }

    $raw = Get-Content -Path $historyPath -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @{}
    }

    $parsed = $raw | ConvertFrom-Json
    $table = @{}

    foreach ($item in $parsed.PSObject.Properties) {
        $table[$item.Name] = $item.Value
    }

    return $table
}

function Write-RunHistory {
    param(
        [hashtable]$History
    )

    $keys = @($History.Keys | Sort-Object)

    if ($keys.Count -eq 0) {
        Set-Content -Path $historyPath -Value "{}" -Encoding UTF8
        return
    }

    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add("{")

    for ($i = 0; $i -lt $keys.Count; $i++) {
        $key = [string]$keys[$i]
        $entry = $History[$key]
        $lastStatusJson = [string]$entry.LastStatus | ConvertTo-Json -Compress
        $lastRunJson = [string]$entry.LastRun | ConvertTo-Json -Compress
        $entryJson = "{{`"LastStatus`":{0},`"LastRun`":{1}}}" -f $lastStatusJson, $lastRunJson
        $keyJson = $key | ConvertTo-Json -Compress
        $suffix = if ($i -lt ($keys.Count - 1)) { "," } else { "" }
        [void]$lines.Add(("  {0}: {1}{2}" -f $keyJson, $entryJson, $suffix))
    }

    [void]$lines.Add("}")
    Set-Content -Path $historyPath -Value $lines -Encoding UTF8
}

function Get-LastRunDate {
    param(
        $Entry
    )

    if ($null -eq $Entry -or [string]::IsNullOrWhiteSpace($Entry.LastRun)) {
        return $null
    }

    return [datetime]::Parse($Entry.LastRun)
}

function Get-TmpCsvRowCount {
    param(
        [string]$ScriptName
    )

    $csvName = "{0}.csv" -f [System.IO.Path]::GetFileNameWithoutExtension($ScriptName)
    $tmpCsvPath = Join-Path $tmpDir $csvName

    if (-not (Test-Path $tmpCsvPath)) {
        return 0
    }

    try {
        return @(Import-Csv -Path $tmpCsvPath).Count
    }
    catch {
        return 0
    }
}

function Can-RunToday {
    param(
        $Entry
    )

    $lastRun = Get-LastRunDate $Entry
    if ($null -eq $lastRun) {
        return $true
    }

    return $lastRun.Date -lt (Get-Date).Date
}

function Get-DataFileInfo {
    param(
        [string]$ScriptName
    )

    $csvName = "{0}.csv" -f [System.IO.Path]::GetFileNameWithoutExtension($ScriptName)
    $csvPath = Join-Path $dataDir $csvName

    if (-not (Test-Path $csvPath)) {
        return @{
            RowCount = "Missing"
            CsvPath = $csvPath
        }
    }

    try {
        $rowCount = @(Import-Csv -Path $csvPath).Count
    }
    catch {
        $rowCount = "Error"
    }

    return @{
        RowCount = [string]$rowCount
        CsvPath = $csvPath
    }
}

function Get-UnreadFileInfo {
    param(
        [string]$ScriptName
    )

    $csvName = "{0}.csv" -f [System.IO.Path]::GetFileNameWithoutExtension($ScriptName)
    $csvPath = Join-Path $unreadDir $csvName

    if (-not (Test-Path $csvPath)) {
        return @{
            RowCount = "0"
            CsvPath = $csvPath
        }
    }

    try {
        $rowCount = @(Import-Csv -Path $csvPath).Count
    }
    catch {
        $rowCount = "Error"
    }

    return @{
        RowCount = [string]$rowCount
        CsvPath = $csvPath
    }
}

function Get-ScriptRows {
    param(
        [hashtable]$History
    )

    foreach ($file in Get-ChildItem -Path $scrapersDir -Filter *.ps1 -File | Sort-Object Name) {
        $entry = $History[$file.Name]
        $lastRun = Get-LastRunDate $entry
        $canRun = Can-RunToday $entry
        $status = if ($entry -and $entry.LastStatus) { [string]$entry.LastStatus } else { "Never run" }
        $dataFileInfo = Get-DataFileInfo -ScriptName $file.Name
        $unreadFileInfo = Get-UnreadFileInfo -ScriptName $file.Name

        [PSCustomObject]@{
            ScriptName = $file.Name
            LastRun = if ($lastRun) { $lastRun.ToString("yyyy-MM-dd HH:mm:ss") } else { "Never" }
            Status = $status
            CanRunToday = if ($canRun) { "Yes" } else { "No" }
            DataRows = $dataFileInfo.RowCount
            UnreadRows = $unreadFileInfo.RowCount
            FullPath = $file.FullName
            CsvPath = $dataFileInfo.CsvPath
            UnreadPath = $unreadFileInfo.CsvPath
        }
    }
}

function Refresh-Grid {
    $script:runHistory = Read-RunHistory
    $rows = @(Get-ScriptRows -History $script:runHistory | Sort-Object `
        @{ Expression = {
            $unreadCount = 0
            if ([int]::TryParse([string]$_.UnreadRows, [ref]$unreadCount)) {
                return $unreadCount
            }

            return 0
        }; Descending = $true },
        @{ Expression = { $_.ScriptName }; Ascending = $true })
    $table.Rows.Clear()

    foreach ($row in $rows) {
        [void]$table.Rows.Add($row.ScriptName, $row.LastRun, $row.Status, $row.CanRunToday, $row.DataRows, $row.UnreadRows, $row.FullPath, $row.CsvPath, $row.UnreadPath)
    }
}

function Append-Log {
    param(
        [string]$Message
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logBox.AppendText("[$timestamp] $Message`r`n")
}

function Invoke-Scraper {
    param(
        [string]$ScriptName,
        [string]$ScriptPath,
        [switch]$Silent
    )

    $entry = $script:runHistory[$ScriptName]
    if (-not (Can-RunToday $entry)) {
        $lastRun = Get-LastRunDate $entry
        if (-not $Silent) {
            [System.Windows.Forms.MessageBox]::Show(
                "$ScriptName already ran on $($lastRun.ToString('yyyy-MM-dd')).",
                "Already ran today",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            ) | Out-Null
        }
        return
    }

    Append-Log "Running $ScriptName"

    $csvName = "{0}.csv" -f [System.IO.Path]::GetFileNameWithoutExtension($ScriptName)
    $tmpCsvPath = Join-Path $tmpDir $csvName
    if (Test-Path $tmpCsvPath) {
        Remove-Item -LiteralPath $tmpCsvPath -Force
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $powershellExe
    $psi.WorkingDirectory = $repoRoot
    $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($stdout.Trim()) {
        Append-Log $stdout.Trim()
    }

    if ($stderr.Trim()) {
        Append-Log $stderr.Trim()
    }

    $tmpRowCount = Get-TmpCsvRowCount -ScriptName $ScriptName
    $status = if ($process.ExitCode -eq 0) {
        if ($tmpRowCount -gt 0) { "Success ($tmpRowCount rows)" } else { "No data returned" }
    } else {
        "Failed ($($process.ExitCode))"
    }

    $script:runHistory[$ScriptName] = @{
        LastRun = (Get-Date).ToString("o")
        LastStatus = $status
    }
    Write-RunHistory -History $script:runHistory

    Append-Log "$ScriptName finished: $status"
    Refresh-Grid
}

function Run-EligibleScrapers {
    $rows = @(Get-ScriptRows -History $script:runHistory | Where-Object { $_.CanRunToday -eq "Yes" })

    if ($rows.Count -eq 0) {
        Append-Log "No eligible scripts to run at this check"
        return
    }

    foreach ($row in $rows) {
        Invoke-Scraper -ScriptName $row.ScriptName -ScriptPath $row.FullPath -Silent
    }
}

function Update-SchedulerButton {
    if ($script:schedulerEnabled) {
        $runDailyButton.Text = "Stop Run Daily"
    }
    else {
        $runDailyButton.Text = "Start Run Daily"
    }
}

function View-Unread {
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "Select a script first.",
            "No selection",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    $row = $table.SelectedRows[0]
    $unreadPath = [string]$row.Cells[8].Value

    if (-not (Test-Path $unreadPath)) {
        [System.Windows.Forms.MessageBox]::Show(
            "There are no unread rows for this script.",
            "No unread file",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    Start-Process -FilePath $unreadPath
    Append-Log "Opened unread file for $([string]$row.Cells[0].Value)"
}

function Remove-SelectedScraper {
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "Select a script first.",
            "No selection",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    $row = $table.SelectedRows[0]
    $scriptName = [string]$row.Cells[0].Value
    $scriptPath = [string]$row.Cells[6].Value
    $csvName = "{0}.csv" -f [System.IO.Path]::GetFileNameWithoutExtension($scriptName)
    $dataPath = Join-Path $dataDir $csvName
    $unreadPath = Join-Path $unreadDir $csvName
    $tmpPath = Join-Path $tmpDir $csvName

    $result = [System.Windows.Forms.MessageBox]::Show(
        "Delete scraper '$scriptName' and its data, unread, and tmp files?",
        "Delete scraper",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )

    if ($result -ne [System.Windows.Forms.DialogResult]::Yes) {
        return
    }

    foreach ($path in @($scriptPath, $dataPath, $unreadPath, $tmpPath)) {
        if (Test-Path $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    if ($script:runHistory.ContainsKey($scriptName)) {
        $script:runHistory.Remove($scriptName)
    }

    Write-RunHistory -History $script:runHistory

    Refresh-Grid
    Append-Log "Deleted scraper $scriptName"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Daily Scraper Runner - Dbl-Click for Unread"
$form.StartPosition = "CenterScreen"
$form.Size = New-Object System.Drawing.Size(950, 560)

$table = New-Object System.Windows.Forms.DataGridView
$table.Location = New-Object System.Drawing.Point(12, 12)
$table.Size = New-Object System.Drawing.Size(910, 320)
$table.ReadOnly = $true
$table.AllowUserToAddRows = $false
$table.AllowUserToDeleteRows = $false
$table.SelectionMode = [System.Windows.Forms.DataGridViewSelectionMode]::FullRowSelect
$table.MultiSelect = $false
$table.AutoSizeColumnsMode = [System.Windows.Forms.DataGridViewAutoSizeColumnsMode]::Fill
$table.RowHeadersVisible = $false
$table.ColumnCount = 9
$table.Columns[0].Name = "Script"
$table.Columns[1].Name = "Last Run"
$table.Columns[2].Name = "Status"
$table.Columns[3].Name = "Can Run Today"
$table.Columns[4].Name = "Data Rows"
$table.Columns[5].Name = "Unread Rows"
$table.Columns[6].Name = "Full Path"
$table.Columns[6].Visible = $false
$table.Columns[7].Name = "CSV Path"
$table.Columns[7].Visible = $false
$table.Columns[8].Name = "Unread Path"
$table.Columns[8].Visible = $false
$table.Columns[5].DefaultCellStyle.Alignment = [System.Windows.Forms.DataGridViewContentAlignment]::MiddleCenter

$runSelectedButton = New-Object System.Windows.Forms.Button
$runSelectedButton.Text = "Run Selected"
$runSelectedButton.Location = New-Object System.Drawing.Point(12, 345)
$runSelectedButton.Size = New-Object System.Drawing.Size(110, 32)

$runDailyButton = New-Object System.Windows.Forms.Button
$runDailyButton.Text = "Start Run Daily"
$runDailyButton.Location = New-Object System.Drawing.Point(252, 345)
$runDailyButton.Size = New-Object System.Drawing.Size(110, 32)

$refreshButton = New-Object System.Windows.Forms.Button
$refreshButton.Text = "Refresh"
$refreshButton.Location = New-Object System.Drawing.Point(372, 345)
$refreshButton.Size = New-Object System.Drawing.Size(110, 32)

$openDataButton = New-Object System.Windows.Forms.Button
$openDataButton.Text = "Open Data File"
$openDataButton.Location = New-Object System.Drawing.Point(492, 345)
$openDataButton.Size = New-Object System.Drawing.Size(110, 32)

$viewUnreadButton = New-Object System.Windows.Forms.Button
$viewUnreadButton.Text = "View Unread"
$viewUnreadButton.Location = New-Object System.Drawing.Point(612, 345)
$viewUnreadButton.Size = New-Object System.Drawing.Size(110, 32)

$clearUnreadButton = New-Object System.Windows.Forms.Button
$clearUnreadButton.Text = "Clear Unread"
$clearUnreadButton.Location = New-Object System.Drawing.Point(732, 345)
$clearUnreadButton.Size = New-Object System.Drawing.Size(110, 32)

$deleteScraperButton = New-Object System.Windows.Forms.Button
$deleteScraperButton.Text = "Delete Scraper"
$deleteScraperButton.Location = New-Object System.Drawing.Point(132, 345)
$deleteScraperButton.Size = New-Object System.Drawing.Size(110, 32)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object System.Drawing.Point(12, 390)
$logBox.Size = New-Object System.Drawing.Size(910, 120)
$logBox.Multiline = $true
$logBox.ScrollBars = "Vertical"
$logBox.ReadOnly = $true

$schedulerTimer = New-Object System.Windows.Forms.Timer
$schedulerTimer.Interval = 3600000

$runSelectedButton.Add_Click({
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "Select a script first.",
            "No selection",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    $row = $table.SelectedRows[0]
    Invoke-Scraper -ScriptName ([string]$row.Cells[0].Value) -ScriptPath ([string]$row.Cells[6].Value)
})

$runDailyButton.Add_Click({
    $script:schedulerEnabled = -not $script:schedulerEnabled
    Update-SchedulerButton

    if ($script:schedulerEnabled) {
        $schedulerTimer.Start()
        Append-Log "Daily scheduler started. Checking every hour."
        Run-EligibleScrapers
    }
    else {
        $schedulerTimer.Stop()
        Append-Log "Daily scheduler stopped."
    }
})

$schedulerTimer.Add_Tick({
    Append-Log "Hourly daily check started"
    Refresh-Grid
    Run-EligibleScrapers
})

$refreshButton.Add_Click({
    Refresh-Grid
    Append-Log "Refreshed script list"
})

$openDataButton.Add_Click({
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "Select a script first.",
            "No selection",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    $row = $table.SelectedRows[0]
    $csvPath = [string]$row.Cells[7].Value

    if (-not (Test-Path $csvPath)) {
        [System.Windows.Forms.MessageBox]::Show(
            "The data file does not exist yet.",
            "Missing data file",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    Start-Process -FilePath $csvPath
    Append-Log "Opened data file for $([string]$row.Cells[0].Value)"
})

$viewUnreadButton.Add_Click({
    View-Unread
})

$clearUnreadButton.Add_Click({
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            "Select a script first.",
            "No selection",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    $row = $table.SelectedRows[0]
    $scriptName = [string]$row.Cells[0].Value
    $unreadPath = [string]$row.Cells[8].Value

    if (-not (Test-Path $unreadPath)) {
        [System.Windows.Forms.MessageBox]::Show(
            "There are no unread rows to clear.",
            "No unread file",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        return
    }

    $result = [System.Windows.Forms.MessageBox]::Show(
        "Delete unread rows for $($scriptName)?",
        "Clear unread",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($result -ne [System.Windows.Forms.DialogResult]::Yes) {
        return
    }

    Remove-Item -LiteralPath $unreadPath -Force
    Refresh-Grid
    Append-Log "Cleared unread rows for $scriptName"
})

$deleteScraperButton.Add_Click({
    Remove-SelectedScraper
})

$table.Add_CellDoubleClick({
    if ($_.RowIndex -lt 0) {
        return
    }

    $row = $table.Rows[$_.RowIndex]
    View-Unread
    #Invoke-Scraper -ScriptName ([string]$row.Cells[0].Value) -ScriptPath ([string]$row.Cells[6].Value)
})

$table.Add_CellFormatting({
    param($sender, $e)

    if ($e.RowIndex -lt 0 -or $e.ColumnIndex -ne 5) {
        return
    }

    $cell = $sender.Rows[$e.RowIndex].Cells[$e.ColumnIndex]
    $valueText = [string]$cell.Value
    $unreadCount = 0
    $hasUnread = [int]::TryParse($valueText, [ref]$unreadCount) -and $unreadCount -gt 0

    if ($hasUnread) {
        $cell.Style.BackColor = [System.Drawing.Color]::LightGoldenrodYellow
        $cell.Style.ForeColor = [System.Drawing.Color]::DarkRed
        $cell.Style.SelectionBackColor = [System.Drawing.Color]::Goldenrod
        $cell.Style.SelectionForeColor = [System.Drawing.Color]::White
    }
    else {
        $cell.Style.BackColor = $sender.DefaultCellStyle.BackColor
        $cell.Style.ForeColor = $sender.DefaultCellStyle.ForeColor
        $cell.Style.SelectionBackColor = $sender.DefaultCellStyle.SelectionBackColor
        $cell.Style.SelectionForeColor = $sender.DefaultCellStyle.SelectionForeColor
    }
})

$form.Controls.Add($table)
$form.Controls.Add($runSelectedButton)
$form.Controls.Add($runDailyButton)
$form.Controls.Add($refreshButton)
$form.Controls.Add($openDataButton)
$form.Controls.Add($viewUnreadButton)
$form.Controls.Add($clearUnreadButton)
$form.Controls.Add($deleteScraperButton)
$form.Controls.Add($logBox)

$script:runHistory = @{}
$script:schedulerEnabled = $false
Refresh-Grid
Update-SchedulerButton
Append-Log "Loaded scraper runner"

[void]$form.Add_FormClosing({
    $schedulerTimer.Stop()
    $schedulerTimer.Dispose()
})

[void]$form.ShowDialog()
