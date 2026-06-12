# Ensure Single-Threaded Apartment (STA) mode for WPF
if ($host.Runspace.ApartmentState -ne 'STA') {
    Write-Host "Restarting script in STA mode..." -ForegroundColor Cyan
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -STA -File `"$PSCommandPath`""
    Exit
}

# Load required WPF and .NET assemblies
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Xaml, System.Data

$workspaceDir = "c:\Users\graGT\Documents\apps2\vibecodes"
$csvPath = Join-Path $workspaceDir "tasks.csv"
$archiveCsvPath = Join-Path $workspaceDir "archive.csv"
$filesDir = Join-Path $workspaceDir "files"
$logsDir = Join-Path $workspaceDir "logs"
$csvLock = New-Object Object

# Create files directory if it doesn't exist
if (-not (Test-Path $filesDir)) {
    New-Item -ItemType Directory -Path $filesDir | Out-Null
    Write-Host "Created files directory at: $filesDir" -ForegroundColor Green
}

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
    Write-Host "Created logs directory at: $logsDir" -ForegroundColor Green
}

# Perform Daily and Weekly Backups
if (Test-Path $csvPath) {
    $dayBak = "$csvPath.day.bak"
    $weekBak = "$csvPath.week.bak"
    
    # Daily check (> 24 hours)
    if (-not (Test-Path $dayBak)) {
        Copy-Item -Path $csvPath -Destination $dayBak -Force
        Write-Host "Created initial daily backup: $dayBak" -ForegroundColor Green
    } else {
        $lastWrite = (Get-Item $dayBak).LastWriteTime
        if ((Get-Date) -gt $lastWrite.AddDays(1)) {
            Copy-Item -Path $csvPath -Destination $dayBak -Force
            Write-Host "Updated daily backup: $dayBak" -ForegroundColor Green
        }
    }
    
    # Weekly check (> 7 days)
    if (-not (Test-Path $weekBak)) {
        Copy-Item -Path $csvPath -Destination $weekBak -Force
        Write-Host "Created initial weekly backup: $weekBak" -ForegroundColor Green
    } else {
        $lastWrite = (Get-Item $weekBak).LastWriteTime
        if ((Get-Date) -gt $lastWrite.AddDays(7)) {
            Copy-Item -Path $csvPath -Destination $weekBak -Force
            Write-Host "Updated weekly backup: $weekBak" -ForegroundColor Green
        }
    }
}

# Initialize CSV file if missing
if (-not (Test-Path $csvPath)) {
    $headers = "Status,Date Updated,My Request,Agent Notes,File Link / Name"
    Set-Content -Path $csvPath -Value $headers -Encoding UTF8
    Write-Host "Initialized empty tasks.csv" -ForegroundColor Green
}

if (-not (Test-Path $archiveCsvPath)) {
    $headers = "Status,Date Updated,My Request,Agent Notes,File Link / Name,Archived At"
    Set-Content -Path $archiveCsvPath -Value $headers -Encoding UTF8
    Write-Host "Initialized empty archive.csv" -ForegroundColor Green
}

