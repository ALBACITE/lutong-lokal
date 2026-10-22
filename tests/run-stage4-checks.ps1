# ============================================================================
#  Lutong Lokal - tests/run-stage4-checks.ps1
#  Stage 4 checks: demo sign-in, demo registration, the user dashboard and
#  the admin demo area (menu management, availability and order statuses).
#
#  Usage:  powershell -ExecutionPolicy Bypass -File tests\run-stage4-checks.ps1
#
#  The script drives a headless Chrome over the DevTools protocol, exactly
#  like tests\run-quick-checks.ps1, so the real pages are exercised.
# ============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path -LiteralPath $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

$profileDir = Join-Path $env:TEMP ("lutong_s4_" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
$debugPort = 9491
$baseUrl = ($root -replace "\\", "/")

$failures = New-Object System.Collections.ArrayList
$passes = 0
function Pass($msg) { $script:passes += 1; Write-Host "  PASS  $msg" -ForegroundColor Green }
function Fail($msg) { [void]$script:failures.Add($msg); Write-Host "  FAIL  $msg" -ForegroundColor Red }
function Check($condition, $ok, $bad) {
  if ($condition) { Pass $ok } else { Fail $bad }
}

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
    if ($r.result.exceptionDetails) {
      $details = $r.result.exceptionDetails
      $extra = ""
      if ($details.exception -and $details.exception.description) { $extra = $details.exception.description }
      return "JS-ERROR: " + $details.text + " :: " + $extra
    }
    return $r.result.result.value
  }

  function Wait-For($expression, $timeoutMs) {
    $limit = if ($timeoutMs) { $timeoutMs } else { 8000 }
    $waited = 0
    while ($waited -lt $limit) {
      $value = Eval $expression
      if ($value -eq $true) { return $true }
      Start-Sleep -Milliseconds 150
      $waited += 150
    }
    return $false
  }

  Send-Cdp "Page.enable" @{} | Out-Null
  Send-Cdp "Runtime.enable" @{} | Out-Null
  $collector = "(function(){window.__e=[];window.addEventListener('error',function(e){window.__e.push(e.message);});window.addEventListener('unhandledrejection',function(e){window.__e.push(String(e.reason));});var oe=console.error;console.error=function(){window.__e.push('console.error: '+Array.prototype.join.call(arguments,' '));oe.apply(console,arguments);};})();"
  Send-Cdp "Page.addScriptToEvaluateOnNewDocument" @{ source=$collector } | Out-Null

  # Opens a page and waits until the NEW document is really loaded.
  # Checking document.readyState alone is not enough: right after
  # Page.navigate the old document is still complete, so the check has to
  # look at the address bar as well.
  function Open-Page($fileName) {
    Send-Cdp "Page.navigate" @{ url="file:///$baseUrl/$fileName" } | Out-Null
    for ($i = 0; $i -lt 80; $i++) {
      Start-Sleep -Milliseconds 200
      $where = Eval "document.location.pathname"
      $state = Eval "document.readyState"
      $hasMain = Eval "document.getElementById('main') !== null"
      if (("$where" -like "*$fileName") -and $state -eq "complete" -and $hasMain -eq $true) { break }
    }
    Start-Sleep -Milliseconds 400
  }

  # Starts a clean browser profile with no demo data at all.
  function Reset-Demo {
    Open-Page "index.html"
    Eval "localStorage.clear(); 'cleared'" | Out-Null
  }

  # Fills the sign-in form on the current page and presses the button.
  function Do-Login($username, $email, $passcode) {
    Eval @"
(function () {
  document.getElementById('login-username').value = '$username';
  document.getElementById('login-email').value = '$email';
  document.getElementById('login-passcode').value = '$passcode';
  document.getElementById('login-form').requestSubmit();
  return 'submitted';
})();
"@ | Out-Null
  }

  function Do-Register($name, $username, $email) {
    Eval @"
(function () {
  document.getElementById('register-name').value = '$name';
  document.getElementById('register-username').value = '$username';
  document.getElementById('register-email').value = '$email';
  document.getElementById('register-form').requestSubmit();
  return 'submitted';
})();
"@ | Out-Null
  }

  Write-Host "`n=== 1. The Stage 4 pages load with no console errors ===" -ForegroundColor Cyan
  foreach ($page in @("login.html","register.html","dashboard.html","admin.html")) {
    Reset-Demo | Out-Null
    Open-Page $page
    $errors = (Eval "JSON.stringify(window.__e || [])") | ConvertFrom-Json
    if ($errors.Count -eq 0) { Pass "$page loads with no console errors" }
    else { Fail "$page logged errors: $($errors -join '; ')" }
  }

  Write-Host "`n=== 2. The sign-in form checks the demo passcode ===" -ForegroundColor Cyan
  Reset-Demo | Out-Null
  Open-Page "login.html"
  Do-Login "demo" "demo@lutonglokal.test" "wrongpass"
  Start-Sleep -Milliseconds 400
  $statusText = Eval "document.getElementById('login-status').textContent"
  $sessionAfterFail = Eval "localStorage.getItem('lutonglokal.session.v1')"
  Check ($statusText -like "*not correct*") "A wrong passcode shows a clear error message" "Wrong passcode message was: $statusText"
  Check (-not $sessionAfterFail) "A wrong passcode does not create a session" "A session was created even though the passcode was wrong"
  Check ((Eval "document.querySelector('#login-passcode-error').hidden") -eq $false) "The passcode field is marked as having an error" "The passcode error message is not shown"

  Write-Host "`n=== 3. Signing in as the demo customer works ===" -ForegroundColor Cyan
  Reset-Demo | Out-Null
  Open-Page "login.html"
  Do-Login "demo" "demo@lutonglokal.test" "demo123"
  $redirected = Wait-For "location.pathname.indexOf('dashboard.html') !== -1" 6000
  Check $redirected "Signing in as the customer lands on the dashboard" "Signing in did not reach dashboard.html"
  $session = (Eval "localStorage.getItem('lutonglokal.session.v1')") | ConvertFrom-Json
  Check ($session.username -eq "demo") "The session keeps the username" "Session username was: $($session.username)"
  Check ($session.role -eq "user") "The customer session has the user role" "Session role was: $($session.role)"
  Check ($session.displayName -eq "Demo Customer") "The session keeps the display name" "Session display name was: $($session.displayName)"

  Write-Host "`n=== 4. The customer dashboard shows the account and the orders ===" -ForegroundColor Cyan
  Open-Page "dashboard.html"
  $signedIn = Eval "document.getElementById('dashboard-signed-in').hidden"
  $signedOut = Eval "document.getElementById('dashboard-signed-out').hidden"
  $shownName = Eval "document.getElementById('account-display-name').textContent"
  $shownUser = Eval "document.getElementById('account-username').textContent"
  Check ($signedIn -eq $false) "The signed-in panel is shown on the dashboard" "The signed-in panel stayed hidden"
  Check ($signedOut -eq $true) "The signed-out panel is hidden on the dashboard" "The signed-out panel is still shown"
  Check ($shownName -eq "Demo Customer") "The dashboard shows the display name" "Dashboard display name was: $shownName"
  Check ($shownUser -eq "demo") "The dashboard shows the username" "Dashboard username was: $shownUser"

  Eval @'
