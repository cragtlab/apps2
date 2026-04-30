param(
    [string]$Path = (Get-Location).Path,
    [int]$CRF = 28,
    [switch]$GPU = $false,
    [switch]$Help = $false
)

if ($Help) {
    Write-Host "Video Compressor CLI"
    Write-Host "Usage: .\index.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "OPTIONS:"
    Write-Host "  -Path       Target directory (default: current folder)"
    Write-Host "  -CRF        Quality 0-51, lower=better, 28=default"
    Write-Host "  -GPU        Use NVIDIA NVENC if available"
    Write-Host "  -Help       Show this message"
    exit
}

# =========================
# FFMPEG RESOLUTION
# =========================
$ffmpegLocal = Join-Path $PSScriptRoot "ffmpeg.exe"

function Get-FFmpeg {
    if (Test-Path $ffmpegLocal) { return $ffmpegLocal }
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    Write-Host "FFmpeg not found. Downloading..."
    $zip = Join-Path $PSScriptRoot "ffmpeg.zip"
    $url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    Invoke-WebRequest $url -OutFile $zip
    Expand-Archive $zip -DestinationPath $PSScriptRoot -Force
    $folder = Get-ChildItem $PSScriptRoot | Where-Object { $_.PSIsContainer -and $_.Name -like "ffmpeg-*" } | Select-Object -First 1
    Copy-Item "$($folder.FullName)\bin\ffmpeg.exe" $ffmpegLocal -Force
    Remove-Item $zip -Force
    Remove-Item $folder.FullName -Recurse -Force
    return $ffmpegLocal
}

$ffmpeg = Get-FFmpeg
Write-Host "FFmpeg: $ffmpeg"

if (-not (Test-Path $Path -PathType Container)) {
    Write-Host "Invalid path: $Path"
    exit 1
}

$videos = @(Get-ChildItem $Path -File -Filter "*.mp4" | Where-Object { $_.Length -gt 0 })

if ($videos.Count -eq 0) {
    Write-Host "No MP4 files found in: $Path"
    exit 0
}

Write-Host "Found $($videos.Count) MP4 file(s)"

$hasGPU = $false
if ($GPU) {
    $encoders = & $ffmpeg -encoders 2>&1
    if ($encoders -match "h264_nvenc") {
        $hasGPU = $true
        Write-Host "GPU enabled"
    }
}

# =========================
# COMPRESS VIDEOS
# =========================
$startTime = Get-Date
$compressed = 0

foreach ($video in $videos) {
    $input = $video.FullName
    $name = $video.BaseName
    $output = Join-Path $video.DirectoryName "$name`_compressed.mp4"

    if (Test-Path $output) {
        Write-Host "Skipping: $name (already compressed)"
        continue
    }

    Write-Host "Processing: $name" -NoNewline
    
    $encoder = "libx264"
    $preset = "veryfast"
    if ($hasGPU) {
        $encoder = "h264_nvenc"
        $preset = "fast"
    }

    $args = @(
        "-y",
        "-i", "`"$input`"",
        "-map_metadata", "0",
        "-c:v", $encoder,
        "-crf", $CRF,
        "-preset", $preset,
        "`"$output`""
    )
    $p = Start-Process -FilePath $ffmpeg -ArgumentList $args -RedirectStandardError $env:TEMP\ffmpeg.log -NoNewWindow -PassThru -Wait
    
    if (Test-Path $output) {
        $originalSize = $video.Length
        $compressedSize = (Get-Item $output).Length

        # Preserve timestamps
        $outFile = Get-Item $output
        $outFile.CreationTime = $video.CreationTime
        $outFile.LastWriteTime = $video.LastWriteTime
        $outFile.LastAccessTime = $video.LastAccessTime

        $ratio = [math]::Round((1 - ($compressedSize/$originalSize)) * 100, 1)
        Write-Host " [OK] Saved, reduced by $ratio%"
        $compressed++
    }
    else {
        Write-Host " [FAILED]"
    }

    Remove-Item $env:TEMP\ffmpeg.log -Force -ErrorAction SilentlyContinue
}

$elapsed = ((Get-Date) - $startTime).TotalSeconds
if ($compressed -eq 0) {
    Write-Host "No videos were compressed"
}
else {
    Write-Host "Done! Compressed $compressed/$($videos.Count) files in $([int]$elapsed)s"
}