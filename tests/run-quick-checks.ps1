# ============================================================================
#  Lutong Lokal — tests/run-quick-checks.ps1
#  A short smoke test used after each stage: every page still loads without
#  console errors, the shared navigation still works, and the pages that
#  changed in this stage still fit a phone screen.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File tests\run-quick-checks.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path -LiteralPath $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

$profileDir = Join-Path $env:TEMP ("lutong_q_" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
$debugPort = 9488
$baseUrl = ($root -replace "\\", "/")

$failures = New-Object System.Collections.ArrayList
$passes = 0
function Pass($msg) { $script:passes += 1; Write-Host "  PASS  $msg" -ForegroundColor Green }
function Fail($msg) { [void]$script:failures.Add($msg); Write-Host "  FAIL  $msg" -ForegroundColor Red }

$chrome = Start-Process -FilePath $chromePath -ArgumentList @(
  "--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check",
  "--remote-debugging-port=$debugPort","--user-data-dir=$profileDir",
  "--allow-file-access-from-files","--window-size=1440,900","about:blank"
) -PassThru -WindowStyle Hidden

try {
  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try { $null = Invoke-RestMethod -Uri "http://127.0.0.1:$debugPort/json/version" -TimeoutSec 3; $ready = $true; break } catch { }
  }
  if (-not $ready) { Write-Host "Chrome did not start." -ForegroundColor Red; exit 2 }

  $target = Invoke-RestMethod -Uri "http://127.0.0.1:$debugPort/json/new?about:blank" -Method Put -TimeoutSec 10
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  $script:id = 1

  function Send-Cdp($method, $params) {
    $id = $script:id; $script:id++
    $json = @{ id=$id; method=$method; params=$params } | ConvertTo-Json -Depth 14 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $seg = New-Object System.ArraySegment[byte] (,$bytes)
    $ws.SendAsync($seg,'Text',$true,[Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    while ($true) {
      $buf = New-Object byte[] 1048576; $ms = New-Object System.IO.MemoryStream
      do {
        $seg2 = New-Object System.ArraySegment[byte] (,$buf)
        $r = $ws.ReceiveAsync($seg2,[Threading.CancellationToken]::None).GetAwaiter().GetResult()
        if ($r.MessageType -eq 'Close') { return $null }
        $ms.Write($buf,0,$r.Count)
      } while (-not $r.EndOfMessage)
      $o = ([Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json)
      if ($o.id -eq $id) { return $o }
    }
  }

  function Eval($expression) {
    $r = Send-Cdp "Runtime.evaluate" @{ expression=$expression; returnByValue=$true }
    if ($r.result.exceptionDetails) { return "JS-ERROR: " + $r.result.exceptionDetails.text }
    return $r.result.result.value
  }

  Send-Cdp "Page.enable" @{} | Out-Null
  Send-Cdp "Runtime.enable" @{} | Out-Null
  $collector = "(function(){window.__e=[];window.addEventListener('error',function(e){window.__e.push(e.message);});window.addEventListener('unhandledrejection',function(e){window.__e.push(String(e.reason));});var oe=console.error;console.error=function(){window.__e.push('console.error: '+Array.prototype.join.call(arguments,' '));oe.apply(console,arguments);};})();"
  Send-Cdp "Page.addScriptToEvaluateOnNewDocument" @{ source=$collector } | Out-Null

  function Open-Page($fileName) {
    Send-Cdp "Page.navigate" @{ url="file:///$baseUrl/$fileName" } | Out-Null
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 250
      if ((Eval "document.readyState") -eq "complete") { break }
    }
    Start-Sleep -Milliseconds 500
  }

  function Set-Width([int]$width) {
    Send-Cdp "Emulation.setDeviceMetricsOverride" @{ width=$width; height=900; deviceScaleFactor=1; mobile=($width -lt 700) } | Out-Null
  }

  $pages = @("index.html","menu.html","cart.html","about.html","contact.html","login.html","register.html","dashboard.html","admin.html")

  Write-Host "`n=== 1. Every page loads with no console errors ===" -ForegroundColor Cyan
  Set-Width 1440
  foreach ($page in $pages) {
    Open-Page $page
    $errors = (Eval "JSON.stringify(window.__e || [])") | ConvertFrom-Json
    $navLinks = Eval "document.querySelectorAll('.primary-nav a[href]').length"
    $current = Eval @'
document.querySelectorAll('.primary-nav a[aria-current="page"]').length
'@
    if ($errors.Count -eq 0 -and $navLinks -eq 6 -and $current -eq 1) {
      Pass "$page loads cleanly with 6 nav links and 1 current-page marker"
    } else {
      Fail "${page}: errors=$($errors.Count) navLinks=$navLinks current=$current"
    }
  }

  Write-Host "`n=== 2. The pages changed in this stage fit a phone screen ===" -ForegroundColor Cyan
  foreach ($page in @("menu.html","cart.html")) {
    foreach ($width in @(390, 1440)) {
      Set-Width $width
      Open-Page $page
      $overflow = Eval "document.documentElement.scrollWidth - document.documentElement.clientWidth"
      if ($overflow -le 1) { Pass "$page at ${width}px has no horizontal scroll" }
      else { Fail "$page at ${width}px overflows by $overflow px" }
    }
  }

  Write-Host "`n=== 3. A filled cart still fits a phone screen ===" -ForegroundColor Cyan
  Set-Width 390
  Open-Page "cart.html"
  $filled = Eval @'
(function () {
  localStorage.setItem('lutonglokal.cart.v1', JSON.stringify([
    { itemId: 'm01', name: 'Chicken Adobo', price: 185, quantity: 2, image: '' },
    { itemId: 'm08', name: 'Pancit Bihon', price: 125, quantity: 1, image: '' }
  ]));
  return 'seeded';
})();
'@
  Open-Page "cart.html"
  $overflow = Eval "document.documentElement.scrollWidth - document.documentElement.clientWidth"
  $lines = Eval "document.querySelectorAll('#cart-lines .cart-line').length"
  if ($overflow -le 1) { Pass "A filled cart at 390px has no horizontal scroll" }
  else { Fail "A filled cart at 390px overflows by $overflow px" }
  if ($lines -eq 2) { Pass "A filled cart renders both lines at 390px" }
  else { Fail "A filled cart rendered $lines lines (expected 2)" }

  Write-Host "`n=== 4. The menu page controls are reachable at 390px ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  $controls = Eval @'
(function () {
  var search = document.getElementById('menu-search');
  var chips = document.querySelectorAll('#category-filters .chip');
  var firstChip = chips[0].getBoundingClientRect();
  var lastChip = chips[chips.length - 1].getBoundingClientRect();
  return JSON.stringify({
    searchVisible: search.getBoundingClientRect().width > 0,
    chipCount: chips.length,
    chipsWrap: lastChip.top > firstChip.top,
    chipsInsideWidth: lastChip.right <= window.innerWidth + 1
  });
})();
'@
  $controlResult = $controls | ConvertFrom-Json
  if ($controlResult.searchVisible -eq $true) { Pass "The search box is visible at 390px" }
  else { Fail "The search box is hidden at 390px" }
  if ($controlResult.chipCount -eq 7) { Pass "All 7 category filters are present at 390px" }
  else { Fail "Only $($controlResult.chipCount) category filters are present at 390px" }
  if ($controlResult.chipsWrap -eq $true) { Pass "The category filters wrap onto more than one line at 390px" }
  else { Fail "The category filters do not wrap at 390px" }
  if ($controlResult.chipsInsideWidth -eq $true) { Pass "The category filters stay inside the screen at 390px" }
  else { Fail "The category filters overflow the screen at 390px" }

  $ws.Dispose()
}
finally {
  try { if ($chrome -and -not $chrome.HasExited) { $chrome.Kill() } } catch { }
  try { if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue } } catch { }
}

Write-Host "`n============================================" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
  Write-Host "ALL QUICK CHECKS PASSED ($passes checks)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "FAILURES: $($failures.Count)   PASSES: $passes" -ForegroundColor Red
  foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
  exit 1
}