(function () {
  var order = {
    id: 'LL-20260101-TEST',
    createdAt: '2026-01-01T09:30:00.000Z',
    ownerUsername: 'demo',
    customerName: 'Demo Customer',
    contactEmail: 'demo@lutonglokal.test',
    phone: '0917 000 0000',
    pickupTime: 'As soon as possible',
    pickupNote: 'Extra sauce please',
    items: [{ name: 'Chicken Adobo', price: 185, quantity: 2, lineTotal: 370 }],
    subtotal: 370,
    itemCount: 2,
    total: 370,
    status: 'Pending'
  };
  localStorage.setItem('lutonglokal.orders.v1', JSON.stringify([order]));
  return 'seeded';
})();
'@ | Out-Null
  Open-Page "dashboard.html"
  $cards = Eval "document.querySelectorAll('#dashboard-orders .card').length"
  $cardStatus = Eval "document.querySelector('#dashboard-orders [data-order-status]').textContent"
  $cardTotal = Eval "document.querySelector('#dashboard-orders .price').textContent"
  Check ($cards -eq 1) "The dashboard lists the demo order" "The dashboard listed $cards order cards (expected 1)"
  Check ($cardStatus -eq "Pending") "The order card shows the Pending status" "Order card status was: $cardStatus"
  Check ($cardTotal -like "*370*") "The order card shows the order total" "Order card total was: $cardTotal"

  Write-Host "`n=== 5. The dashboard shows the signed-out state without a session ===" -ForegroundColor Cyan
  Eval "localStorage.removeItem('lutonglokal.session.v1'); 'removed'" | Out-Null
  Open-Page "dashboard.html"
  $signedOutHidden = Eval "document.getElementById('dashboard-signed-out').hidden"
  $signedInHidden = Eval "document.getElementById('dashboard-signed-in').hidden"
  Check ($signedOutHidden -eq $false) "Without a session the signed-out panel is shown" "The signed-out panel stayed hidden"
  Check ($signedInHidden -eq $true) "Without a session the account panel is hidden" "The account panel is still shown"

  Write-Host "`n=== 6. A customer cannot open the admin area ===" -ForegroundColor Cyan
  Reset-Demo | Out-Null
  Open-Page "login.html"
  Do-Login "demo" "demo@lutonglokal.test" "demo123"
  Wait-For "location.pathname.indexOf('dashboard.html') !== -1" 6000 | Out-Null
  Open-Page "admin.html"
  $deniedVisible = Eval "document.getElementById('admin-denied').hidden"
  $contentHidden = Eval "document.getElementById('admin-content').hidden"
  Check ($deniedVisible -eq $false) "A customer is shown the admin sign-in message" "The admin sign-in message stayed hidden for a customer"
  Check ($contentHidden -eq $true) "A customer cannot see the admin tools" "The admin tools were visible to a customer"

  Write-Host "`n=== 7. The demo administrator can open the admin area ===" -ForegroundColor Cyan
  Reset-Demo | Out-Null
  Open-Page "login.html"
  Do-Login "admin" "admin@lutonglokal.test" "admin123"
  $adminRedirect = Wait-For "location.pathname.indexOf('admin.html') !== -1" 6000
  Check $adminRedirect "Signing in as the administrator lands on the admin area" "The administrator did not reach admin.html"
  $contentShown = Eval "document.getElementById('admin-content').hidden"
  $deniedHidden = Eval "document.getElementById('admin-denied').hidden"
  $menuRows = Eval "document.querySelectorAll('#admin-menu-table tbody tr').length"
  Check ($contentShown -eq $false) "The admin tools are shown to the administrator" "The admin tools stayed hidden for the administrator"
  Check ($deniedHidden -eq $true) "The admin sign-in message is hidden for the administrator" "The admin sign-in message is still shown"
  Check ($menuRows -eq 18) "The admin menu table lists all 18 seeded dishes" "The admin menu table listed $menuRows rows (expected 18)"
  $hasBanner = Eval "(document.querySelector('.admin-banner') && document.querySelector('.admin-banner').textContent.indexOf('ADMIN DEMO AREA') !== -1)"
  Check ($hasBanner -eq $true) "The admin page keeps the amber ADMIN DEMO AREA banner" "The ADMIN DEMO AREA banner is missing"

  Write-Host "`n=== 8. The administrator can change a dish's availability ===" -ForegroundColor Cyan
  Eval @'
