param(
    [string]$Path = (Get-Location).Path,
    [int]$CRF = 28,
    [int]$SampleFPS = 1,
    [int]$SampleFrameLimit = 20,
    [Alias('Threshold')]
    [double]$SlideshowMaxUniqueThreshold = 75,
    [double]$PhotoScale = 1.2,
    [int]$PhotoJpegQuality = 2
)
    
# =========================
# FFMPEG RESOLUTION
# =========================
$ffmpegLocal = Join-Path $PSScriptRoot "ffmpeg.exe"
$ffprobeLocal = Join-Path $PSScriptRoot "ffprobe.exe"

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
    if (Test-Path "$($folder.FullName)\bin\ffprobe.exe") {
        Copy-Item "$($folder.FullName)\bin\ffprobe.exe" $ffprobeLocal -Force
    }
    Remove-Item $zip -Force
    Remove-Item $folder.FullName -Recurse -Force
    return $ffmpegLocal
}

function Get-FFprobe {
    if (Test-Path $ffprobeLocal) { return $ffprobeLocal }

    $cmd = Get-Command ffprobe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $ffmpegDir = Split-Path -Parent $ffmpeg
    $ffprobeSibling = Join-Path $ffmpegDir "ffprobe.exe"
    if (Test-Path $ffprobeSibling) { return $ffprobeSibling }

    return $null
}

$ffmpeg = Get-FFmpeg
$ffprobe = Get-FFprobe
Write-Host "FFmpeg: $ffmpeg"
if ($ffprobe) {
    Write-Host "FFprobe: $ffprobe"
}
else {
    Write-Host "FFprobe not found. Using ffmpeg metadata fallback, then file timestamps if needed."
}

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


Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Globalization

