Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName Microsoft.VisualBasic

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $PSScriptRoot "data"
$scrapersDir = Join-Path $PSScriptRoot "scrapers"
$powershellExe = (Get-Process -Id $PID).Path
$dataFile = Join-Path $dataDir "unclaimed_monies.csv"

$statuses = @("New", "Trying", "Failed to Find", "Pending Reply", "Done")

function Refresh-Grid {
    if (-not (Test-Path $dataFile)) {
        $table.DataSource = $null
        return
    }

    $data = @(Import-Csv $dataFile)
    $dt = New-Object System.Data.DataTable

    if ($data.Count -gt 0) {
        $first = $data[0]
        # Establish preferred order: Status, MyRemarks, then the rest
        $preferred = @("Status", "MyRemarks")
        foreach ($p in $preferred) {
            if (-not $dt.Columns.Contains($p)) { [void]$dt.Columns.Add($p) }
        }
        foreach ($prop in $first.PSObject.Properties) {
            if (-not $dt.Columns.Contains($prop.Name)) {
                [void]$dt.Columns.Add($prop.Name)
            }
        }

        foreach ($row in $data) {
            $dr = $dt.NewRow()
            foreach ($prop in $row.PSObject.Properties) {
                $dr[$prop.Name] = $row.$($prop.Name)
            }
            [void]$dt.Rows.Add($dr)
        }
    }

    $table.DataSource = $dt

    # Ensure Status column is a ComboBox
    if ($dt.Columns.Contains("Status")) {
        $colIndex = -1
        for ($i=0; $i -lt $table.Columns.Count; $i++) {
            if ($table.Columns[$i].DataPropertyName -eq "Status") {
                $colIndex = $i
                break
            }
        }

        if ($colIndex -ge 0 -and $table.Columns[$colIndex].GetType().Name -ne "DataGridViewComboBoxColumn") {
            $newCol = New-Object System.Windows.Forms.DataGridViewComboBoxColumn
            $newCol.HeaderText = "Status"
            $newCol.DataPropertyName = "Status"
            $newCol.DataSource = $statuses
            $newCol.Name = "Status"
            $newCol.DisplayStyle = [System.Windows.Forms.DataGridViewComboBoxDisplayStyle]::Nothing

            $table.Columns.RemoveAt($colIndex)
            $table.Columns.Insert($colIndex, $newCol)
        }
    }
}

function Save-Changes {
    if ($table.DataSource -eq $null) { return }

    $dt = $table.DataSource
    $rows = New-Object System.Collections.Generic.List[PSCustomObject]

    foreach ($dr in $dt.Rows) {
        $obj = [ordered]@{}
        foreach ($col in $dt.Columns) {
            $obj[$col.ColumnName] = $dr[$col.ColumnName]
        }
        $rows.Add([PSCustomObject]$obj)
    }

    $rows | Export-Csv -Path $dataFile -NoTypeInformation -Encoding UTF8
}