document.querySelector('[data-toggle-availability="m01"]').click(); 'clicked'
'@ | Out-Null
  Start-Sleep -Milliseconds 300
  $storedAvailable = Eval "JSON.stringify((JSON.parse(localStorage.getItem('lutonglokal.menu.v1')).filter(function(i){return i.id==='m01';})[0]).available)"
  $badge = Eval @'
document.querySelector('[data-availability="m01"]').textContent
'@
  Check ($storedAvailable -eq "false") "Marking a dish sold out is saved" "The stored availability was: $storedAvailable"
  Check ($badge -like "*Sold out*") "The admin table shows the dish as sold out" "The availability badge said: $badge"
  Open-Page "menu.html"
  $soldOutOnMenu = Eval "document.getElementById('item-m01').textContent.indexOf('Sold out') !== -1"
  $disabledOnMenu = Eval "document.querySelector('#item-m01 .add-to-cart-btn').disabled"
  Check ($soldOutOnMenu -eq $true) "The food menu shows the dish as sold out" "The food menu did not show the sold out label"
  Check ($disabledOnMenu -eq $true) "The sold out dish cannot be added to the cart" "The add to cart button is still enabled"
  Open-Page "admin.html"
  Eval @'
document.querySelector('[data-toggle-availability="m01"]').click(); 'clicked'
'@ | Out-Null
  Start-Sleep -Milliseconds 300
  $restored = Eval "JSON.stringify((JSON.parse(localStorage.getItem('lutonglokal.menu.v1')).filter(function(i){return i.id==='m01';})[0]).available)"
  Check ($restored -eq "true") "The dish can be put back on sale" "The stored availability was: $restored"

  Write-Host "`n=== 9. The administrator can add and remove a dish ===" -ForegroundColor Cyan
  Eval @'
