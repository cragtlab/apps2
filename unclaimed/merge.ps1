param(
    [Parameter(Mandatory=$true)]
    [string]$file,
    [string[]]$KeyColumns
)

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$tmpDir = Join-Path $PSScriptRoot "tmp"
$dataDir = Join-Path $PSScriptRoot "data"
$tmpPath = Join-Path $tmpDir $file
$dataPath = Join-Path $dataDir $file

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
    return $parts -join "`u{001F}"
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

function Get-PreferredRow {
    param(
        $CurrentRow,
        $CandidateRow,
        [string[]]$Columns
    )

    if ($null -eq $CurrentRow) { return $CandidateRow }
    if ($null -eq $CandidateRow) { return $CurrentRow }

    # Special handling for "Status" column - preserve existing non-empty status
    if ($CurrentRow.Status -and -not [string]::IsNullOrWhiteSpace($CurrentRow.Status) -and $CurrentRow.Status -ne "New") {
        return $CurrentRow
    }

    $currentScore = Get-RowScore -Row $CurrentRow -Columns $Columns
    $candidateScore = Get-RowScore -Row $CandidateRow -Columns $Columns

    if ($candidateScore -gt $currentScore) {
        return $CandidateRow
    }

    return $CurrentRow
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
            continue
        }

        $mergedMap[$key] = Get-PreferredRow -CurrentRow $mergedMap[$key] -CandidateRow $row -Columns $AllColumns
    }

    foreach ($row in @($NewRows)) {
        $key = Get-RowKey -Row $row -Columns $KeyColumns

        if (-not $mergedMap.ContainsKey($key)) {
            [void]$keyOrder.Add($key)
            if (-not $row.Status) {
                Add-Member -InputObject $row -MemberType NoteProperty -Name "Status" -Value "New" -ErrorAction SilentlyContinue
            }
            $mergedMap[$key] = $row
            $diffMap[$key] = $row
            [void]$diffOrder.Add($key)
            continue
        }

        $currentRow = $mergedMap[$key]
        $dataColumns = $AllColumns | Where-Object { $_ -ne "Status" }
        $currentDataKey = Get-RowKey -Row $currentRow -Columns $dataColumns
        $newDataKey = Get-RowKey -Row $row -Columns $dataColumns

        if ($currentDataKey -eq $newDataKey) {
            continue
        }

        $preferredRow = Get-PreferredRow -CurrentRow $currentRow -CandidateRow $row -Columns $AllColumns
        $mergedMap[$key] = $preferredRow
        if (-not $diffMap.ContainsKey($key)) { [void]$diffOrder.Add($key) }
        $diffMap[$key] = $preferredRow
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
if ($columns.Count -eq 0) {
    Write-Output "No rows found."
    return
}

if ($columns -notcontains "Status") {
    $columns = [string[]](@("Status") + $columns)
}

$effectiveKeyColumns = if ($KeyColumns -and $KeyColumns.Count -gt 0) { $KeyColumns } else { $columns | Where-Object { $_ -ne "Status" } }

foreach ($row in $new) {
    if ($null -eq $row.Status) {
        Add-Member -InputObject $row -MemberType NoteProperty -Name "Status" -Value "New" -ErrorAction SilentlyContinue
    }
}

$uniqueNew = Get-UniqueRows -Rows $new -Columns $columns
$upsertResult = Get-UpsertResult -ExistingRows $existing -NewRows $uniqueNew -KeyColumns $effectiveKeyColumns -AllColumns $columns
$merged = [array]$upsertResult.MergedRows
$diffRows = [array]$upsertResult.DiffRows

$mergedForExport = Convert-RowsToColumnSchema -Rows $merged -Columns $columns
$mergedForExport | Export-Csv $dataPath -NoTypeInformation -Encoding UTF8

Write-Output "Merged into $dataPath"
Write-Output "New rows: $($new.Count)"
Write-Output "Diff rows: $($diffRows.Count)"
Write-Output "Total rows: $($merged.Count)"
