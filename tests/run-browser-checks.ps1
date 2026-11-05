# ============================================================================
#  Lutong Lokal — tests/run-browser-checks.ps1
#  Real browser checks using headless Chrome over the DevTools Protocol.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File tests\run-browser-checks.ps1
#  Exit code 0 = all browser checks passed.
#
#  This script needs no npm packages. It drives the Chrome that is already
#  installed on the machine.
# ============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path -LiteralPath $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path -LiteralPath $chromePath)) {
  Write-Host "No Chrome or Edge found - browser checks cannot run." -ForegroundColor Red
  exit 2
}

$profileDir = Join-Path $env:TEMP ("lutong_browser_" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
$debugPort = 9333
$baseUrl = ($root -replace "\\", "/")

$failures = New-Object System.Collections.ArrayList
$passes = 0

function Pass($msg) { $script:passes += 1; Write-Host "  PASS  $msg" -ForegroundColor Green }
function Fail($msg) { [void]$script:failures.Add($msg); Write-Host "  FAIL  $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# DevTools Protocol helpers
# ---------------------------------------------------------------------------
function Receive-CdpMessage($ws) {
  $buffer = New-Object byte[] 1048576
  $memory = New-Object System.IO.MemoryStream
  do {
    $segment = New-Object System.ArraySegment[byte] (,$buffer)
    $result = $ws.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { return $null }
    $memory.Write($buffer, 0, $result.Count)
  } while (-not $result.EndOfMessage)
  return [Text.Encoding]::UTF8.GetString($memory.ToArray())
}

function Invoke-Cdp($ws, $idHolder, $method, $params) {
  $id = $idHolder.Value
  $idHolder.Value = $id + 1
  $payload = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 14 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $segment = New-Object System.ArraySegment[byte] (,$bytes)
  $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  while ($true) {
    $raw = Receive-CdpMessage $ws
    if ($null -eq $raw) { throw "DevTools connection closed" }
    $obj = $raw | ConvertFrom-Json
    if ($obj.id -eq $id) { return $obj }
  }
}

function Evaluate($ws, $idHolder, $expression) {
  $result = Invoke-Cdp $ws $idHolder "Runtime.evaluate" @{
    expression = $expression
    returnByValue = $true
    awaitPromise = $true
  }
  if ($result.result.exceptionDetails) {
    return @{ error = "JS exception: " + $result.result.exceptionDetails.text }
  }
  return $result.result.result.value
}

# ---------------------------------------------------------------------------
# Start Chrome
# ---------------------------------------------------------------------------
Write-Host "`n=== Starting headless Chrome ===" -ForegroundColor Cyan
$chromeArgs = @(
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=$debugPort",
  "--user-data-dir=$profileDir",
  "--allow-file-access-from-files",
  "--window-size=1440,900",
  "about:blank"
)
$chrome = Start-Process -FilePath $chromePath -ArgumentList $chromeArgs -PassThru

# Wait for the debugging endpoint to answer.
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$debugPort/json/version" -TimeoutSec 3
    $ready = $true
    break
  } catch { }
}
if (-not $ready) {
  Write-Host "Chrome DevTools endpoint did not come up." -ForegroundColor Red
  try { $chrome.Kill() } catch { }
  exit 2
}
Write-Host "  Chrome ready on port $debugPort" -ForegroundColor Green