(function () {
  document.getElementById('menu-item-name').value = 'Demo Test Dish';
  document.getElementById('menu-item-description').value = 'A demo dish added by the admin area test.';
  document.getElementById('menu-item-price').value = '123';
  document.getElementById('menu-item-category').value = 'snacks';
  document.getElementById('menu-item-image').value = 'https://example.test/demo-dish.jpg';
  document.getElementById('menu-form').requestSubmit();
  return 'submitted';
})();
'@ | Out-Null
  Start-Sleep -Milliseconds 400
  $rowsAfterAdd = Eval "document.querySelectorAll('#admin-menu-table tbody tr').length"
  $names = Eval "Array.prototype.map.call(document.querySelectorAll('#admin-menu-table tbody tr td:first-child strong'), function(n){return n.textContent;}).join('|')"
  Check ($rowsAfterAdd -eq 19) "The new dish is added to the admin table" "The admin table listed $rowsAfterAdd rows after adding (expected 19)"
  Check ($names -like "*Demo Test Dish*") "The new dish appears in the admin table" "The new dish is missing from the admin table"
  $newId = Eval "(function(){var m=JSON.parse(localStorage.getItem('lutonglokal.menu.v1'));var hit=m.filter(function(i){return i.name==='Demo Test Dish';})[0];return hit?hit.id:'';})()"
  Eval @"
document.querySelector('[data-delete-item="$newId"]').click(); 'clicked'
"@ | Out-Null
  Start-Sleep -Milliseconds 250
  $confirmShown = Eval "document.querySelectorAll('[data-confirm-delete]').length"
  Check ($confirmShown -eq 1) "Deleting a dish asks for confirmation first" "No confirmation button appeared"
  Eval @"
document.querySelector('[data-confirm-delete="$newId"]').click(); 'clicked'
"@ | Out-Null
  Start-Sleep -Milliseconds 400
  $rowsAfterDelete = Eval "document.querySelectorAll('#admin-menu-table tbody tr').length"
  $stillStored = Eval "JSON.parse(localStorage.getItem('lutonglokal.menu.v1')).some(function(i){return i.name==='Demo Test Dish';})"
  Check ($rowsAfterDelete -eq 18) "The deleted dish is removed from the admin table" "The admin table listed $rowsAfterDelete rows after deleting (expected 18)"
  Check ($stillStored -eq $false) "The deleted dish is removed from storage" "The deleted dish is still stored"

  Write-Host "`n=== 10. The administrator can update an order status ===" -ForegroundColor Cyan
  Eval @'