# Background Ollama Runner Script Block (executed inside Runspace)
$backgroundScript = {
    param($csvPath, $filesDir, $logsDir, $todoTaskJson, $apiUrl)
    
    $task = ConvertFrom-Json $todoTaskJson

    function Add-AgentLog {
        param(
            [string]$Path,
            [string]$Text
        )

        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
        Add-Content -Path $Path -Value "[$timestamp] $Text" -Encoding UTF8
    }

    function Get-TaskPropertyValue {
        param(
            [object]$Task,
            [string]$Name
        )

        if ($null -eq $Task) { return "" }
        $safeName = switch ($Name) {
            "Date Updated" { "DateUpdated" }
            "My Request" { "MyRequest" }
            "Agent Notes" { "AgentNotes" }
            "File Link / Name" { "FileLinkName" }
            default { $Name }
        }
        $candidateNames = @($Name, $safeName) | Select-Object -Unique

        foreach ($candidateName in $candidateNames) {
            foreach ($property in $Task.PSObject.Properties) {
                if ($property.Name -eq $candidateName) {
                    if ($property.Value -is [array]) {
                        return (($property.Value | Where-Object { $null -ne $_ }) -join "`n")
                    }
                    return [string]$property.Value
                }
            }
        }
        return ""
    }
    
    # Function to update Status, Timestamp, and Notes in CSV
    function Set-TaskStatusInCsv {
        param($status, $agentNote)
        
        $success = $false
        for ($i = 0; $i -lt 10; $i++) {
            try {
                $csvData = Import-Csv -Path $csvPath -Encoding UTF8
                $tasks = @()
                if ($null -ne $csvData) {
                    if ($csvData -is [array]) { $tasks = $csvData } else { $tasks = @($csvData) }
                }
                foreach ($t in $tasks) {
                    $taskRequest = Get-TaskPropertyValue -Task $task -Name "My Request"
                    $taskFilePath = Get-TaskPropertyValue -Task $task -Name "File Link / Name"
                    if ($t.'My Request' -eq $taskRequest -and $t.'File Link / Name' -eq $taskFilePath) {
                        $t.Status = $status
                        $t.'Date Updated' = (Get-Date).ToString("yyyy-MM-dd")
                        $t.'Agent Notes' = $agentNote
                        break
                    }
                }
                $tasks | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8 -Force
                $success = $true
                break
            } catch {
                Start-Sleep -Milliseconds 250
            }
        }
        return $success
    }

    try {
        # 1. Set status to Doing
        Set-TaskStatusInCsv -status "Doing" -agentNote "Agent is processing the task..." | Out-Null
        
        # 2. Get file content
        $filePath = Get-TaskPropertyValue -Task $task -Name "File Link / Name"
        $fullFilePath = $filePath
        if (-not [System.IO.Path]::IsPathRooted($filePath)) {
            $fullFilePath = Join-Path $filesDir $filePath
        }
        
        if (-not (Test-Path $fullFilePath)) {
            throw "Target file not found at: $fullFilePath"
        }
        
        $fileContent = Get-Content -Path $fullFilePath -Raw
        # 3. Formulate Prompt
        $userRequest = Get-TaskPropertyValue -Task $task -Name "My Request"
        $safeFileName = ([System.IO.Path]::GetFileName($fullFilePath) -replace '[^\w\.-]', '_')
        if ([string]::IsNullOrWhiteSpace($safeFileName)) { $safeFileName = "task" }
        $logPath = Join-Path $logsDir ("ollama-{0}-{1}.log" -f (Get-Date).ToString("yyyyMMdd-HHmmss"), $safeFileName)

        $prompt = @"
You are an expert web development agent.
You are tasked with modifying the following HTML/JS file content.

USER REQUEST:
$userRequest

CURRENT FILE CONTENT:
$fileContent

INSTRUCTIONS:
1. Implement the requested changes in the HTML/JS file.
2. In your response, provide your brief explanation, thoughts or notes first.
3. Then, output exactly `===` on a line by itself.
4. Then, output the complete, updated HTML/JS file contents. Do NOT wrap the HTML code in markdown code blocks like ```html ... ``` after the `===` separator. Just output the raw code.
5. Do not include markdown code block formatting for the HTML portion, only the raw updated code after `===`.

Your response MUST follow this structure:
[Your thoughts, explanations, questions, or notes]
===
[Complete new HTML/JS file content]
"@

        # 4. Invoke Ollama local API
        $tagsUrl = "$apiUrl/api/tags"
        $tagsRequest = [System.Net.WebRequest]::Create($tagsUrl)
        $tagsRequest.Method = "GET"
        $tagsRequest.Timeout = 30000
        $tagsResponse = $tagsRequest.GetResponse()
        $tagsStream = $tagsResponse.GetResponseStream()
        $tagsReader = New-Object System.IO.StreamReader($tagsStream, [System.Text.Encoding]::UTF8)
        $tagsText = $tagsReader.ReadToEnd()
        $tagsReader.Close()
        $tagsStream.Close()
        $tagsResponse.Close()

        $tagsObj = ConvertFrom-Json $tagsText
        if ($null -eq $tagsObj.models -or $tagsObj.models.Count -lt 1) {
            throw "No local Ollama models found. Run 'ollama pull <model>' first."
        }
        $model = [string]$tagsObj.models[0].name

        $payload = @{
            model = $model
            prompt = $prompt
            stream = $false
        } | ConvertTo-Json -Depth 10

        Add-AgentLog -Path $logPath -Text "Target file: $fullFilePath"
        Add-AgentLog -Path $logPath -Text "User request: $userRequest"
        Add-AgentLog -Path $logPath -Text "Selected Ollama model: $model"
        Add-AgentLog -Path $logPath -Text "API URL: $apiUrl/api/generate"
        Add-AgentLog -Path $logPath -Text "File content length: $($fileContent.Length) chars"
        Add-AgentLog -Path $logPath -Text "Prompt length: $($prompt.Length) chars"
        Add-Content -Path $logPath -Value "`r`n===== PROMPT SENT TO OLLAMA =====`r`n$prompt`r`n===== END PROMPT =====`r`n" -Encoding UTF8
        Add-Content -Path $logPath -Value "===== JSON PAYLOAD SENT TO OLLAMA =====`r`n$payload`r`n===== END JSON PAYLOAD =====`r`n" -Encoding UTF8
        
        $url = "$apiUrl/api/generate"
        
        $request = [System.Net.WebRequest]::Create($url)
        $request.Method = "POST"
        $request.ContentType = "application/json; charset=utf-8"
        $request.Timeout = 300000 # 5 minute timeout
        
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $request.ContentLength = $bytes.Length
        
        $reqStream = $request.GetRequestStream()
        $reqStream.Write($bytes, 0, $bytes.Length)
        $reqStream.Close()
        
        $response = $request.GetResponse()
        $respStream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($respStream, [System.Text.Encoding]::UTF8)
        $responseText = $reader.ReadToEnd()
        $reader.Close()
        $respStream.Close()
        $response.Close()

        Add-Content -Path $logPath -Value "===== RAW OLLAMA RESPONSE =====`r`n$responseText`r`n===== END RAW OLLAMA RESPONSE =====`r`n" -Encoding UTF8
        
        $responseObj = ConvertFrom-Json $responseText
        $aiText = $responseObj.response
        
        if ([string]::IsNullOrWhiteSpace($aiText)) {
            throw "Ollama returned an empty response."
        }
        
        # 5. Parse parts
        $parts = $aiText -split "(?m)^\s*===\s*$"
        if ($parts.Length -lt 2) {
            $parts = $aiText -split "(?m)^\s*====\s*$"
        }
        
        if ($parts.Length -lt 2) {
            throw "Could not find the '===' separator in the agent's response. The model responded: `n$aiText"
        }
        
        $agentNote = $parts[0].Trim()
        $htmlCode = $parts[1].Trim()
        
        # Clean up markdown styling if present
        if ($htmlCode.StartsWith('```html')) {
            $htmlCode = $htmlCode.Substring(7)
        } elseif ($htmlCode.StartsWith('```')) {
            $htmlCode = $htmlCode.Substring(3)
        }
        if ($htmlCode.EndsWith('```')) {
            $htmlCode = $htmlCode.Substring(0, $htmlCode.Length - 3)
        }
        $htmlCode = $htmlCode.Trim()
        
        # 6. Overwrite target file
        [System.IO.File]::WriteAllText($fullFilePath, $htmlCode, [System.Text.Encoding]::UTF8)
        
        # 7. Update status to Done
        Set-TaskStatusInCsv -status "Done" -agentNote "$agentNote`n`nLog: $logPath" | Out-Null
        
    } catch {
        $err = $_.Exception.Message
        if ($null -eq $err) { $err = $_.ToString() }
        if ($logPath) {
            Add-AgentLog -Path $logPath -Text "ERROR: $err"
        }
        Set-TaskStatusInCsv -status "Failed" -agentNote "Error: $err" | Out-Null
    }
}

