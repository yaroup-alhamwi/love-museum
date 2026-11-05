# Love Museum - tiny local web server (no install needed)
# Regenerates photos/manifest.json on every page load, so new photos show up after a refresh.
param([int]$Port = 8080)

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$photos = Join-Path $root 'photos'
if (-not (Test-Path $photos)) { New-Item -ItemType Directory -Path $photos | Out-Null }

function Update-Manifest {
    $names = @(Get-ChildItem -LiteralPath $photos -File |
        Where-Object { $_.Extension -match '^\.(jpe?g|png|webp|gif|avif|bmp)$' } |
        Sort-Object Name | ForEach-Object { $_.Name })
    $json = ConvertTo-Json -InputObject $names -Compress
    if ($names.Count -eq 0) { $json = '[]' }
    [IO.File]::WriteAllText((Join-Path $photos 'manifest.json'), $json, (New-Object Text.UTF8Encoding $false))
    return $names.Count
}

$mime = @{
    '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
    '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'
    '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'
    '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.webp'='image/webp'
    '.gif'='image/gif'; '.avif'='image/avif'; '.bmp'='image/bmp'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'
    '.mp3'='audio/mpeg'; '.ogg'='audio/ogg'; '.wav'='audio/wav'; '.m4a'='audio/mp4'
    '.woff2'='font/woff2'; '.woff'='font/woff'; '.ttf'='font/ttf'; '.md'='text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$started = $false
for ($p = $Port; $p -lt $Port + 20; $p++) {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$p/")
        $listener.Start()
        $Port = $p; $started = $true; break
    } catch { }
}
if (-not $started) { Write-Host 'Could not start the server (ports busy).' -ForegroundColor Red; exit 1 }

$count = Update-Manifest
$url = "http://localhost:$Port/"
Write-Host ''
Write-Host '  ======================================' -ForegroundColor Magenta
Write-Host '     Love Museum is running  <3' -ForegroundColor Magenta
Write-Host "     $url" -ForegroundColor Yellow
Write-Host "     Photos found: $count" -ForegroundColor Cyan
Write-Host '     Close this window to stop.' -ForegroundColor Gray
Write-Host '  ======================================' -ForegroundColor Magenta
Write-Host ''
Start-Process $url

$rootFull = [IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request; $res = $ctx.Response
        $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
        if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
        $rel  = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        $file = [IO.Path]::GetFullPath((Join-Path $rootFull $rel))

        if ($rel -eq ('photos' + [IO.Path]::DirectorySeparatorChar + 'manifest.json')) { [void](Update-Manifest) }

        if ($file.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
            $bytes = [IO.File]::ReadAllBytes($file)
            $ext = [IO.Path]::GetExtension($file).ToLower()
            $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $res.Headers.Add('Cache-Control', 'no-cache')
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $msg = [Text.Encoding]::UTF8.GetBytes('Not found')
            $res.OutputStream.Write($msg, 0, $msg.Length)
        }
        $res.OutputStream.Close()
    } catch {
        try { $ctx.Response.Abort() } catch { }
    }
}
