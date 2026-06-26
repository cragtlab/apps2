param(
    [Parameter(Mandatory=$true)]
    [string]$file,
    [string]$target = "unclaimed_monies.csv",
    [string[]]$KeyColumns
)

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tmpDir = Join-Path $PSScriptRoot "tmp"
$dataDir = Join-Path $PSScriptRoot "data"
$tmpPath = Join-Path $tmpDir $file
$dataPath = Join-Path $dataDir $target

$trackingFields = @("Status", "MyRemarks")

function Get-ColumnNames {
    param(
        [object[]]$Rows
    )

    $columns = New-Object System.Collections.Generic.List[string]
    foreach ($row in @($Rows)) {
        if ($null -eq $row) { continue }
        foreach ($prop in $row.PSObject.Properties) {
            if (-not $columns.Contains($prop.Name)) {
                [void]$columns.Add($prop.Name)
            }
        }
    }
    return $columns.ToArray()
}

function Get-RowKey {
    param(
        $Row,
        [string[]]$Columns
    )

    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($col in $Columns) {
        $value = $Row.$col
        if ($null -eq $value) {
            [void]$parts.Add("")
        } else {
            [void]$parts.Add(([string]$value).Trim())
        }
    }
    return $parts -join [char]31
}

function Get-RowScore {
    param(
        $Row,
        [string[]]$Columns
    )

    $score = 0
    foreach ($column in $Columns) {
        $value = $Row.$column
        if (-not [string]::IsNullOrWhiteSpace([string]$value)) {
            $score++
        }
    }
    return $score
}

function Get-MergedRow {
    param(
        $ExistingRow,
        $NewRow,
        [string[]]$Columns
    )

    if ($null -eq $ExistingRow) { return $NewRow }
    if ($null -eq $NewRow) { return $ExistingRow }

    $merged = $NewRow.psobject.copy()

    # Always preserve tracking data from the existing row
    foreach ($field in $trackingFields) {
        $existingVal = $ExistingRow.$field
        if ($null -ne $existingVal -and -not [string]::IsNullOrWhiteSpace($existingVal)) {
            $merged.$field = $existingVal
        }
    }

    return $merged
}

function Get-UniqueRows {
    param(
        [object[]]$Rows,
        [string[]]$Columns
    )

    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $unique = New-Object System.Collections.Generic.List[object]

    foreach ($row in @($Rows)) {
        $key = Get-RowKey -Row $row -Columns $Columns
        if ($seen.Add($key)) {
            [void]$unique.Add($row)
        }
    }

    return $unique.ToArray()
}

function Convert-RowsToColumnSchema {
    param(
        [object[]]$Rows,
        [string[]]$Columns
    )

    $normalizedRows = New-Object System.Collections.Generic.List[object]
    foreach ($row in @($Rows)) {
        $normalized = [ordered]@{}
        foreach ($column in $Columns) {
            $normalized[$column] = $row.$column
        }
        [void]$normalizedRows.Add([PSCustomObject]$normalized)
    }
    return $normalizedRows.ToArray()
}

function Get-UpsertResult {
    param(
        [object[]]$ExistingRows,
        [object[]]$NewRows,
        [string[]]$KeyColumns,
        [string[]]$AllColumns
    )

    $mergedMap = @{}
    $keyOrder = New-Object System.Collections.Generic.List[string]
    $diffMap = @{}
    $diffOrder = New-Object System.Collections.Generic.List[string]

    foreach ($row in @($ExistingRows)) {
        $key = Get-RowKey -Row $row -Columns $KeyColumns
        if (-not $mergedMap.ContainsKey($key)) {
            [void]$keyOrder.Add($key)
            $mergedMap[$key] = $row
        }
    }

    foreach ($row in @($NewRows)) {
        $key = Get-RowKey -Row $row -Columns $KeyColumns

        if (-not $mergedMap.ContainsKey($key)) {
            [void]$keyOrder.Add($key)
            if (-not $row.Status) {
                Add-Member -InputObject $row -MemberType NoteProperty -Name "Status" -Value "New" -ErrorAction SilentlyContinue
            }
            if (-not $row.MyRemarks) {
                Add-Member -InputObject $row -MemberType NoteProperty -Name "MyRemarks" -Value "" -ErrorAction SilentlyContinue
            }
            $mergedMap[$key] = $row
            $diffMap[$key] = $row
            [void]$diffOrder.Add($key)
            continue
        }

        $currentRow = $mergedMap[$key]
        $dataColumns = $AllColumns | Where-Object { $trackingFields -notcontains $_ }
        $currentDataKey = Get-RowKey -Row $currentRow -Columns $dataColumns
        $newDataKey = Get-RowKey -Row $row -Columns $dataColumns

        $mergedRow = Get-MergedRow -ExistingRow $currentRow -NewRow $row -Columns $AllColumns
        $mergedMap[$key] = $mergedRow

        if ($currentDataKey -ne $newDataKey) {
            if (-not $diffMap.ContainsKey($key)) { [void]$diffOrder.Add($key) }
            $diffMap[$key] = $mergedRow
        }
    }

    return @{
        MergedRows = [array]($keyOrder | ForEach-Object { $mergedMap[$_] })
        DiffRows = [array]($diffOrder | ForEach-Object { $diffMap[$_] })
    }
}

if (!(Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir | Out-Null }
if (!(Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }

if (!(Test-Path $tmpPath)) {
    Write-Output "Tmp file not found: $tmpPath"
    return
}

$new = @(Import-Csv $tmpPath)
$existing = if (Test-Path $dataPath) { @(Import-Csv $dataPath) } else { @() }

$allRows = [array]$existing + [array]$new
$columns = Get-ColumnNames -Rows $allRows

$preferredOrder = @("Status", "MyRemarks", "Remarks", "MoniesId", "ClaimedName", "LastKnownStreetAddress", "CategoryName", "YearCollected", "AgencyName", "CreatedDate")
$finalColumns = New-Object System.Collections.Generic.List[string]
foreach ($col in $preferredOrder) {
    [void]$finalColumns.Add($col)
}
foreach ($col in $columns) {
    if (-not $finalColumns.Contains($col)) { [void]$finalColumns.Add($col) }
}
$columns = $finalColumns.ToArray()

if ($columns.Count -eq 0) {
    Write-Output "No rows found."
    return
}

$effectiveKeyColumns = if ($KeyColumns -and $KeyColumns.Count -gt 0) { $KeyColumns } else { $columns | Where-Object { $trackingFields -notcontains $_ } }

$uniqueNew = Get-UniqueRows -Rows $new -Columns $columns
$upsertResult = Get-UpsertResult -ExistingRows $existing -NewRows $uniqueNew -KeyColumns $effectiveKeyColumns -AllColumns $columns
$merged = [array]$upsertResult.MergedRows

$mergedForExport = Convert-RowsToColumnSchema -Rows $merged -Columns $columns
$mergedForExport | Export-Csv $dataPath -NoTypeInformation -Encoding UTF8

Write-Output "Merged into $dataPath"
Write-Output "New rows: $($new.Count)"
Write-Output "Diff rows: $($upsertResult.DiffRows.Count)"
Write-Output "Total rows: $($merged.Count)"