# Define main WPF XAML
[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="VibeCodes Harness" Height="650" Width="1000" WindowStartupLocation="CenterScreen"
        Background="#0f0f13" Foreground="#eaeaea">
    <Window.Resources>
        <!-- Custom UI Styles -->
        <Style TargetType="Button">
            <Setter Property="Background" Value="#6366f1"/>
            <Setter Property="Foreground" Value="Black"/>
            <Setter Property="Padding" Value="15,8"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border x:Name="border" Background="{TemplateBinding Background}"
                                CornerRadius="6"
                                Padding="{TemplateBinding Padding}">
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter TargetName="border" Property="Opacity" Value="0.85"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style TargetType="TextBox">
            <Setter Property="Background" Value="#1a1a24"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="BorderBrush" Value="#2d2d3a"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="Padding" Value="8,5"/>
            <Setter Property="SelectionBrush" Value="#6366f1"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TextBox">
                        <Border x:Name="border" Background="{TemplateBinding Background}"
                                BorderBrush="{TemplateBinding BorderBrush}"
                                BorderThickness="{TemplateBinding BorderThickness}"
                                CornerRadius="6">
                            <ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Window.Resources>
    
    <Grid Margin="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        
        <!-- Header & Settings Panel -->
        <Grid Grid.Row="0" Margin="0,0,0,15">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <StackPanel Orientation="Vertical">
                <TextBlock Text="VIBECODES" FontSize="26" FontWeight="ExtraBold" Foreground="#818cf8"/>
                <TextBlock Text="Local Coding Agent Orchestrator" FontSize="12" Foreground="#9ca3af" Margin="0,2,0,0"/>
            </StackPanel>
            <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center">
                <TextBlock Text="Ollama URL:" VerticalAlignment="Center" Foreground="#9ca3af" Margin="0,0,8,0" FontWeight="SemiBold" FontSize="11"/>
                <TextBox x:Name="txtApiUrl" Width="155" Height="24" Text="http://localhost:11434" VerticalAlignment="Center" FontSize="11" Padding="6,2"/>
            </StackPanel>
        </Grid>
        
        <!-- Main Datagrid -->
        <Border Grid.Row="1" Background="#15151f" CornerRadius="8" Padding="1" BorderBrush="#282836" BorderThickness="1">
            <DataGrid x:Name="gridTasks" AutoGenerateColumns="False" CanUserAddRows="False" IsReadOnly="True"
                      EnableRowVirtualization="False" EnableColumnVirtualization="False"
                      Background="#15151f" RowBackground="#15151f" AlternatingRowBackground="#1a1a24"
                      Foreground="#eaeaea" BorderThickness="0" GridLinesVisibility="None"
                      HeadersVisibility="Column" SelectionMode="Single" SelectionUnit="FullRow">
                <DataGrid.Columns>
                    <DataGridTextColumn Header="Status" Binding="{Binding Status}" Width="90"/>
                    <DataGridTextColumn Header="Date Updated" Binding="{Binding DateUpdated}" Width="110"/>
                    <DataGridTextColumn Header="My Request" Binding="{Binding MyRequest}" Width="2*"/>
                    <DataGridTextColumn Header="Agent Notes" Binding="{Binding AgentNotes}" Width="3*"/>
                    <DataGridTextColumn Header="File Link / Name" Binding="{Binding FileLinkName}" Width="180"/>
                </DataGrid.Columns>
            </DataGrid>
        </Border>
        
        <!-- Selected Task Actions -->
        <Border Grid.Row="2" Background="#15151f" CornerRadius="8" BorderBrush="#282836" BorderThickness="1" Padding="10" Margin="0,8,0,0">
            <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
                <Button x:Name="btnReset" Content="Reset Selected (Todo)" Height="30" Margin="0,0,8,0" Background="#374151" Padding="12,0"/>
                <Button x:Name="btnOpenHtml" Content="Open HTM" Height="30" Margin="0,0,8,0" Background="#2563eb" Padding="12,0"/>
                <Button x:Name="btnEditHtml" Content="Edit HTM (Notepad)" Height="30" Margin="0,0,8,0" Background="#2563eb" Padding="12,0"/>
                <Button x:Name="btnArchive" Content="Archive Selected" Height="30" Background="#7c2d12" Padding="12,0"/>
            </StackPanel>
        </Border>

        <!-- Status Bar -->
        <Grid Grid.Row="3" Margin="0,8,0,8">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <StackPanel Orientation="Horizontal">
                <TextBlock Text="Status: " Foreground="#9ca3af" VerticalAlignment="Center" FontSize="11" FontWeight="SemiBold"/>
                <TextBlock x:Name="lblStatus" Text="Idle" Foreground="#eaeaea" VerticalAlignment="Center" FontSize="11"/>
            </StackPanel>
            <TextBlock Grid.Column="1" x:Name="lblQueueInfo" Text="Queue: 0 tasks pending" Foreground="#9ca3af" VerticalAlignment="Center" FontSize="11"/>
        </Grid>
        
        <!-- Control Panel -->
        <Border Grid.Row="4" Background="#1a1a24" CornerRadius="8" BorderBrush="#282836" BorderThickness="1" Padding="15">
            <Grid>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="*"/>
                    <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                
                <!-- Creation form -->
                <StackPanel Grid.Column="0" Orientation="Vertical" Margin="0,0,20,0">
                    <TextBlock Text="New Task" FontWeight="Bold" FontSize="15" Foreground="#818cf8" Margin="0,0,0,10"/>
                    
                    <Grid Margin="0,0,0,8">
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="Auto"/>
                            <ColumnDefinition Width="*"/>
                            <ColumnDefinition Width="Auto"/>
                        </Grid.ColumnDefinitions>
                        <TextBlock Text="Target File:" Width="90" VerticalAlignment="Center" Foreground="#9ca3af" FontWeight="SemiBold"/>
                        <TextBox x:Name="txtFilePath" Grid.Column="1" Height="30" IsReadOnly="True"/>
                        <Button x:Name="btnBrowse" Grid.Column="2" Content="Browse files..." Height="30" Margin="10,0,0,0" Padding="12,0"/>
                    </Grid>
                    
                    <Grid>
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="Auto"/>
                            <ColumnDefinition Width="*"/>
                        </Grid.ColumnDefinitions>
                        <TextBlock Text="My Request:" Width="90" VerticalAlignment="Top" Margin="0,5,0,0" Foreground="#9ca3af" FontWeight="SemiBold"/>
                        <TextBox x:Name="txtRequest" Grid.Column="1" Height="50" TextWrapping="Wrap" AcceptsReturn="True" VerticalScrollBarVisibility="Auto"/>
                    </Grid>
                </StackPanel>
                
                <!-- Action buttons -->
                <StackPanel Grid.Column="1" Orientation="Vertical" VerticalAlignment="Bottom" Width="200">
                    <Button x:Name="btnAdd" Content="Add Task (Todo)" Height="34" Background="#818cf8"/>
                </StackPanel>
            </Grid>
        </Border>
    </Grid>
</Window>
"@

# Load the XML XAML using System.Xaml
$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [System.Windows.Markup.XamlReader]::Load($reader)

# Resolve elements
$txtApiUrl = $window.FindName("txtApiUrl")
$gridTasks = $window.FindName("gridTasks")
$lblStatus = $window.FindName("lblStatus")
$lblQueueInfo = $window.FindName("lblQueueInfo")
$txtFilePath = $window.FindName("txtFilePath")
$txtRequest = $window.FindName("txtRequest")
$btnBrowse = $window.FindName("btnBrowse")
$btnAdd = $window.FindName("btnAdd")
$btnReset = $window.FindName("btnReset")
$btnOpenHtml = $window.FindName("btnOpenHtml")
$btnEditHtml = $window.FindName("btnEditHtml")
$btnArchive = $window.FindName("btnArchive")

function Get-TaskPropertyValue {
    param(
        [object]$Task,
        [string]$Name
    )

    if ($null -eq $Task) { return "" }
    $safeName = switch ($Name) {
        "Date Updated" { "DateUpdated" }
        "My Request" { "MyRequest" }
        "Agent Notes" { "AgentNotes" }
        "File Link / Name" { "FileLinkName" }
        default { $Name }
    }
    $candidateNames = @($Name, $safeName) | Select-Object -Unique

    foreach ($candidateName in $candidateNames) {
        foreach ($property in $Task.PSObject.Properties) {
            if ($property.Name -eq $candidateName) {
                if ($property.Value -is [array]) {
                    return (($property.Value | Where-Object { $null -ne $_ }) -join "`n")
                }
                return [string]$property.Value
            }
        }
    }
    return ""
}

function Get-SelectedTask {
    $selectedView = $gridTasks.SelectedItem
    if ($null -eq $selectedView) {
        [System.Windows.MessageBox]::Show("Please select a task from the table above first.", "No Task Selected", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
        return $null
    }
    return $selectedView
}

function Resolve-TaskFilePath {
    param([object]$Task)

    $filePath = Get-TaskPropertyValue -Task $Task -Name "File Link / Name"
    if ([string]::IsNullOrWhiteSpace($filePath)) {
        $filePath = "test.html"
    }

    if ([System.IO.Path]::IsPathRooted($filePath)) {
        return $filePath
    }

    return (Join-Path $filesDir $filePath)
}

# Helper to read CSV into plain objects for WPF UI Thread Binding
function Get-TasksDataTable {
    param([string]$Path)

    $tasks = New-Object System.Collections.ObjectModel.ObservableCollection[object]
    
    [System.Threading.Monitor]::Enter($csvLock)
    try {
        if (Test-Path $Path) {
            $csvData = Import-Csv -Path $Path -Encoding UTF8
            $csv = @()
            if ($null -ne $csvData) {
                if ($csvData -is [array]) { $csv = $csvData } else { $csv = @($csvData) }
            }
            foreach ($row in $csv) {
                $fileLinkName = [string]$row.'File Link / Name'
                if ([string]::IsNullOrWhiteSpace($fileLinkName)) {
                    $fileLinkName = "test.html"
                }
                $myRequest = [string]$row.'My Request'
                if ($myRequest -eq "System.Object[]") {
                    $myRequest = ""
                }
                $tasks.Add([PSCustomObject]@{
                    "Status"       = [string]$row.Status
                    "DateUpdated"  = [string]$row.'Date Updated'
                    "MyRequest"    = $myRequest
                    "AgentNotes"   = [string]$row.'Agent Notes'
                    "FileLinkName" = $fileLinkName
                })
            }
        }
    } finally {
        [System.Threading.Monitor]::Exit($csvLock)
    }

    $sortedTasks = $tasks | Sort-Object `
        @{ Expression = {
            switch ($_.Status) {
                "Done" { 0 }
                "Failed" { 1 }
                "Doing" { 2 }
                "Todo" { 3 }
                default { 4 }
            }
        } },
        @{ Expression = { $_.DateUpdated }; Descending = $true },
        @{ Expression = { $_.MyRequest } }

    $orderedTasks = New-Object System.Collections.ObjectModel.ObservableCollection[object]
    foreach ($task in $sortedTasks) {
        if ($null -ne $task) {
            $orderedTasks.Add($task)
        }
    }
    return ,$orderedTasks
}

# Refresh Tasks DataGrid
function Refresh-Tasks {
    param($grid)
    
    $tasks = Get-TasksDataTable -Path $csvPath
    
    $window.Dispatcher.Invoke([Action]{
        $grid.ItemsSource = $tasks
        
        # Update queue count status
        $todoCount = 0
        foreach ($row in $tasks) {
            if ($row.Status -eq "Todo") { $todoCount++ }
        }
        $lblQueueInfo.Text = "Queue: $todoCount tasks pending"
    })
}

# Dialog Prompt to edit text on Reset
function Show-InputDialog {
    param(
        [string]$Title,
        [string]$Instruction,
        [string]$DefaultValue
    )
    
    [xml]$dialogXaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="$Title" Height="220" Width="480" WindowStartupLocation="CenterOwner"
        Background="#0f0f13" Foreground="#eaeaea" ResizeMode="NoResize" ShowInTaskbar="False">
    <Window.Resources>
        <Style TargetType="Button">
            <Setter Property="Background" Value="#6366f1"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="Padding" Value="15,6"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border x:Name="border" Background="{TemplateBinding Background}"
                                CornerRadius="4"
                                Padding="{TemplateBinding Padding}">
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property="IsMouseOver" Value="True">
                                <Setter TargetName="border" Property="Opacity" Value="0.85"/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style TargetType="TextBox">
            <Setter Property="Background" Value="#1a1a24"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="BorderBrush" Value="#2d2d3a"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="Padding" Value="8,5"/>
            <Setter Property="SelectionBrush" Value="#6366f1"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="TextBox">
                        <Border x:Name="border" Background="{TemplateBinding Background}"
                                BorderBrush="{TemplateBinding BorderBrush}"
                                BorderThickness="{TemplateBinding BorderThickness}"
                                CornerRadius="4">
                            <ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Window.Resources>
    
    <Grid Margin="15">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        
        <TextBlock Text="$Instruction" Foreground="#eaeaea" TextWrapping="Wrap" Margin="0,0,0,10" FontSize="12"/>
        <TextBox x:Name="txtInput" Grid.Row="1" TextWrapping="Wrap" AcceptsReturn="True" Height="70" VerticalScrollBarVisibility="Auto"/>
        
        <StackPanel Grid.Row="2" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,15,0,0">
            <Button x:Name="btnOk" Content="OK" Width="80" Margin="0,0,10,0"/>
            <Button x:Name="btnCancel" Content="Cancel" Width="80" Background="#374151"/>
        </StackPanel>
    </Grid>
</Window>
"@

    $dialogReader = New-Object System.Xml.XmlNodeReader $dialogXaml
    $dialogWindow = [System.Windows.Markup.XamlReader]::Load($dialogReader)
    $dialogWindow.Owner = $window
    
    $dialogInput = $dialogWindow.FindName("txtInput")
    $dialogOk = $dialogWindow.FindName("btnOk")
    $dialogCancel = $dialogWindow.FindName("btnCancel")
    
    $dialogInput.Text = $DefaultValue
    $dialogInput.Focus() | Out-Null
    $dialogInput.SelectAll() | Out-Null
    
    $resultVal = $null
    
    $dialogOk.Add_Click({
        $script:dialogResultVal = [string]$dialogInput.Text
        $dialogWindow.DialogResult = $true
        $dialogWindow.Close()
    })
    
    $dialogCancel.Add_Click({
        $dialogWindow.DialogResult = $false
        $dialogWindow.Close()
    })
    
    $showResult = $dialogWindow.ShowDialog()
    if ($showResult -eq $true) {
        return ([string]$script:dialogResultVal)
    }
    return $null
}

# Button Click Event: Browse target HTML/JS files
$btnBrowse.Add_Click({
    $dialog = New-Object Microsoft.Win32.OpenFileDialog
    $dialog.Filter = "HTML Files (*.html;*.htm)|*.html;*.htm|JavaScript Files (*.js)|*.js|All Files (*.*)|*.*"
    $dialog.InitialDirectory = $filesDir
    
    $result = $dialog.ShowDialog()
    if ($result -eq $true) {
        $selectedFile = $dialog.FileName
        
        # Keep relative path if within files folder, else copy it
        if ($selectedFile.StartsWith($filesDir, [System.StringComparison]::OrdinalIgnoreCase)) {
            $relPath = $selectedFile.Substring($filesDir.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar)
            $txtFilePath.Text = $relPath
        } else {
            # Outside files directory. Suggest copy.
            $fileName = [System.IO.Path]::GetFileName($selectedFile)
            $destPath = Join-Path $filesDir $fileName
            $choice = [System.Windows.MessageBox]::Show(
                "The selected file lies outside the 'files' workspace directory. Would you like to copy it to files/$fileName?",
                "Copy to files/ workspace?",
                [System.Windows.MessageBoxButton]::YesNo,
                [System.Windows.MessageBoxImage]::Question
            )
            if ($choice -eq [System.Windows.MessageBoxResult]::Yes) {
                try {
                    Copy-Item -Path $selectedFile -Destination $destPath -Force
                    $txtFilePath.Text = $fileName
                } catch {
                    [System.Windows.MessageBox]::Show("Error copying file: $_", "Copy Failed", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Error)
                }
            } else {
                $txtFilePath.Text = $selectedFile
            }
        }
    }
})

# Button Click Event: Add new task
$btnAdd.Add_Click({
    $filePath = $txtFilePath.Text
    $requestText = $txtRequest.Text.Trim()
    
    if ([string]::IsNullOrEmpty($filePath)) {
        [System.Windows.MessageBox]::Show("Please select a target file first.", "Missing File", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
        return
    }
    
    if ([string]::IsNullOrEmpty($requestText)) {
        [System.Windows.MessageBox]::Show("Please enter your request description.", "Missing Request", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
        return
    }
    
    [System.Threading.Monitor]::Enter($csvLock)
    try {
        $tasks = @()
        if (Test-Path $csvPath) {
            $csvData = Import-Csv -Path $csvPath -Encoding UTF8
            if ($null -ne $csvData) {
                if ($csvData -is [array]) { $tasks = $csvData } else { $tasks = @($csvData) }
            }
        }
        
        # Status, Date Updated, My Request, Agent Notes, File Link / Name
        $newTask = [PSCustomObject]@{
            "Status"            = "Todo"
            "Date Updated"      = (Get-Date).ToString("yyyy-MM-dd")
            "My Request"        = $requestText
            "Agent Notes"       = ""
            "File Link / Name"  = $filePath
        }
        
        $tasks += $newTask
        $tasks | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8 -Force
    } finally {
        [System.Threading.Monitor]::Exit($csvLock)
    }
    
    $txtFilePath.Text = ""
    $txtRequest.Text = ""
    
    Refresh-Tasks -grid $gridTasks
})

# Button Click Event: Reset selected task to Todo
$btnReset.Add_Click({
    $selectedRow = Get-SelectedTask
    if ($null -eq $selectedRow) {
        return
    }
    
    $currentRequest = Get-TaskPropertyValue -Task $selectedRow -Name "My Request"
    $filePath = Get-TaskPropertyValue -Task $selectedRow -Name "File Link / Name"
    
        $newRequest = Show-InputDialog -Title "Reset Task as Todo" -Instruction "You can update the task description if desired. Click OK to set the status to 'Todo'." -DefaultValue $currentRequest
    
    if ($null -eq $newRequest) {
        return # Cancelled
    }

    $newRequest = [string]$newRequest
    if ($newRequest -eq "System.Object[]") {
        [System.Windows.MessageBox]::Show("The selected task has a corrupted request value. Please type the intended request before resetting it.", "Request Needed", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
        return
    }
    
    [System.Threading.Monitor]::Enter($csvLock)
    try {
        $tasks = @()
        if (Test-Path $csvPath) {
            $csvData = Import-Csv -Path $csvPath -Encoding UTF8
            if ($null -ne $csvData) {
                if ($csvData -is [array]) { $tasks = $csvData } else { $tasks = @($csvData) }
            }
        }
        
        foreach ($t in $tasks) {
            # Compound key match
            if ($t.'My Request' -eq $currentRequest -and $t.'File Link / Name' -eq $filePath) {
                $t.Status = "Todo"
                $t.'My Request' = $newRequest
                $t.'Date Updated' = (Get-Date).ToString("yyyy-MM-dd")
                $t.'Agent Notes' = ""
                break
            }
        }
        
        $tasks | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8 -Force
    } finally {
        [System.Threading.Monitor]::Exit($csvLock)
    }
    
    Refresh-Tasks -grid $gridTasks
})

# Button Click Event: Open selected HTML file with default app/browser
$btnOpenHtml.Add_Click({
    $selectedRow = Get-SelectedTask
    if ($null -eq $selectedRow) {
        return
    }

    $fullFilePath = Resolve-TaskFilePath -Task $selectedRow
    if (-not (Test-Path $fullFilePath)) {
        [System.Windows.MessageBox]::Show("Target file not found: $fullFilePath", "File Not Found", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Error)
        return
    }

    try {
        Start-Process -FilePath $fullFilePath
    } catch {
        [System.Windows.MessageBox]::Show("Error opening file: $_", "Open Failed", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Error)
    }
})

# Button Click Event: Edit selected HTML file in Notepad
$btnEditHtml.Add_Click({
    $selectedRow = Get-SelectedTask
    if ($null -eq $selectedRow) {
        return
    }

    $fullFilePath = Resolve-TaskFilePath -Task $selectedRow
    if (-not (Test-Path $fullFilePath)) {
        [System.Windows.MessageBox]::Show("Target file not found: $fullFilePath", "File Not Found", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Error)
        return
    }

    try {
        Start-Process -FilePath "notepad.exe" -ArgumentList "`"$fullFilePath`""
    } catch {
        [System.Windows.MessageBox]::Show("Error opening Notepad: $_", "Edit Failed", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Error)
    }
})