$ws = $null
try {
  # Open a page target and attach to it.
  $target = Invoke-RestMethod -Uri "http://127.0.0.1:$debugPort/json/new?about:blank" -Method Put -TimeoutSec 10
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $idHolder = @{ Value = 1 }

  $null = Invoke-Cdp $ws $idHolder "Page.enable" @{}
  $null = Invoke-Cdp $ws $idHolder "Runtime.enable" @{}

  # Inject an error collector that runs BEFORE any page script, so nothing is missed.
  $collector = @'
(function () {
  window.__llErrors = [];
  window.addEventListener('error', function (e) {
    window.__llErrors.push('error: ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__llErrors.push('unhandledrejection: ' + String(e.reason));
  });
  var originalError = console.error;
  console.error = function () {
    window.__llErrors.push('console.error: ' + Array.prototype.join.call(arguments, ' '));
    originalError.apply(console, arguments);
  };
})();
'@
  $null = Invoke-Cdp $ws $idHolder "Page.addScriptToEvaluateOnNewDocument" @{ source = $collector }

  function Open-Page($fileName) {
    $url = "file:///$baseUrl/$fileName"
    $null = Invoke-Cdp $ws $idHolder "Page.navigate" @{ url = $url }
    for ($i = 0; $i -lt 60; $i++) {
      Start-Sleep -Milliseconds 250
      $state = Evaluate $ws $idHolder "document.readyState"
      if ($state -eq "complete") { break }
    }
    # Let images and deferred scripts settle.
    Start-Sleep -Milliseconds 700
  }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 1. Every page loads with no console errors ===" -ForegroundColor Cyan
  $pages = @("index.html","menu.html","cart.html","about.html","contact.html","login.html","register.html","dashboard.html","admin.html")
  foreach ($page in $pages) {
    Open-Page $page
    $errors = Evaluate $ws $idHolder "JSON.stringify(window.__llErrors || [])"
    $parsed = $errors | ConvertFrom-Json
    $title = Evaluate $ws $idHolder "document.title"
    $h1 = Evaluate $ws $idHolder "(document.querySelector('h1') || {}).textContent || ''"

    if ($parsed.Count -eq 0) { Pass "$page loads cleanly (title: '$title')" }
    else { Fail "$page produced console errors: $($parsed -join ' | ')" }

    if ([string]::IsNullOrWhiteSpace($title)) { Fail "$page has an empty document title" }
    if ([string]::IsNullOrWhiteSpace($h1)) { Fail "$page has no visible h1 heading" }
  }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 2. Shared navigation works on every page ===" -ForegroundColor Cyan
  foreach ($page in $pages) {
    Open-Page $page
    $navLinks = Evaluate $ws $idHolder "document.querySelectorAll('.primary-nav a[href]').length"
    $current = Evaluate $ws $idHolder @'
document.querySelectorAll('.primary-nav a[aria-current="page"]').length
'@
    $badge = Evaluate $ws $idHolder "(document.querySelector('[data-cart-count]') || {}).textContent || ''"

    if ($navLinks -eq 6) { Pass "$page shows all 6 main navigation links" }
    else { Fail "$page shows $navLinks navigation links (expected 6)" }

    if ($current -eq 1) { Pass "$page marks exactly one link as the current page" }
    else { Fail "$page marks $current links as current (expected 1)" }

    if ($badge -ne $null -and $badge -ne "") { Pass "$page shows a cart badge (value '$badge')" }
    else { Fail "$page has no cart badge value" }
  }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 3. Mobile navigation toggle opens and closes ===" -ForegroundColor Cyan
  Open-Page "index.html"
  $null = Invoke-Cdp $ws $idHolder "Emulation.setDeviceMetricsOverride" @{
    width = 390; height = 844; deviceScaleFactor = 1; mobile = $true
  }
  Start-Sleep -Milliseconds 400
  $toggleVisible = Evaluate $ws $idHolder "(function(){var b=document.getElementById('nav-toggle');return b ? getComputedStyle(b).display !== 'none' : false;})()"
  if ($toggleVisible -eq $true) { Pass "Navigation toggle is visible at 390px width" }
  else { Fail "Navigation toggle is hidden at 390px width" }

  $opened = Evaluate $ws $idHolder "(function(){var b=document.getElementById('nav-toggle');b.click();var n=document.getElementById('primary-nav');return n.classList.contains('is-open') && b.getAttribute('aria-expanded')==='true';})()"
  if ($opened -eq $true) { Pass "Clicking the toggle opens the menu and sets aria-expanded" }
  else { Fail "Clicking the toggle did not open the menu" }

  $closed = Evaluate $ws $idHolder "(function(){var b=document.getElementById('nav-toggle');b.click();var n=document.getElementById('primary-nav');return !n.classList.contains('is-open') && b.getAttribute('aria-expanded')==='false';})()"
  if ($closed -eq $true) { Pass "Clicking the toggle again closes the menu" }
  else { Fail "Clicking the toggle again did not close the menu" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 4. Contact form validation ===" -ForegroundColor Cyan
  Open-Page "contact.html"

  $empty = Evaluate $ws $idHolder @'
(function () {
  var form = document.getElementById('contact-form');
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var status = document.getElementById('contact-status');
  var nameError = document.getElementById('contact-name-error');
  return JSON.stringify({
    statusHidden: status.hidden,
    statusKind: status.className,
    nameErrorShown: !nameError.hidden,
    nameErrorText: nameError.textContent,
    invalidFlag: document.getElementById('contact-name').getAttribute('aria-invalid')
  });
})();
'@
  $emptyResult = $empty | ConvertFrom-Json
  if ($emptyResult.statusHidden -eq $false -and $emptyResult.statusKind -like "*alert-error*") { Pass "Empty contact form shows an error message" }
  else { Fail "Empty contact form did not show an error message" }
  if ($emptyResult.nameErrorShown -eq $true -and -not [string]::IsNullOrWhiteSpace($emptyResult.nameErrorText)) { Pass "Empty contact form shows a field error: '$($emptyResult.nameErrorText)'" }
  else { Fail "Empty contact form did not show a field error" }
  if ($emptyResult.invalidFlag -eq "true") { Pass "Invalid field is marked aria-invalid" }
  else { Fail "Invalid field is not marked aria-invalid" }

  $badEmail = Evaluate $ws $idHolder @'
(function () {
  document.getElementById('contact-name').value = 'Maria Santos';
  document.getElementById('contact-email').value = 'not-an-email';
  document.getElementById('contact-subject').value = 'General enquiry';
  document.getElementById('contact-message').value = 'I would like to ask about a large order.';
  var form = document.getElementById('contact-form');
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var status = document.getElementById('contact-status');
  var emailError = document.getElementById('contact-email-error');
  return JSON.stringify({
    statusKind: status.className,
    emailErrorText: emailError.textContent,
    emailErrorShown: !emailError.hidden
  });
})();
'@
  $badResult = $badEmail | ConvertFrom-Json
  if ($badResult.emailErrorShown -eq $true -and $badResult.emailErrorText -like "*valid email*") { Pass "Invalid email format is rejected: '$($badResult.emailErrorText)'" }
  else { Fail "Invalid email format was not rejected (message: '$($badResult.emailErrorText)')" }

  $good = Evaluate $ws $idHolder @'
(function () {
  document.getElementById('contact-name').value = 'Maria Santos';
  document.getElementById('contact-email').value = 'maria@example.com';
  document.getElementById('contact-subject').value = 'General enquiry';
  document.getElementById('contact-message').value = 'I would like to ask about a large order for a party.';
  var form = document.getElementById('contact-form');
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var status = document.getElementById('contact-status');
  return JSON.stringify({
    statusHidden: status.hidden,
    statusKind: status.className,
    statusText: status.textContent,
    nameCleared: document.getElementById('contact-name').value === '',
    errors: Array.prototype.map.call(document.querySelectorAll('.field-error'), function (e) { return e.textContent; }).filter(function (t) { return t.length > 0; })
  });
})();
'@
  $goodResult = $good | ConvertFrom-Json
  if ($goodResult.statusHidden -eq $false -and $goodResult.statusKind -like "*alert-success*") { Pass "Valid contact form shows a success message" }
  else { Fail "Valid contact form did not show a success message" }
  if ($goodResult.statusText -like "*does not send real emails*") { Pass "Success message states that no real email is sent" }
  else { Fail "Success message does not state that no email is sent. Text: '$($goodResult.statusText)'" }
  if ($goodResult.errors.Count -eq 0) { Pass "No field errors remain after a successful submit" }
  else { Fail "Field errors remain after submit: $($goodResult.errors -join ' | ')" }
  if ($goodResult.nameCleared -eq $true) { Pass "Form is cleared after a successful submit" }
  else { Fail "Form was not cleared after a successful submit" }

  # The message must be stored locally, and the page must say so honestly.
  $stored = Evaluate $ws $idHolder "JSON.stringify((JSON.parse(localStorage.getItem('lutonglokal.messages.v1')||'[]')).length)"
  if ($stored -eq "1") { Pass "Valid message was stored in local browser storage" }
  else { Fail "Expected 1 stored message but found $stored" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 5. Home page renders menu data from storage ===" -ForegroundColor Cyan
  Open-Page "index.html"
  $cards = Evaluate $ws $idHolder "document.querySelectorAll('#featured-grid .card').length"
  if ($cards -ge 1) { Pass "Home page rendered $cards featured drink cards from the menu data" }
  else { Fail "Home page rendered no featured drink cards" }

  $storedMenu = Evaluate $ws $idHolder "JSON.stringify((JSON.parse(localStorage.getItem('lutonglokal.menu.v1')||'[]')).length)"
  if ($storedMenu -eq "10") { Pass "Menu seeded all 10 supplied drinks into local storage" }
  else { Fail "Expected 10 supplied drinks but found $storedMenu" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 6. Menu page lists every supplied drink ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  $menuCards = Evaluate $ws $idHolder "document.querySelectorAll('#menu-grid .card').length"
  if ($menuCards -eq 10) { Pass "Menu page lists all 10 drinks" }
  else { Fail "Menu page lists $menuCards drinks (expected 10)" }

  $soldOut = Evaluate $ws $idHolder "document.querySelectorAll('#menu-grid .badge-soldout').length"
  if ($soldOut -eq 0) { Pass "All 10 supplied drinks are available" }
  else { Fail "Menu page unexpectedly marks $soldOut drinks as sold out" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 7. Reloading a page does not break it ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  Open-Page "menu.html"
  $afterReload = Evaluate $ws $idHolder "document.querySelectorAll('#menu-grid .card').length"
  $reloadErrors = Evaluate $ws $idHolder "JSON.stringify(window.__llErrors || [])"
  $reloadParsed = $reloadErrors | ConvertFrom-Json
  if ($afterReload -eq 10 -and $reloadParsed.Count -eq 0) { Pass "Reloading the menu page twice still works with no errors" }
  else { Fail "Reload problem: $afterReload cards, errors: $($reloadParsed -join ' | ')" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 8. Corrupt stored data is handled gracefully ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  $corrupt = Evaluate $ws $idHolder @'
(function () {
  localStorage.setItem('lutonglokal.menu.v1', '{ this is not valid json');
  localStorage.setItem('lutonglokal.orders.v1', '[{"id":"x","items":"nonsense"}]');
  localStorage.setItem('lutonglokal.cart.v1', 'null');
  return 'seeded';
})();
'@
  Open-Page "menu.html"
  $corruptErrors = Evaluate $ws $idHolder "JSON.stringify(window.__llErrors || [])"
  $corruptParsed = $corruptErrors | ConvertFrom-Json
  $corruptCards = Evaluate $ws $idHolder "document.querySelectorAll('#menu-grid .card').length"
  if ($corruptParsed.Count -eq 0) { Pass "Corrupt stored data does not throw any errors" }
  else { Fail "Corrupt stored data produced errors: $($corruptParsed -join ' | ')" }
  if ($corruptCards -eq 10) { Pass "Menu page rebuilt the menu from seed data after corruption" }
  else { Fail "Menu page shows $corruptCards cards after corruption (expected 10)" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 9. Screenshots at phone and desktop widths ===" -ForegroundColor Cyan
  $shots = @(
    @{ page = "index.html"; width = 390;  height = 844;  name = "index-mobile" },
    @{ page = "index.html"; width = 1440; height = 900;  name = "index-desktop" },
    @{ page = "menu.html";  width = 390;  height = 844;  name = "menu-mobile" },
    @{ page = "menu.html";  width = 1440; height = 900;  name = "menu-desktop" },
    @{ page = "contact.html"; width = 390; height = 844; name = "contact-mobile" },
    @{ page = "about.html"; width = 1440; height = 900;  name = "about-desktop" },
    @{ page = "admin.html"; width = 1440; height = 900;  name = "admin-desktop" }
  )
  $shotDir = Join-Path $PSScriptRoot "screenshots"
  if (-not (Test-Path -LiteralPath $shotDir)) { New-Item -ItemType Directory -Path $shotDir | Out-Null }

  foreach ($shot in $shots) {
    $null = Invoke-Cdp $ws $idHolder "Emulation.setDeviceMetricsOverride" @{
      width = $shot.width; height = $shot.height; deviceScaleFactor = 1; mobile = ($shot.width -lt 700)
    }
    Open-Page $shot.page
    $capture = Invoke-Cdp $ws $idHolder "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $true }
    $file = Join-Path $shotDir ($shot.name + ".png")
    [System.IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($capture.result.data))
    if ((Get-Item -LiteralPath $file).Length -gt 1000) { Pass "Captured $($shot.name) ($($shot.width)x$($shot.height))" }
    else { Fail "Screenshot $($shot.name) was empty" }
  }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 10. Admin page keeps staff features visually separate ===" -ForegroundColor Cyan
  Open-Page "admin.html"
  $banner = Evaluate $ws $idHolder "(function(){var b=document.querySelector('.alert-warning');return b ? b.textContent.indexOf('Staff access is controlled in the browser') !== -1 : false;})()"
  if ($banner -eq $true) { Pass "Admin page explains that staff access is browser-local" }
  else { Fail "Admin page is missing its staff-access limitation notice" }
  $warn = Evaluate $ws $idHolder "(function(){var a=document.querySelector('.alert-warning');return a ? a.textContent.indexOf('does not grant you access') !== -1 : false;})()"
  if ($warn -eq $true) { Pass "Admin page warns that opening it does not grant access" }
  else { Fail "Admin page is missing the 'does not grant access' warning" }

  Open-Page "index.html"
  $noBanner = Evaluate $ws $idHolder "document.querySelectorAll('.admin-banner').length"
  if ($noBanner -eq 0) { Pass "Customer pages do not show an admin banner" }
  else { Fail "Customer pages show the admin banner" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 11. Images load in the browser or fall back cleanly ===" -ForegroundColor Cyan
  $imagePages = @("index.html","menu.html","about.html")
  foreach ($page in $imagePages) {
    Open-Page $page
    # Scroll through the page so lazy-loaded photos are requested, then
    # give the network time to deliver them. The scroll position stays at the
    # bottom on purpose: scrolling back up would cancel the pending lazy loads.
    $null = Evaluate $ws $idHolder @'
(function () {
  var step = window.innerHeight;
  for (var y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
  }
  window.scrollTo(0, document.body.scrollHeight);
  return 'scrolled';
})();
'@
    for ($i = 0; $i -lt 40; $i++) {
      Start-Sleep -Milliseconds 400
      $pending = Evaluate $ws $idHolder @'
(function () {
  var imgs = Array.prototype.slice.call(document.querySelectorAll('img[data-fallback-text]'));
  var stillLoading = imgs.filter(function (i) { return !i.complete; }).length;
  return stillLoading;
})();
'@
      if ($pending -eq 0) { break }
    }
    Start-Sleep -Milliseconds 1500

    $imageStats = Evaluate $ws $idHolder @'
(function () {
  var imgs = Array.prototype.slice.call(document.querySelectorAll('img[data-fallback-text]'));
  var loaded = 0, fellBack = 0, broken = 0, noAlt = 0, pending = 0;
  imgs.forEach(function (i) {
    if (!i.alt) { noAlt += 1; }
    if (i.hidden) {
      // The fallback panel was shown instead of the photo.
      fellBack += 1;
    } else if (!i.complete) {
      pending += 1;
    } else if (i.naturalWidth > 0) {
      loaded += 1;
    } else {
      broken += 1;
    }
  });
  return JSON.stringify({ total: imgs.length, loaded: loaded, fellBack: fellBack, broken: broken, noAlt: noAlt, pending: pending });
})();
'@
    $stats = $imageStats | ConvertFrom-Json
    if ($stats.broken -eq 0) { Pass "$page : all $($stats.total) photos either loaded ($($stats.loaded)) or showed the fallback ($($stats.fellBack)), none broken" }
    else { Fail "$page : $($stats.broken) photo(s) failed without a fallback panel" }
    if ($stats.pending -eq 0) { Pass "$page : every photo finished loading" }
    else { Fail "$page : $($stats.pending) photo(s) never finished loading" }
    if ($stats.noAlt -eq 0) { Pass "$page : every photo has an alt attribute" }
    else { Fail "$page : $($stats.noAlt) photo(s) missing alt text" }
    if ($stats.loaded -gt 0) { Pass "$page : $($stats.loaded) local or remote photo(s) actually rendered" }
    else { Fail "$page : no photo rendered" }
  }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 12. No horizontal overflow at phone or desktop width ===" -ForegroundColor Cyan
  foreach ($page in $pages) {
    foreach ($width in @(390, 768, 1440)) {
      $null = Invoke-Cdp $ws $idHolder "Emulation.setDeviceMetricsOverride" @{
        width = $width; height = 900; deviceScaleFactor = 1; mobile = ($width -lt 700)
      }
      Open-Page $page
      $overflow = Evaluate $ws $idHolder @'
(function () {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth;
})();
'@
      if ($overflow -le 1) { Pass "$page at ${width}px has no horizontal scroll (overflow $overflow px)" }
      else { Fail "$page at ${width}px overflows horizontally by $overflow px" }
    }
  }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 13. Interactive controls are large enough to tap ===" -ForegroundColor Cyan
  $null = Invoke-Cdp $ws $idHolder "Emulation.setDeviceMetricsOverride" @{
    width = 390; height = 844; deviceScaleFactor = 1; mobile = $true
  }
  foreach ($page in @("index.html","menu.html","contact.html","login.html")) {
    Open-Page $page
    $small = Evaluate $ws $idHolder @'
(function () {
  var selector = 'a[href], button, input, select, textarea';
  var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
  var tiny = [];
  nodes.forEach(function (n) {
    if (n.hidden || n.offsetParent === null) { return; }
    var r = n.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { return; }
    // Links inside a paragraph of text are allowed to be small.
    if (n.tagName === 'A' && n.closest('p, li, .footer-list, .breadcrumb')) { return; }
    if (r.height < 24 || r.width < 24) {
      tiny.push(n.tagName + '(' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
    }
  });
  return JSON.stringify(tiny);
})();
'@
    $tinyList = $small | ConvertFrom-Json
    if ($tinyList.Count -eq 0) { Pass "$page : all buttons and form controls are at least 24x24 px" }
    else { Fail "$page : small controls found: $($tinyList -join ', ')" }
  }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 14. Grid columns adapt to the viewport ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  $null = Invoke-Cdp $ws $idHolder "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false }
  Open-Page "menu.html"
  $wideCols = Evaluate $ws $idHolder @'
(function () {
  var grid = document.getElementById('menu-grid');
  var cards = grid.querySelectorAll('.card');
  var firstTop = cards[0].getBoundingClientRect().top;
  var count = 0;
  Array.prototype.forEach.call(cards, function (c) {
    if (Math.abs(c.getBoundingClientRect().top - firstTop) < 2) { count += 1; }
  });
  return count;
})();
'@
  if ($wideCols -ge 3) { Pass "Menu grid shows $wideCols columns at 1440px" }
  else { Fail "Menu grid shows only $wideCols columns at 1440px" }

  $null = Invoke-Cdp $ws $idHolder "Emulation.setDeviceMetricsOverride" @{ width = 390; height = 844; deviceScaleFactor = 1; mobile = $true }
  Open-Page "menu.html"
  $narrowCols = Evaluate $ws $idHolder @'
(function () {
  var grid = document.getElementById('menu-grid');
  var cards = grid.querySelectorAll('.card');
  var firstTop = cards[0].getBoundingClientRect().top;
  var count = 0;
  Array.prototype.forEach.call(cards, function (c) {
    if (Math.abs(c.getBoundingClientRect().top - firstTop) < 2) { count += 1; }
  });
  return count;
})();
'@
  if ($narrowCols -eq 1) { Pass "Menu grid collapses to 1 column at 390px" }
  else { Fail "Menu grid shows $narrowCols columns at 390px (expected 1)" }

  # -------------------------------------------------------------------------
  Write-Host "`n=== 15. The coffee menu, cart sizes, and pickup order stay connected ===" -ForegroundColor Cyan
  $null = Invoke-Cdp $ws $idHolder "Emulation.setDeviceMetricsOverride" @{ width = 1440; height = 900; deviceScaleFactor = 1; mobile = $false }
  Open-Page "menu.html"
  Evaluate $ws $idHolder "localStorage.clear(); sessionStorage.clear(); 'cleared'" | Out-Null
  Open-Page "menu.html"

  $menuData = Evaluate $ws $idHolder @'
(function () {
  var menu = lutongGetMenu();
  var expected = [
    ['Caramel Macchiato', 'coffee', 39, 49],
    ['Spanish Latte', 'coffee', 39, 49],
    ['Strawberry Latte', 'coffee', 49, 59],
    ['Matcha Latte', 'coffee', 49, 59],
    ['Cappuccino', 'coffee', 49, 59],
    ['Taro', 'non-coffee', 49, 59],
    ['Creamy Matcha', 'non-coffee', 49, 59],
    ['Creamy Strawberry', 'non-coffee', 49, 59],
    ['Matcha Strawberry', 'non-coffee', 49, 59],
    ['Dark Choco', 'non-coffee', 49, 59]
  ];
  var actual = menu.map(function (item) {
    return [item.name, item.category, item.priceMedium, item.priceLarge];
  });
  return JSON.stringify({
    matches: JSON.stringify(actual) === JSON.stringify(expected),
    count: menu.length,
    groups: Array.prototype.map.call(document.querySelectorAll('#menu-grid > .menu-category'), function (section) {
      return { name: section.querySelector('h2').textContent, count: section.querySelectorAll('.card').length };
    })
  });
})();
'@
  $menuDataResult = $menuData | ConvertFrom-Json
  if ($menuDataResult.matches -eq $true -and $menuDataResult.count -eq 10) {
    Pass "All 10 drinks have the specified category and Medium/Large prices"
  } else {
    Fail "Menu data did not match the supplied ten drinks and prices"
  }
  if ($menuDataResult.groups.Count -eq 2 -and $menuDataResult.groups[0].name -eq "Coffee" -and $menuDataResult.groups[0].count -eq 5 -and $menuDataResult.groups[1].name -eq "Non-Coffee" -and $menuDataResult.groups[1].count -eq 5) {
    Pass "Menu cards are grouped into Coffee (5) and Non-Coffee (5)"
  } else {
    Fail "Menu category grouping was not Coffee (5) and Non-Coffee (5)"
  }

  $imageEvidence = Evaluate $ws $idHolder @'
(function () {
  var images = Array.prototype.slice.call(document.querySelectorAll('#menu-grid img.card-img'));
  images.forEach(function (image) { image.loading = 'eager'; });
  return images.length;
})();
'@
  Start-Sleep -Milliseconds 1500
  $imageResult = Evaluate $ws $idHolder @'
(function () {
  var images = Array.prototype.slice.call(document.querySelectorAll('#menu-grid img.card-img'));
  return JSON.stringify({
    count: images.length,
    loaded: images.filter(function (image) { return image.complete && image.naturalWidth > 0; }).length,
    paths: images.map(function (image) { return image.getAttribute('src'); })
  });
})();
'@
  $images = $imageResult | ConvertFrom-Json
  if ($images.count -eq 10 -and $images.loaded -eq 10) { Pass "All 10 individual drink crops load with working paths" }
  else { Fail "Only $($images.loaded) of $($images.count) drink crops loaded" }

  $added = Evaluate $ws $idHolder @'
(function () {
  var card = document.getElementById('item-c01');
  var size = card.querySelector('[data-size-select]');
  var button = card.querySelector('[data-add-item]');
  size.value = 'medium';
  button.click();
  size.value = 'large';
  button.click();
  return JSON.stringify(lutongGetCart().map(function (line) {
    return { name: line.name, size: line.size, price: line.price, quantity: line.quantity };
  }));
})();
'@
  $addedResult = $added | ConvertFrom-Json
  if ($addedResult.Count -eq 2 -and $addedResult[0].size -eq "medium" -and $addedResult[0].price -eq 39 -and $addedResult[1].size -eq "large" -and $addedResult[1].price -eq 49) {
    Pass "Adding Medium and Large Caramel Macchiato stores the correct variants and prices"
  } else {
    Fail "Medium/Large cart variants were not saved with the correct prices"
  }

  Open-Page "cart.html"
  $cartEvidence = Evaluate $ws $idHolder @'
(function () {
  var note = document.getElementById('order-note');
  var summary = document.querySelector('#cart-summary .summary-row.total');
  return JSON.stringify({
    lines: Array.prototype.map.call(document.querySelectorAll('#cart-lines .cart-line'), function (line) {
      return line.querySelector('.cart-line-name').textContent;
    }),
    total: summary ? summary.textContent : '',
    noteOptional: !note.required,
    noteMax: note.maxLength,
    noteLabel: document.querySelector('label[for="order-note"]').textContent.trim(),
    noteHint: document.getElementById('order-note-hint').textContent.trim(),
    notePlaceholder: note.placeholder
  });
})();
'@
  $cartResult = $cartEvidence | ConvertFrom-Json
  if ($cartResult.lines.Count -eq 2 -and $cartResult.lines[0] -like "*Medium" -and $cartResult.lines[1] -like "*Large" -and $cartResult.total -like "*88.00*") {
    Pass "Cart displays both sizes and totals ₱88.00"
  } else {
    Fail "Cart variant lines or total are incorrect: $($cartResult.total)"
  }
  if ($cartResult.noteOptional -eq $true -and $cartResult.noteMax -eq 400 -and $cartResult.noteLabel -eq "Order Note (Optional)" -and $cartResult.noteHint -eq "Add any special requests for your drink." -and $cartResult.notePlaceholder -eq "e.g., less ice or less sugar, if available") {
    Pass "Order note is optional, capped at 400, and uses the requested drink wording"
  } else {
    Fail "Order note field does not match the requested label, help, example, or limit"
  }

  $placed = Evaluate $ws $idHolder @'
(function () {
  document.getElementById('order-name').value = 'Maria Santos';
  document.getElementById('order-email').value = 'maria@example.com';
  document.getElementById('order-phone').value = '09175550142';
  document.getElementById('order-pickup-time').value = 'In about 30 minutes';
  document.getElementById('order-note').value = 'Less ice, please.';
  document.getElementById('order-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var order = JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]')[0];
  return JSON.stringify({
    order: order,
    cartCount: lutongGetCart().length,
    success: document.getElementById('order-success').textContent
  });
})();
'@
  $placedResult = $placed | ConvertFrom-Json
  if ($placedResult.order.total -eq 88 -and $placedResult.order.items.Count -eq 2 -and $placedResult.order.items[0].size -eq "medium" -and $placedResult.order.items[1].size -eq "large") {
    Pass "Order submission preserves both drink sizes and the ₱88 total"
  } else {
    Fail "Submitted order did not preserve its selected variants and total"
  }
  if ($placedResult.order.pickupNote -eq "Less ice, please." -and $placedResult.order.pickupTime -eq "In about 30 minutes" -and $placedResult.order.phone -eq "09175550142" -and $placedResult.order.contactEmail -eq "maria@example.com" -and $placedResult.cartCount -eq 0) {
    Pass "Pickup time, customer details, note, and cart-clearing behavior are saved"
  } else {
    Fail "Pickup details/note were not saved correctly or the cart was not cleared"
  }

  Open-Page "dashboard.html"
  $dashboardOrder = Evaluate $ws $idHolder "document.getElementById('dashboard-guest-orders').textContent"
  if ($dashboardOrder -like "*Medium*" -and $dashboardOrder -like "*Large*" -and $dashboardOrder -like "*Less ice, please.*" -and $dashboardOrder -like "*In about 30 minutes*") {
    Pass "Customer dashboard shows drink sizes, note, and pickup time"
  } else {
    Fail "Customer dashboard omitted order sizes or pickup details"
  }

  Evaluate $ws $idHolder @'
localStorage.setItem('lutonglokal.session.v1', JSON.stringify({
  username: 'admin', displayName: 'Demo Administrator', email: 'admin@lutonglokal.test',
  role: 'admin', loginAt: new Date().toISOString(), isNew: false
}));
'@ | Out-Null
  Open-Page "admin.html"
  $adminOrder = Evaluate $ws $idHolder "document.querySelector('#admin-orders-table tbody tr[data-order-row]').textContent"
  if ($adminOrder -like "*Medium*" -and $adminOrder -like "*Large*" -and $adminOrder -like "*Less ice, please.*" -and $adminOrder -like "*In about 30 minutes*") {
    Pass "Admin order management shows drink sizes, note, and pickup time"
  } else {
    Fail "Admin order management omitted order sizes or pickup details"
  }

  Open-Page "index.html"
  $recommendations = Evaluate $ws $idHolder @'
(function () {
  var menu = lutongGetMenu();
  var links = Array.prototype.slice.call(document.querySelectorAll('#featured-grid a[href^="menu.html#item-"]'));
  return JSON.stringify({
    count: links.length,
    valid: links.length > 0 && links.every(function (link) {
      var id = link.getAttribute('href').split('#item-')[1];
      return menu.some(function (item) { return item.id === id; });
    }),
    names: Array.prototype.map.call(document.querySelectorAll('#featured-grid .card-title'), function (title) { return title.textContent; })
  });
})();
'@
  $recommendationResult = $recommendations | ConvertFrom-Json
  if ($recommendationResult.valid -eq $true -and $recommendationResult.count -gt 0) {
    Pass "Homepage recommendations link to products in the shared menu data"
  } else {
    Fail "Homepage recommendations do not link to the shared menu items"
  }
}
finally {
  if ($ws -ne $null) { try { $ws.Dispose() } catch { } }
  try { if ($chrome -ne $null -and -not $chrome.HasExited) { $chrome.Kill() } } catch { }
  try { if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue } } catch { }
}

Write-Host "`n============================================" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
  Write-Host "ALL BROWSER CHECKS PASSED ($passes checks)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "FAILURES: $($failures.Count)   PASSES: $passes" -ForegroundColor Red
  foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
  exit 1
}