function Get-VideoTimestamp($videoPath) {
    $creationTimeRaw = $null

    if ($ffprobe) {
        $creationTimeRaw = & $ffprobe -v error `
            -show_entries format_tags=creation_time `
            -of default=noprint_wrappers=1:nokey=1 `
            $videoPath
    }
    else {
        $probeOutput = & $ffmpeg -hide_banner -i $videoPath 2>&1
        $creationLine = $probeOutput | Select-String -Pattern 'creation_time\s*:\s*(.+)'
        if ($creationLine) {
            $creationTimeRaw = $creationLine.Matches[0].Groups[1].Value.Trim()
        }
    }

    if ($creationTimeRaw) {
        $creationTimeRaw = $creationTimeRaw | Select-Object -First 1

        try {
            return [System.DateTimeOffset]::Parse(
                $creationTimeRaw,
                [System.Globalization.CultureInfo]::InvariantCulture,
                [System.Globalization.DateTimeStyles]::RoundtripKind
            ).LocalDateTime
        }
        catch {
            Write-Host "Unable to parse creation_time '$creationTimeRaw'. Falling back to file timestamps."
        }
    }

    return (Get-Item $videoPath).CreationTime
}

function Set-FileTimestamps($files, [datetime]$timestamp) {
    foreach ($file in $files) {
        [System.IO.File]::SetCreationTime($file.FullName, $timestamp)
        [System.IO.File]::SetLastWriteTime($file.FullName, $timestamp)
        [System.IO.File]::SetLastAccessTime($file.FullName, $timestamp)
    }
}

function Get-ImageDifferenceScore($img1Path, $img2Path) {
    $bmp1 = [System.Drawing.Bitmap]::FromFile($img1Path)
    $bmp2 = [System.Drawing.Bitmap]::FromFile($img2Path)

    # resize to small (faster + ignores noise)
    $size = 32
    $small1 = New-Object System.Drawing.Bitmap($bmp1, $size, $size)
    $small2 = New-Object System.Drawing.Bitmap($bmp2, $size, $size)

    $diff = 0

    for ($x = 0; $x -lt $size; $x++) {
        for ($y = 0; $y -lt $size; $y++) {
            $c1 = $small1.GetPixel($x, $y)
            $c2 = $small2.GetPixel($x, $y)

            # grayscale diff
            $g1 = ($c1.R + $c1.G + $c1.B) / 3
            $g2 = ($c2.R + $c2.G + $c2.B) / 3

            $diff += [math]::Abs($g1 - $g2)
        }
    }

    $bmp1.Dispose()
    $bmp2.Dispose()
    $small1.Dispose()
    $small2.Dispose()

    return $diff
}

# =========================
# PROCESS
# =========================
$videos = Get-ChildItem $Path -Filter *.mp4 -File

foreach ($video in $videos) {
    Write-Host "`n=== Processing: $($video.Name) ==="

    # -------------------------
    # STEP 1: SAMPLE FRAMES
    # -------------------------
    $tempDir = Join-Path $env:TEMP ("sample_" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $tempDir | Out-Null

    $samplePattern = Join-Path $tempDir "sample_%04d.jpg"

    & $ffmpeg -y -i "`"$($video.FullName)`"" -vf "fps=$SampleFPS" -frames:v $SampleFrameLimit $samplePattern 2>$null

    $samples = @(Get-ChildItem $tempDir -Filter *.jpg | Sort-Object Name)

    if ($samples.Count -eq 0) {
        Write-Host "No frames extracted, skipping..."
        Remove-Item $tempDir -Recurse -Force
        continue
    }

    Write-Host "Sample frames saved to: $tempDir"

    # -------------------------
    # STEP 2: COUNT UNIQUE
    # -------------------------
    $uniqueImages = @()

    foreach ($img in $samples) {
        $isDuplicate = $false

        foreach ($u in $uniqueImages) {
            $score = Get-ImageDifferenceScore $img.FullName $u.FullName

            if ($score -lt 2000) {  # threshold (tune this)
                $isDuplicate = $true
                break
            }
        }

        if (-not $isDuplicate) {
            $uniqueImages += $img
        }
    }

    $uniqueCount = $uniqueImages.Count
    $sampleCount = $samples.Count
    $uniquePercentage = if ($sampleCount -gt 0) {
        [math]::Round(($uniqueCount / $sampleCount) * 100, 2)
    }
    else {
        0
    }

    Write-Host "Sampled frames: $sampleCount (max $SampleFrameLimit)"
    Write-Host "Visual unique images: $uniqueCount ($uniquePercentage%)"
    # -------------------------
    # DECISION
    # -------------------------
    Write-Host "Slideshow threshold: unique <= $SlideshowMaxUniqueThreshold% of sampled frames"

    if ($uniquePercentage -le $SlideshowMaxUniqueThreshold) {
        Write-Host "➡ Detected slideshow (few unique images). Extracting photos..."

        $outDir = Join-Path $video.DirectoryName ($video.BaseName + "_photos")
        New-Item -ItemType Directory -Path $outDir -ErrorAction SilentlyContinue | Out-Null

        $creationTime = Get-VideoTimestamp $video.FullName
        $creationTimeValue = $creationTime.ToString("yyyy-MM-ddTHH:mm:ssK")
        $photoFilter = "select='gt(scene,0.02)',scale='trunc(iw*$PhotoScale/2)*2':'trunc(ih*$PhotoScale/2)*2':flags=lanczos"

        Write-Host "Using creation_time: $creationTimeValue"
        Write-Host "Photo upscale: ${PhotoScale}x, JPEG quality: $PhotoJpegQuality"

        $outputPattern = Join-Path $outDir "photo_%05d.jpg"

        $args = @(
            "-y",
            "-i", $video.FullName,
            "-map_metadata", "0",
            "-movflags", "use_metadata_tags",
            "-vf", $photoFilter,
            "-fps_mode", "vfr",
            "-frame_pts", "1",
            "-q:v", $PhotoJpegQuality,
            "-metadata", "creation_time=$creationTimeValue",
            $outputPattern
        )

        & $ffmpeg @args

        $photos = Get-ChildItem $outDir -Filter *.jpg
        Set-FileTimestamps $photos $creationTime
        Write-Host "Saved to: $outDir"
    }
    else {
        Write-Host "➡ Normal video. Compressing..."

        $output = Join-Path $video.DirectoryName ($video.BaseName + "_compressed.mp4")

        & $ffmpeg -y -i "`"$($video.FullName)`"" `
            -map_metadata 0 `
            -movflags use_metadata_tags `
            -c:v libx264 -crf $CRF -preset veryfast `
            "`"$output`"" 2>$null

        if (Test-Path $output) {
            # Preserve timestamps
            $outFile = Get-Item $output
            $outFile.CreationTime = $video.CreationTime
            $outFile.LastWriteTime = $video.LastWriteTime
            $outFile.LastAccessTime = $video.LastAccessTime

            Write-Host "Compressed → $output"
        }
    }

    # Cleanup
     Remove-Item $tempDir -Recurse -Force
}

Write-Host "`nDone!"