# Button Click Event: Archive selected task
$btnArchive.Add_Click({
    $selectedRow = Get-SelectedTask
    if ($null -eq $selectedRow) {
        return
    }

    $currentRequest = Get-TaskPropertyValue -Task $selectedRow -Name "My Request"
    $filePath = Get-TaskPropertyValue -Task $selectedRow -Name "File Link / Name"
    if ([string]::IsNullOrWhiteSpace($filePath)) {
        $filePath = "test.html"
    }

    $choice = [System.Windows.MessageBox]::Show(
        "Archive selected task and remove it from the active list?",
        "Archive Task",
        [System.Windows.MessageBoxButton]::YesNo,
        [System.Windows.MessageBoxImage]::Question
    )
    if ($choice -ne [System.Windows.MessageBoxResult]::Yes) {
        return
    }

    [System.Threading.Monitor]::Enter($csvLock)
    try {
        $tasks = @()
        if (Test-Path $csvPath) {
            $csvData = Import-Csv -Path $csvPath -Encoding UTF8
            if ($null -ne $csvData) {
                if ($csvData -is [array]) { $tasks = $csvData } else { $tasks = @($csvData) }
            }
        }

        $remainingTasks = @()
        $archivedTask = $null
        foreach ($task in $tasks) {
            $taskFilePath = [string]$task.'File Link / Name'
            if ([string]::IsNullOrWhiteSpace($taskFilePath)) {
                $taskFilePath = "test.html"
            }

            if ($null -eq $archivedTask -and $task.'My Request' -eq $currentRequest -and $taskFilePath -eq $filePath) {
                $archivedTask = $task
            } else {
                $remainingTasks += $task
            }
        }

        if ($null -eq $archivedTask) {
            [System.Windows.MessageBox]::Show("Could not find the selected task in tasks.csv.", "Archive Failed", [System.Windows.MessageBoxButton]::OK, [System.Windows.MessageBoxImage]::Warning)
            return
        }

        $archiveRows = @()
        if (Test-Path $archiveCsvPath) {
            $archiveData = Import-Csv -Path $archiveCsvPath -Encoding UTF8
            if ($null -ne $archiveData) {
                if ($archiveData -is [array]) { $archiveRows = $archiveData } else { $archiveRows = @($archiveData) }
            }
        }

        $archiveRows += [PSCustomObject]@{
            "Status"           = $archivedTask.Status
            "Date Updated"     = $archivedTask.'Date Updated'
            "My Request"       = $archivedTask.'My Request'
            "Agent Notes"      = $archivedTask.'Agent Notes'
            "File Link / Name" = $filePath
            "Archived At"      = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        }

        $remainingTasks | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8 -Force
        $archiveRows | Export-Csv -Path $archiveCsvPath -NoTypeInformation -Encoding UTF8 -Force
    } finally {
        [System.Threading.Monitor]::Exit($csvLock)
    }

    Refresh-Tasks -grid $gridTasks
})

