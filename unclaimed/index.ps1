Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataDir = Join-Path $PSScriptRoot "data"
$scrapersDir = Join-Path $PSScriptRoot "scrapers"
$powershellExe = (Get-Process -Id $PID).Path
$dataFile = Join-Path $dataDir "unclaimed_gov.csv"

$statuses = @("New", "Trying", "Failed to Find", "Pending Reply", "Done")

function Refresh-Grid {
    if (-not (Test-Path $dataFile)) {
        $table.DataSource = $null
        return
    }

    $data = Import-Csv $dataFile
    $dt = New-Object System.Data.DataTable

    if ($data.Count -gt 0) {
        $first = $data[0]
        foreach ($prop in $first.PSObject.Properties) {
            [void]$dt.Columns.Add($prop.Name)
        }

        foreach ($row in $data) {
            $dr = $dt.NewRow()
            foreach ($prop in $row.PSObject.Properties) {
                $dr[$prop.Name] = $prop.Value
            }
            [void]$dt.Rows.Add($dr)
        }
    }

    $table.DataSource = $dt

    # Ensure Status column is a ComboBox if it exists
    if ($dt.Columns.Contains("Status")) {
        $colIndex = -1
        for ($i=0; $i -lt $table.Columns.Count; $i++) {
            if ($table.Columns[$i].DataPropertyName -eq "Status") {
                $colIndex = $i
                break
            }
        }

        if ($colIndex -ge 0 -and $table.Columns[$colIndex].GetType().Name -ne "DataGridViewComboBoxColumn") {
            $oldCol = $table.Columns[$colIndex]
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
    [System.Windows.Forms.MessageBox]::Show("Changes saved to $dataFile", "Saved") | Out-Null
}

function Run-Scraper {
    $scraperPath = Join-Path $scrapersDir "unclaimed_gov.ps1"
    if (-not (Test-Path $scraperPath)) {
        [System.Windows.Forms.MessageBox]::Show("Scraper script not found at $scraperPath", "Error") | Out-Null
        return
    }

    $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Starting scraper...`r`n")

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

    $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Scraper finished.`r`n")
    Refresh-Grid
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Unclaimed Monies Tracker"
$form.Size = New-Object System.Drawing.Size(1000, 600)
$form.StartPosition = "CenterScreen"

$table = New-Object System.Windows.Forms.DataGridView
$table.Location = New-Object System.Drawing.Point(10, 10)
$table.Size = New-Object System.Drawing.Size(965, 400)
$table.Anchor = "Top, Left, Right, Bottom"
$table.AutoSizeColumnsMode = "AllCells"
$table.AllowUserToAddRows = $false

$btnRun = New-Object System.Windows.Forms.Button
$btnRun.Text = "Run Scraper"
$btnRun.Location = New-Object System.Drawing.Point(10, 420)
$btnRun.Anchor = "Bottom, Left"
$btnRun.Add_Click({ Run-Scraper })

$btnSave = New-Object System.Windows.Forms.Button
$btnSave.Text = "Save Changes"
$btnSave.Location = New-Object System.Drawing.Point(100, 420)
$btnSave.Anchor = "Bottom, Left"
$btnSave.Add_Click({ Save-Changes })

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = "Refresh"
$btnRefresh.Location = New-Object System.Drawing.Point(190, 420)
$btnRefresh.Anchor = "Bottom, Left"
$btnRefresh.Add_Click({ Refresh-Grid })

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.Location = New-Object System.Drawing.Point(10, 455)
$logBox.Size = New-Object System.Drawing.Size(965, 100)
$logBox.Anchor = "Bottom, Left, Right"
$logBox.ScrollBars = "Vertical"
$logBox.ReadOnly = $true

$form.Controls.AddRange(@($table, $btnRun, $btnSave, $btnRefresh, $logBox))

Refresh-Grid

$form.ShowDialog()
