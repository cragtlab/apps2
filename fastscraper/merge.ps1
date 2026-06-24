param(
    [Parameter(Mandatory=$true)]
    [string]$file,
    [string[]]$KeyColumns
)

$tmpDir = "tmp"
$dataDir = "data"
$unreadDir = "unread"
$tmpPath = Join-Path $tmpDir $file
$dataPath = Join-Path $dataDir $file
$unreadPath = Join-Path $unreadDir $file

function Get-ColumnNames {
    param(
        [object[]]$Rows
    )

    $columns = New-Object System.Collections.Generic.List[string]

    foreach ($row in @($Rows)) {
        foreach ($name in $row.PSObject.Properties.Name) {
            if (-not $columns.Contains($name)) {
                [void]$columns.Add($name)
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

    return ($Columns | ForEach-Object {
        $value = $Row.$_
        if ($null -eq $value) { "" } else { ([string]$value).Trim() }
    }) -join "`u{001F}"
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

    if ($null -eq $CurrentRow) {
        return $CandidateRow
    }

    if ($null -eq $CandidateRow) {
        return $CurrentRow
    }

    $currentKey = Get-RowKey -Row $CurrentRow -Columns $Columns
    $candidateKey = Get-RowKey -Row $CandidateRow -Columns $Columns

    if ($currentKey -eq $candidateKey) {
        return $CurrentRow
    }

    $currentScore = Get-RowScore -Row $CurrentRow -Columns $Columns
    $candidateScore = Get-RowScore -Row $CandidateRow -Columns $Columns

    if ($candidateScore -gt $currentScore) {
        return $CandidateRow
    }

    if ($candidateScore -lt $currentScore) {
        return $CurrentRow
    }

    return $CandidateRow
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
            $mergedMap[$key] = $row
            $diffMap[$key] = $row
            [void]$diffOrder.Add($key)
            continue
        }

        $currentRow = $mergedMap[$key]
        $currentFullKey = Get-RowKey -Row $currentRow -Columns $AllColumns
        $newFullKey = Get-RowKey -Row $row -Columns $AllColumns

        if ($currentFullKey -eq $newFullKey) {
            continue
        }

        $preferredRow = Get-PreferredRow -CurrentRow $currentRow -CandidateRow $row -Columns $AllColumns
        $preferredFullKey = Get-RowKey -Row $preferredRow -Columns $AllColumns

        if ($preferredFullKey -ne $currentFullKey) {
            $mergedMap[$key] = $preferredRow
            if (-not $diffMap.ContainsKey($key)) {
                [void]$diffOrder.Add($key)
            }
            $diffMap[$key] = $preferredRow
        }
    }

    return @{
        MergedRows = @($keyOrder | ForEach-Object { $mergedMap[$_] })
        DiffRows = @($diffOrder | ForEach-Object { $diffMap[$_] })
    }
}

if (!(Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir | Out-Null }
if (!(Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
if (!(Test-Path $unreadDir)) { New-Item -ItemType Directory -Path $unreadDir | Out-Null }

if (!(Test-Path $tmpPath)) {
    Write-Output "Tmp file not found: $tmpPath"
    return
}

$new = @(Import-Csv $tmpPath)
$existing = if (Test-Path $dataPath) { @(Import-Csv $dataPath) } else { @() }
$unreadExisting = if (Test-Path $unreadPath) { @(Import-Csv $unreadPath) } else { @() }
$columns = Get-ColumnNames -Rows ($existing + $new + $unreadExisting)

if ($columns.Count -eq 0) {
    Write-Output "No rows found in $tmpPath"
    return
}

$effectiveKeyColumns = if ($KeyColumns -and $KeyColumns.Count -gt 0) { $KeyColumns } else { $columns }
$uniqueNew = Get-UniqueRows -Rows $new -Columns $columns

if ($KeyColumns -and $KeyColumns.Count -gt 0) {
    $upsertResult = Get-UpsertResult -ExistingRows $existing -NewRows $uniqueNew -KeyColumns $effectiveKeyColumns -AllColumns $columns
    $merged = @($upsertResult.MergedRows)
    $diffRows = New-Object System.Collections.Generic.List[object]
    foreach ($row in @($upsertResult.DiffRows)) {
        [void]$diffRows.Add($row)
    }
}
else {
    $existingKeys = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($row in $existing) {
        [void]$existingKeys.Add((Get-RowKey -Row $row -Columns $columns))
    }

    $diffRows = New-Object System.Collections.Generic.List[object]

    foreach ($row in $uniqueNew) {
        $key = Get-RowKey -Row $row -Columns $columns
        if (-not $existingKeys.Contains($key)) {
            [void]$diffRows.Add($row)
            [void]$existingKeys.Add($key)
        }
    }

    $merged = Get-UniqueRows -Rows ($existing + $diffRows.ToArray()) -Columns $columns
}

$mergedForExport = Convert-RowsToColumnSchema -Rows $merged -Columns $columns
$mergedForExport | Export-Csv $dataPath -NoTypeInformation -Encoding UTF8

if ($diffRows.Count -gt 0) {
    if ($KeyColumns -and $KeyColumns.Count -gt 0) {
        $unreadResult = Get-UpsertResult -ExistingRows $unreadExisting -NewRows $diffRows.ToArray() -KeyColumns $effectiveKeyColumns -AllColumns $columns
        $unreadRows = @($unreadResult.MergedRows)
    }
    else {
        $unreadRows = Get-UniqueRows -Rows ($unreadExisting + $diffRows.ToArray()) -Columns $columns
    }
    $unreadRowsForExport = Convert-RowsToColumnSchema -Rows $unreadRows -Columns $columns
    $unreadRowsForExport | Export-Csv $unreadPath -NoTypeInformation -Encoding UTF8
}

Write-Output "Merged into $dataPath"
Write-Output "New rows: $($new.Count)"
Write-Output "Diff rows: $($diffRows.Count)"
Write-Output "Total rows: $($merged.Count)"