# Asynchronous runner states
$script:isProcessing = $false
$script:runspace = $null
$script:powershellInstance = $null
$script:asyncResult = $null

# Set up polling timer (every 3 seconds) for Background tasks
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds(3)

$timer.Add_Tick({
    if ($script:isProcessing) {
        # Check if the running async task is completed
        if ($null -ne $script:asyncResult -and $script:asyncResult.IsCompleted) {
            try {
                $null = $script:powershellInstance.EndInvoke($script:asyncResult)
            } catch {
                Write-Host "Async Runspace Error: $_" -ForegroundColor Red
            }
            
            # Dispose runspace
            $script:powershellInstance.Dispose()
            $script:runspace.Close()
            $script:runspace.Dispose()
            
            # Reset states
            $script:isProcessing = $false
            $script:asyncResult = $null
            
            $lblStatus.Text = "Idle"
            Refresh-Tasks -grid $gridTasks
        }
        return
    }
    
    # Scan for next Todo task
    $tasks = Get-TasksDataTable -Path $csvPath
    $todoTask = $null
    
    foreach ($row in $tasks) {
        if ($row.Status -eq "Todo") {
            $todoTask = $row
            break
        }
    }
    
    if ($null -ne $todoTask) {
        $script:isProcessing = $true
        
        $apiUrl = $txtApiUrl.Text
        
        $todoRequest = Get-TaskPropertyValue -Task $todoTask -Name "My Request"
        $todoFilePath = Get-TaskPropertyValue -Task $todoTask -Name "File Link / Name"
        $todoAgentNotes = Get-TaskPropertyValue -Task $todoTask -Name "Agent Notes"
        $todoDateUpdated = Get-TaskPropertyValue -Task $todoTask -Name "Date Updated"
        
        $lblStatus.Text = "Processing: $todoRequest"
        
        # Serialize row to JSON to pass safely
        $taskObj = [PSCustomObject]@{
            "Status"            = $todoTask.Status
            "Date Updated"      = $todoDateUpdated
            "My Request"        = $todoRequest
            "Agent Notes"       = $todoAgentNotes
            "File Link / Name"  = $todoFilePath
        }
        $todoTaskJson = $taskObj | ConvertTo-Json -Depth 5
        
        # Create asynchronous runspace execution
        $script:runspace = [runspacefactory]::CreateRunspace()
        $script:runspace.Open()
        
        $script:powershellInstance = [powershell]::Create()
        $script:powershellInstance.Runspace = $script:runspace
        
        $script:powershellInstance.AddScript($backgroundScript).AddArgument($csvPath).AddArgument($filesDir).AddArgument($logsDir).AddArgument($todoTaskJson).AddArgument($apiUrl) | Out-Null
            
        # Trigger async execution and refresh UI right away to show Doing status
        $script:asyncResult = $script:powershellInstance.BeginInvoke()
        
        # Instantly refresh table to display "Doing" status which background script updates immediately
        Start-Sleep -Milliseconds 150 # Brief wait to let the background runspace write status to CSV
        Refresh-Tasks -grid $gridTasks
    }
})

# Load initial tasks list
Refresh-Tasks -grid $gridTasks

# Start Background Timer
$timer.Start()

# Ensure background threads are cleaned up if window closes
$window.Add_Closed({
    $timer.Stop()
    if ($script:isProcessing -and $null -ne $script:powershellInstance) {
        try {
            $script:powershellInstance.Dispose()
            $script:runspace.Close()
            $script:runspace.Dispose()
        } catch {}
    }
})

# Show the GUI
$window.ShowDialog() | Out-Null
