Param(
    [int]$Port = 3456,
    [string]$LogPath = "$env:APPDATA\neuralagent-desktop\logs\action-monitor.jsonl"
)

# Ensure log directory exists
$logDir = [System.IO.Path]::GetDirectoryName($LogPath)
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
if (-not (Test-Path $LogPath)) { New-Item -ItemType File -Path $LogPath -Force | Out-Null }

function Start-Listener([int]$p) {
    try {
        $l = New-Object System.Net.HttpListener
        $l.Prefixes.Add("http://localhost:$p/")
        $l.Prefixes.Add("http://127.0.0.1:$p/")
        $l.Start()
        return $l
    } catch {
        return $null
    }
}

$listener = $null
for ($p = $Port; $p -le ($Port + 10); $p++) {
    $listener = Start-Listener -p $p
    if ($listener) { $Port = $p; break }
}
if (-not $listener) { Write-Error "No pude iniciar HttpListener en puertos $Port..$($Port+10). ¿Puerto ocupado o permisos?"; exit 1 }
Write-Host "ARKAIOS Monitor server running at http://localhost:$Port/" 

function Write-Response($context, $statusCode, $contentType, $content) {
    $context.Response.StatusCode = $statusCode
    $context.Response.ContentType = $contentType
    try { $context.Response.Headers.Add("Access-Control-Allow-Origin", "*") } catch {}
    try { $context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS") } catch {}
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
}

function Get-IndexHtml {
    @'
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ARKAIOS Action Monitor</title>
  <style>
    body { font-family: ui-sans-serif, system-ui; margin: 0; background:#0b1020; color:#eaf2ff; }
    header { padding: 12px 16px; background:#111832; position:sticky; top:0; }
    .tag { display:inline-block; margin-right:8px; padding:2px 8px; border-radius:999px; background:#1f2a48; font-size:12px; }
    #log { padding: 12px 16px; }
    .entry { padding:8px 12px; margin-bottom:6px; background:#121a33; border-left:3px solid #3b82f6; }
    .ts { color:#93c5fd; font-size:12px; }
    .evt { font-weight:600; }
    .payload { white-space: pre-wrap; font-family: ui-monospace, Menlo, Consolas, monospace; font-size:12px; color:#cbd5e1; }
  </style>
  <script>
    async function fetchLog() {
      const res = await fetch('/log');
      const txt = await res.text();
      const lines = txt.split('\n').filter(Boolean).slice(-200);
      const container = document.getElementById('log');
      container.innerHTML = '';
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const div = document.createElement('div');
          div.className = 'entry';
          const ts = new Date(obj.t || Date.now()).toLocaleTimeString();
          div.innerHTML = `<div class="ts">${ts}</div><div class="evt">${obj.event}</div><div class="payload">${JSON.stringify(obj.payload || {}, null, 2)}</div>`;
          container.appendChild(div);
        } catch {}
      }
    }
    setInterval(fetchLog, 1000);
    window.addEventListener('load', fetchLog);
  </script>
</head>
<body>
  <header>
    <span class="tag">ARKAIOS</span>
    <span class="tag">Monitor</span>
    <span class="tag" id="portTag">port: </span>
  </header>
  <div id="log"></div>
  <script>
    document.getElementById('portTag').textContent = 'port: ' + (location.port || '$Port');
  </script>
</body>
</html>
'@
}

while ($true) {
    try {
        $context = $listener.GetContext()
        if (-not $context) { continue }
        $request = $context.Request
        switch ($request.Url.AbsolutePath) {
            '/' {
                Write-Response $context 200 'text/html; charset=utf-8' (Get-IndexHtml)
            }
            '/log' {
                if (Test-Path $LogPath) {
                    $content = Get-Content -Path $LogPath -ErrorAction SilentlyContinue | Out-String
                    Write-Response $context 200 'text/plain; charset=utf-8' $content
                } else {
                    Write-Response $context 200 'text/plain; charset=utf-8' ''
                }
            }
            '/ingest' {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream)
                    $body = $reader.ReadToEnd()
                    if ($body -and $body.Trim().Length -gt 0) {
                        Add-Content -Path $LogPath -Value ($body + "`n")
                    }
                    Write-Response $context 200 'text/plain; charset=utf-8' 'ok'
                } catch {
                    Write-Response $context 500 'text/plain; charset=utf-8' "error: $($_.Exception.Message)"
                }
            }
            default {
                # OPTIONS preflight / otros paths
                if ($request.HttpMethod -eq 'OPTIONS') {
                    Write-Response $context 200 'text/plain; charset=utf-8' 'ok'
                } else {
                    Write-Response $context 404 'text/plain; charset=utf-8' 'not found'
                }
            }
        }
    } catch {
        Write-Warning ("Monitor server error: " + $_.Exception.Message)
        continue
    }
}