function Run-Scrapers {
    $scrapers = Get-ChildItem -Path $scrapersDir -Filter *.ps1 -File

    if ($scrapers.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show("No scraper scripts found in $scrapersDir", "Error") | Out-Null
        return
    }

    foreach ($scraper in $scrapers) {
        $scraperPath = $scraper.FullName
        $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Starting scraper $($scraper.Name)...`r`n")

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $powershellExe
        $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scraperPath`""
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

        if ($stdout.Trim()) { $logBox.AppendText($stdout.Trim() + "`r`n") }
        if ($stderr.Trim()) { $logBox.AppendText("ERROR: " + $stderr.Trim() + "`r`n") }

        $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Scraper $($scraper.Name) finished.`r`n")
    }

    Refresh-Grid
}

function Google-Search-Selected {
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show("Please select a row first.", "No Selection") | Out-Null
        return
    }

    $row = $table.SelectedRows[0]
    $name = [string]$row.Cells["ClaimedName"].Value
    $address = [string]$row.Cells["LastKnownStreetAddress"].Value

    if ([string]::IsNullOrWhiteSpace($name)) {
        [System.Windows.Forms.MessageBox]::Show("Selected row has no name.", "Missing Data") | Out-Null
        return
    }

    $query = "$name $address Singapore"
    $url = "https://www.google.com/search?q=" + [System.Web.HttpUtility]::UrlEncode($query)
    Start-Process $url

    # Update status to Trying
    $row.Cells["Status"].Value = "Trying"
    Save-Changes
    $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Searched for '$name' and updated status to 'Trying'.`r`n")
}

function Update-Remark-Prompt {
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show("Please select a row first.", "No Selection") | Out-Null
        return
    }

    $row = $table.SelectedRows[0]
    $currentRemark = [string]$row.Cells["MyRemarks"].Value
    $newRemark = [Microsoft.VisualBasic.Interaction]::InputBox("Enter your remark:", "Update My Remark", $currentRemark)

    if ($null -ne $newRemark) {
        $row.Cells["MyRemarks"].Value = $newRemark
        Save-Changes
        $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Updated my remark.`r`n")
    }
}

function Mark-Status {
    param([string]$Status)
    if ($table.SelectedRows.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show("Please select a row first.", "No Selection") | Out-Null
        return
    }
    $row = $table.SelectedRows[0]
    $row.Cells["Status"].Value = $Status
    Save-Changes
    $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Marked status as '$Status'.`r`n")
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Unclaimed Monies Tracker"
$form.Size = New-Object System.Drawing.Size(1200, 700)
$form.StartPosition = "CenterScreen"

$table = New-Object System.Windows.Forms.DataGridView
$table.Location = New-Object System.Drawing.Point(10, 10)
$table.Size = New-Object System.Drawing.Size(1165, 480)
$table.Anchor = "Top, Left, Right, Bottom"
$table.AutoSizeColumnsMode = "AllCells"
$table.AllowUserToAddRows = $false
$table.SelectionMode = "FullRowSelect"
$table.MultiSelect = $false

$btnRun = New-Object System.Windows.Forms.Button
$btnRun.Text = "Run All Scrapers"
$btnRun.Location = New-Object System.Drawing.Point(10, 500)
$btnRun.Size = New-Object System.Drawing.Size(120, 30)
$btnRun.Anchor = "Bottom, Left"
$btnRun.Add_Click({ Run-Scrapers })

$btnSearch = New-Object System.Windows.Forms.Button
$btnSearch.Text = "Google Search"
$btnSearch.Location = New-Object System.Drawing.Point(140, 500)
$btnSearch.Size = New-Object System.Drawing.Size(100, 30)
$btnSearch.Anchor = "Bottom, Left"
$btnSearch.Add_Click({ Google-Search-Selected })

$btnRemark = New-Object System.Windows.Forms.Button
$btnRemark.Text = "Update My Remark"
$btnRemark.Location = New-Object System.Drawing.Point(250, 500)
$btnRemark.Size = New-Object System.Drawing.Size(130, 30)
$btnRemark.Anchor = "Bottom, Left"
$btnRemark.Add_Click({ Update-Remark-Prompt })

$btnTrying = New-Object System.Windows.Forms.Button
$btnTrying.Text = "Mark Trying"
$btnTrying.Location = New-Object System.Drawing.Point(390, 500)
$btnTrying.Size = New-Object System.Drawing.Size(100, 30)
$btnTrying.Anchor = "Bottom, Left"
$btnTrying.Add_Click({ Mark-Status "Trying" })

$btnNotFound = New-Object System.Windows.Forms.Button
$btnNotFound.Text = "Mark Not Found"
$btnNotFound.Location = New-Object System.Drawing.Point(500, 500)
$btnNotFound.Size = New-Object System.Drawing.Size(110, 30)
$btnNotFound.Anchor = "Bottom, Left"
$btnNotFound.Add_Click({ Mark-Status "Failed to Find" })

$btnSave = New-Object System.Windows.Forms.Button
$btnSave.Text = "Save Changes"
$btnSave.Location = New-Object System.Drawing.Point(620, 500)
$btnSave.Size = New-Object System.Drawing.Size(110, 30)
$btnSave.Anchor = "Bottom, Left"
$btnSave.Add_Click({
    Save-Changes
    [System.Windows.Forms.MessageBox]::Show("Changes saved.", "Saved") | Out-Null
})

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = "Refresh"
$btnRefresh.Location = New-Object System.Drawing.Point(740, 500)
$btnRefresh.Size = New-Object System.Drawing.Size(100, 30)
$btnRefresh.Anchor = "Bottom, Left"
$btnRefresh.Add_Click({ Refresh-Grid })

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.Location = New-Object System.Drawing.Point(10, 545)
$logBox.Size = New-Object System.Drawing.Size(1165, 110)
$logBox.Anchor = "Bottom, Left, Right"
$logBox.ScrollBars = "Vertical"
$logBox.ReadOnly = $true

$form.Controls.AddRange(@($table, $btnRun, $btnSearch, $btnRemark, $btnTrying, $btnNotFound, $btnSave, $btnRefresh, $logBox))

Refresh-Grid

$form.ShowDialog()