(function () {
  var order = {
    id: 'LL-20260101-STAT1',
    createdAt: '2026-01-01T10:00:00.000Z',
    ownerUsername: 'demo',
    customerName: 'Demo Customer',
    contactEmail: 'demo@lutonglokal.test',
    phone: '',
    pickupTime: '12:30',
    pickupNote: '',
    items: [{ name: 'Sisig', price: 165, quantity: 1, lineTotal: 165 }],
    subtotal: 165,
    itemCount: 1,
    total: 165,
    status: 'Pending'
  };
  localStorage.setItem('lutonglokal.orders.v1', JSON.stringify([order]));
  return 'seeded';
})();
'@ | Out-Null
  Open-Page "admin.html"
  $orderRows = Eval "document.querySelectorAll('#admin-orders-table tbody tr').length"
  $statusSelects = Eval "document.querySelectorAll('[data-order-status-select]').length"
  $statusChoices = Eval "document.querySelectorAll('[data-order-status-select] option').length"
  Check ($orderRows -eq 1) "The admin area lists the demo order" "The admin area listed $orderRows order rows (expected 1)"
  Check ($statusSelects -eq 1) "The order row has a status control" "The order row is missing the status control"
  Check ($statusChoices -eq 5) "The status control offers all 5 demo statuses" "The status control offered $statusChoices choices (expected 5)"
  Eval @'
(function () {
  var select = document.querySelector('[data-order-status-select="LL-20260101-STAT1"]');
  select.value = 'Preparing';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return 'changed';
})();
'@ | Out-Null
  Start-Sleep -Milliseconds 400
  $newStatus = Eval "JSON.parse(localStorage.getItem('lutonglokal.orders.v1'))[0].status"
  Check ($newStatus -eq "Preparing") "The new order status is saved" "The stored status was: $newStatus"
  $pill = Eval "document.querySelector('#admin-orders-table [data-order-status]').textContent"
  Check ($pill -eq "Preparing") "The admin table shows the new status" "The admin status pill said: $pill"

  Write-Host "`n=== 11. The customer sees the updated status ===" -ForegroundColor Cyan
  Eval @'
(function () {
  localStorage.setItem('lutonglokal.session.v1', JSON.stringify({
    username: 'demo', displayName: 'Demo Customer', email: 'demo@lutonglokal.test',
    role: 'user', loginAt: new Date().toISOString(), isNew: false
  }));
  return 'session';
})();
'@ | Out-Null
  Open-Page "dashboard.html"
  $customerStatus = Eval "document.querySelector('#dashboard-orders [data-order-status]').textContent"
  Check ($customerStatus -eq "Preparing") "The customer dashboard shows the updated status" "The customer dashboard showed: $customerStatus"

  Write-Host "`n=== 12. Registration creates a customer account and signs in ===" -ForegroundColor Cyan
  Reset-Demo | Out-Null
  Open-Page "register.html"
  Do-Register "Maria Santos" "marias" "maria@example.test"
  $registerRedirect = Wait-For "location.pathname.indexOf('dashboard.html') !== -1" 6000
  Check $registerRedirect "Registering signs the new customer in" "Registering did not reach dashboard.html"
  $newSession = (Eval "localStorage.getItem('lutonglokal.session.v1')") | ConvertFrom-Json
  Check ($newSession.username -eq "marias") "The new session uses the new username" "The new session username was: $($newSession.username)"
  Check ($newSession.role -eq "user") "The new account has the user role" "The new account role was: $($newSession.role)"
  Check ($newSession.isNew -eq $true) "The new session is flagged as new" "The new session was not flagged as new"
  $storedUser = (Eval "JSON.stringify(JSON.parse(localStorage.getItem('lutonglokal.users.v1'))[0])") | ConvertFrom-Json
  Check ($storedUser.role -eq "user") "The stored account is forced to the customer role" "The stored account role was: $($storedUser.role)"
  Check ($storedUser.displayName -eq "Maria Santos") "The stored account keeps the full name" "The stored account name was: $($storedUser.displayName)"
  $welcome = Eval "document.getElementById('dashboard-welcome').textContent"
  Check ($welcome -like "*Maria Santos*") "The dashboard welcomes the new customer" "The welcome message said: $welcome"

  Write-Host "`n=== 13. A registered customer can sign in with the demo passcode ===" -ForegroundColor Cyan
  Eval "localStorage.removeItem('lutonglokal.session.v1'); 'removed'" | Out-Null
  Open-Page "login.html"
  Do-Login "marias" "maria@example.test" "demo123"
  $signedInAgain = Wait-For "location.pathname.indexOf('dashboard.html') !== -1" 6000
  Check $signedInAgain "The registered customer signs in with the demo passcode" "The registered customer could not sign in"

  Write-Host "`n=== 14. Registration rejects duplicates ===" -ForegroundColor Cyan
  Open-Page "register.html"
  Do-Register "Another Maria" "marias" "maria@example.test"
  Start-Sleep -Milliseconds 400
  $dupText = Eval "document.getElementById('register-status').textContent"
  Check ($dupText -like "*already taken*") "A duplicate username is rejected" "The duplicate username message was: $dupText"
  Open-Page "register.html"
  Do-Register "Another Maria" "maria2" "maria@example.test"
  Start-Sleep -Milliseconds 400
  $dupEmail = Eval "document.getElementById('register-status').textContent"
  Check ($dupEmail -like "*already registered*") "A duplicate email address is rejected" "The duplicate email message was: $dupEmail"

  Write-Host "`n=== 15. No password or passcode is ever stored ===" -ForegroundColor Cyan
  $stored = Eval "JSON.stringify(Object.keys(localStorage))"
  $storedKeys = $stored | ConvertFrom-Json
  $secretKeys = @($storedKeys | Where-Object { $_ -match "password|passcode|secret" })
  Check ($secretKeys.Count -eq 0) "No storage key holds a password or passcode" "Found storage keys: $($secretKeys -join ', ')"
  $leak = Eval "JSON.stringify(Object.values(localStorage).join('|'))"
  Check ($leak -notmatch "demo123|admin123") "The stored demo data contains no passcode" "A demo passcode was found in browser storage"
  $usersJson = Eval "localStorage.getItem('lutonglokal.users.v1')"
  Check ($usersJson -notmatch "passcode|password") "The stored accounts contain no passcode field" "The stored accounts contain a passcode field"

  Write-Host "`n=== 16. The sign-in survives moving between pages ===" -ForegroundColor Cyan
  Reset-Demo | Out-Null
  Open-Page "login.html"
  Do-Login "demo" "demo@lutonglokal.test" "demo123"
  Wait-For "location.pathname.indexOf('dashboard.html') !== -1" 6000 | Out-Null
  Open-Page "index.html"
  $linkText = Eval "document.querySelector('[data-account-link]').textContent"
  $linkHref = Eval "document.querySelector('[data-account-link]').getAttribute('href')"
  Check ($linkText -like "*Demo Customer*") "The account link shows the signed-in name" "The account link said: $linkText"
  Check ($linkHref -eq "dashboard.html") "The account link points to the dashboard" "The account link pointed to: $linkHref"

  Write-Host "`n=== 17. No console errors during the whole run ===" -ForegroundColor Cyan
  foreach ($page in @("login.html","register.html","dashboard.html","admin.html")) {
    Open-Page $page
    $errors = (Eval "JSON.stringify(window.__e || [])") | ConvertFrom-Json
    Check ($errors.Count -eq 0) "$page still loads with no console errors" "$page logged errors: $($errors -join '; ')"
  }

  $ws.Dispose()
}
finally {
  try { if ($chrome -and -not $chrome.HasExited) { $chrome.Kill() } } catch { }
  try { if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue } } catch { }
}

Write-Host "`n============================================" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
  Write-Host "ALL STAGE 4 CHECKS PASSED ($passes checks)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "FAILURES: $($failures.Count)   PASSES: $passes" -ForegroundColor Red
  foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
  exit 1
}
