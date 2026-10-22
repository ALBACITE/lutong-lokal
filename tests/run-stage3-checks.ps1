# ============================================================================
#  Lutong Lokal — tests/run-stage3-checks.ps1
#  Focused browser checks for the Stage 3 features: menu search, category
#  filters, availability, add to cart, quantity changes, removal, totals,
#  the pickup order form, order IDs and order status.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File tests\run-stage3-checks.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path -LiteralPath $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

$profileDir = Join-Path $env:TEMP ("lutong_s3_" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
$debugPort = 9477
$baseUrl = ($root -replace "\\", "/")

$failures = New-Object System.Collections.ArrayList
$passes = 0
function Pass($msg) { $script:passes += 1; Write-Host "  PASS  $msg" -ForegroundColor Green }
function Fail($msg) { [void]$script:failures.Add($msg); Write-Host "  FAIL  $msg" -ForegroundColor Red }

$chromeArgs = @(
  "--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check",
  "--remote-debugging-port=$debugPort","--user-data-dir=$profileDir",
  "--allow-file-access-from-files","--window-size=1440,900","about:blank"
)
$chrome = Start-Process -FilePath $chromePath -ArgumentList $chromeArgs -PassThru -WindowStyle Hidden

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
    $r = Send-Cdp "Runtime.evaluate" @{ expression=$expression; returnByValue=$true; awaitPromise=$true }
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
    Start-Sleep -Milliseconds 600
  }

  function Clear-Storage {
    Eval "localStorage.clear(); sessionStorage.clear(); 'cleared'" | Out-Null
  }

  # =========================================================================
  Write-Host "`n=== 1. Menu renders from data and can be searched ===" -ForegroundColor Cyan
  Clear-Storage
  Open-Page "menu.html"

  $all = Eval "document.querySelectorAll('#menu-grid .card').length"
  if ($all -eq 18) { Pass "Menu renders all 18 dishes from the stored menu data" }
  else { Fail "Menu rendered $all dishes (expected 18)" }

  $chips = Eval "document.querySelectorAll('#category-filters .chip').length"
  if ($chips -eq 7) { Pass "Menu shows 7 category filters (All Items + 6 categories)" }
  else { Fail "Menu shows $chips category filters (expected 7)" }

  $counts = Eval @'
(function () {
  var s = document.getElementById('menu-search');
  s.value = 'adobo';
  s.dispatchEvent(new Event('input', { bubbles: true }));
  var cards = Array.prototype.slice.call(document.querySelectorAll('#menu-grid .card'));
  return JSON.stringify(cards.map(function (c) { return c.querySelector('.card-title').textContent; }));
})();
'@
  $adobo = $counts | ConvertFrom-Json
  if ($adobo.Count -eq 1 -and $adobo[0] -eq "Chicken Adobo") { Pass "Search for 'adobo' returns exactly Chicken Adobo" }
  else { Fail "Search for 'adobo' returned: $($adobo -join ', ')" }

  $rice = Eval @'
(function () {
  var s = document.getElementById('menu-search');
  s.value = 'rice';
  s.dispatchEvent(new Event('input', { bubbles: true }));
  var cards = Array.prototype.slice.call(document.querySelectorAll('#menu-grid .card'));
  return String(cards.length);
})();
'@
  if ($rice -eq "4") { Pass "Search for 'rice' returns 4 dishes (name or description match)" }
  else { Fail "Search for 'rice' returned $rice dishes (expected 4)" }

  $none = Eval @'
(function () {
  var s = document.getElementById('menu-search');
  s.value = 'zzzznotathing';
  s.dispatchEvent(new Event('input', { bubbles: true }));
  var empty = document.querySelector('#menu-grid .empty-state');
  return JSON.stringify({
    cards: document.querySelectorAll('#menu-grid .card').length,
    emptyShown: !!empty,
    emptyHeading: empty ? empty.querySelector('h3').textContent : ''
  });
})();
'@
  $noneResult = $none | ConvertFrom-Json
  if ($noneResult.cards -eq 0 -and $noneResult.emptyShown -eq $true) { Pass "A search with no matches shows the empty-results message" }
  else { Fail "A search with no matches did not show the empty-results message" }

  # =========================================================================
  Write-Host "`n=== 2. Category filters ===" -ForegroundColor Cyan
  Open-Page "menu.html"

  $byCategory = Eval @'
(function () {
  var wanted = ['main-dish', 'noodles', 'rice-sides', 'snacks', 'sweets', 'drinks', 'all'];
  var results = {};
  wanted.forEach(function (id) {
    var chip = document.querySelector('[data-category="' + id + '"]');
    chip.click();
    var cards = document.querySelectorAll('#menu-grid .card');
    var pressed = document.querySelectorAll('#category-filters .chip[aria-pressed="true"]').length;
    results[id] = { count: cards.length, pressed: pressed };
  });
  return JSON.stringify(results);
})();
'@
  $catResults = $byCategory | ConvertFrom-Json
  $expected = @{ "main-dish" = 7; "noodles" = 2; "rice-sides" = 3; "snacks" = 2; "sweets" = 3; "drinks" = 1; "all" = 18 }
  foreach ($key in $expected.Keys) {
    $actual = $catResults.$key.count
    $pressed = $catResults.$key.pressed
    if ($actual -eq $expected[$key] -and $pressed -eq 1) {
      Pass ("Filter '$key' shows {0} dishes and marks exactly 1 chip as pressed" -f $actual)
    } else {
      Fail ("Filter '$key' showed {0} dishes (expected {1}), pressed chips: {2}" -f $actual, $expected[$key], $pressed)
    }
  }

  # =========================================================================
  Write-Host "`n=== 3. Availability is enforced ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  $soldOut = Eval @'
(function () {
  var card = document.getElementById('item-m04');           // Kare-Kare, sold out
  var button = card.querySelector('[data-add-item]');
  return JSON.stringify({
    disabled: button.disabled,
    ariaDisabled: button.getAttribute('aria-disabled'),
    text: button.textContent.trim(),
    badge: card.querySelector('.badge-soldout') ? card.querySelector('.badge-soldout').textContent : ''
  });
})();
'@
  $soldOutResult = $soldOut | ConvertFrom-Json
  if ($soldOutResult.disabled -eq $true) { Pass "A sold-out dish has its add-to-cart button disabled" }
  else { Fail "A sold-out dish still has an enabled add-to-cart button" }
  if ($soldOutResult.badge -eq "Sold out") { Pass "A sold-out dish shows the 'Sold out' badge" }
  else { Fail "A sold-out dish does not show the 'Sold out' badge" }

  $blocked = Eval @'
(function () {
  localStorage.clear();
  var button = document.querySelector('#item-m04 [data-add-item]');
  button.click();
  return JSON.stringify({ cart: (JSON.parse(localStorage.getItem('lutonglokal.cart.v1') || '[]')).length });
})();
'@
  $blockedResult = $blocked | ConvertFrom-Json
  if ($blockedResult.cart -eq 0) { Pass "Clicking a sold-out dish does not add anything to the cart" }
  else { Fail "A sold-out dish was added to the cart" }

  # =========================================================================
  Write-Host "`n=== 4. Add to cart ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  $added = Eval @'
(function () {
  localStorage.clear();
  document.querySelector('[data-add-item="m01"]').click();
  var badge = document.querySelector('[data-cart-count]').textContent;
  var cart = JSON.parse(localStorage.getItem('lutonglokal.cart.v1') || '[]');
  var status = document.getElementById('menu-status');
  return JSON.stringify({
    badge: badge,
    lines: cart.length,
    itemId: cart[0] ? cart[0].itemId : '',
    name: cart[0] ? cart[0].name : '',
    price: cart[0] ? cart[0].price : 0,
    qty: cart[0] ? cart[0].quantity : 0,
    statusShown: !status.hidden,
    statusText: status.textContent
  });
})();
'@
  $addedResult = $added | ConvertFrom-Json
  if ($addedResult.lines -eq 1 -and $addedResult.itemId -eq "m01" -and $addedResult.qty -eq 1) { Pass "Add to cart stores the dish with quantity 1" }
  else { Fail "Add to cart did not store the dish correctly" }
  if ($addedResult.price -eq 185) { Pass "The cart line stores the correct price (185)" }
  else { Fail "The cart line price was $($addedResult.price) (expected 185)" }
  if ($addedResult.badge -eq "1") { Pass "The navigation cart badge updates to 1" }
  else { Fail "The navigation cart badge shows '$($addedResult.badge)' (expected 1)" }
  if ($addedResult.statusShown -eq $true) { Pass "A confirmation message is shown after adding to the cart" }
  else { Fail "No confirmation message after adding to the cart" }

  $sameAgain = Eval @'
(function () {
  document.querySelector('[data-add-item="m01"]').click();
  var cart = JSON.parse(localStorage.getItem('lutonglokal.cart.v1') || '[]');
  return JSON.stringify({ lines: cart.length, qty: cart[0] ? cart[0].quantity : 0 });
})();
'@
  $sameResult = $sameAgain | ConvertFrom-Json
  if ($sameResult.lines -eq 1 -and $sameResult.qty -eq 2) { Pass "Adding the same dish again raises its quantity instead of duplicating the line" }
  else { Fail "Adding the same dish again produced $($sameResult.lines) line(s) with qty $($sameResult.qty)" }

  # =========================================================================
  Write-Host "`n=== 5. Cart totals are mathematically correct ===" -ForegroundColor Cyan
  Open-Page "cart.html"
  $cartView = Eval @'
(function () {
  localStorage.setItem('lutonglokal.cart.v1', JSON.stringify([
    { itemId: 'm01', name: 'Chicken Adobo', price: 185, quantity: 2, image: '' },
    { itemId: 'm08', name: 'Pancit Bihon', price: 125, quantity: 1, image: '' },
    { itemId: 'm18', name: 'Sago Gulaman', price: 45, quantity: 3, image: '' }
  ]));
  return 'seeded';
})();
'@
  Open-Page "cart.html"
  $totals = Eval @'
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('#cart-summary .summary-row'));
  var map = {};
  rows.forEach(function (r) {
    map[r.children[0].textContent] = r.children[1].textContent;
  });
  var lines = document.querySelectorAll('#cart-lines .cart-line').length;
  var lineTotals = Array.prototype.slice.call(document.querySelectorAll('[data-line-total]')).map(function (n) { return n.textContent; });
  return JSON.stringify({
    lines: lines,
    items: map['Items'],
    subtotal: map['Subtotal'],
    total: map['Total to pay at the counter'],
    lineTotals: lineTotals,
    emptyHidden: document.getElementById('cart-empty').hidden,
    checkoutHidden: document.getElementById('cart-checkout').hidden
  });
})();
'@
  $totalsResult = $totals | ConvertFrom-Json
  # 2 x 185 = 370, 1 x 125 = 125, 3 x 45 = 135  ->  total 630
  if ($totalsResult.lines -eq 3) { Pass "The cart shows 3 lines" }
  else { Fail "The cart shows $($totalsResult.lines) lines (expected 3)" }
  if ($totalsResult.items -eq "6") { Pass "The item count is 6 (2 + 1 + 3)" }
  else { Fail "The item count is '$($totalsResult.items)' (expected 6)" }
  if ($totalsResult.subtotal -eq "₱630.00") { Pass "The subtotal is ₱630.00" }
  else { Fail "The subtotal is '$($totalsResult.subtotal)' (expected ₱630.00)" }
  if ($totalsResult.total -eq "₱630.00") { Pass "The total is ₱630.00" }
  else { Fail "The total is '$($totalsResult.total)' (expected ₱630.00)" }
  if ($totalsResult.emptyHidden -eq $true -and $totalsResult.checkoutHidden -eq $false) { Pass "The empty-cart message is hidden and the checkout form is shown when the cart has items" }
  else { Fail "The empty/checkout panels are in the wrong state for a filled cart" }

  $math = Eval @'
(function () {
  var stored = JSON.parse(localStorage.getItem('lutonglokal.cart.v1') || '[]');
  var expected = 0;
  stored.forEach(function (l) { expected += Math.round(l.price * 100) * l.quantity; });
  expected = expected / 100;
  var shown = document.querySelector('#cart-summary .summary-row.total .price')
    ? document.querySelector('#cart-summary .summary-row.total .price').textContent
    : document.querySelector('#cart-summary .summary-row.total span:last-child').textContent;
  return JSON.stringify({ expected: expected, shown: shown });
})();
'@
  $mathResult = $math | ConvertFrom-Json
  if ($mathResult.shown -eq "₱" + $mathResult.expected.ToString("0.00")) { Pass "The displayed total matches an independent calculation (₱$($mathResult.expected))" }
  else { Fail "The displayed total '$($mathResult.shown)' does not match the calculated ₱$($mathResult.expected)" }

  # =========================================================================
  Write-Host "`n=== 6. Quantity changes and removal ===" -ForegroundColor Cyan
  $increase = Eval @'
(function () {
  document.querySelector('[data-qty-action="increase"][data-item-id="m08"]').click();
  var qty = document.querySelector('[data-qty-input="m08"]').value;
  var total = document.querySelector('#cart-summary .summary-row.total span:last-child').textContent;
  return JSON.stringify({ qty: qty, total: total });
})();
'@
  $increaseResult = $increase | ConvertFrom-Json
  if ($increaseResult.qty -eq "2") { Pass "The increase button raises the quantity from 1 to 2" }
  else { Fail "The increase button produced quantity '$($increaseResult.qty)' (expected 2)" }
  if ($increaseResult.total -eq "₱755.00") { Pass "The total updates to ₱755.00 after the quantity change" }
  else { Fail "The total after the quantity change is '$($increaseResult.total)' (expected ₱755.00)" }

  $decrease = Eval @'
(function () {
  document.querySelector('[data-qty-action="decrease"][data-item-id="m08"]').click();
  var qty = document.querySelector('[data-qty-input="m08"]').value;
  var total = document.querySelector('#cart-summary .summary-row.total span:last-child').textContent;
  return JSON.stringify({ qty: qty, total: total });
})();
'@
  $decreaseResult = $decrease | ConvertFrom-Json
  if ($decreaseResult.qty -eq "1" -and $decreaseResult.total -eq "₱630.00") { Pass "The decrease button lowers the quantity and the total returns to ₱630.00" }
  else { Fail "The decrease button produced qty '$($decreaseResult.qty)' total '$($decreaseResult.total)'" }

  $typed = Eval @'
(function () {
  var input = document.querySelector('[data-qty-input="m18"]');
  input.value = '5';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  var total = document.querySelector('#cart-summary .summary-row.total span:last-child').textContent;
  var rows = Array.prototype.slice.call(document.querySelectorAll('#cart-summary .summary-row'));
  var items = rows[0].children[1].textContent;
  return JSON.stringify({ total: total, items: items });
})();
'@
  $typedResult = $typed | ConvertFrom-Json
  # 2 x 185 + 1 x 125 + 5 x 45 = 370 + 125 + 225 = 720 ; items = 8
  if ($typedResult.total -eq "₱720.00" -and $typedResult.items -eq "8") { Pass "Typing a quantity updates the total to ₱720.00 and the item count to 8" }
  else { Fail "Typing a quantity gave total '$($typedResult.total)' items '$($typedResult.items)' (expected ₱720.00 / 8)" }

  $removed = Eval @'
(function () {
  document.querySelector('[data-remove-item="m08"]').click();
  var lines = document.querySelectorAll('#cart-lines .cart-line').length;
  var total = document.querySelector('#cart-summary .summary-row.total span:last-child').textContent;
  var stored = JSON.parse(localStorage.getItem('lutonglokal.cart.v1') || '[]');
  return JSON.stringify({ lines: lines, total: total, stored: stored.length });
})();
'@
  $removedResult = $removed | ConvertFrom-Json
  # remaining: 2 x 185 + 5 x 45 = 370 + 225 = 595
  if ($removedResult.lines -eq 2 -and $removedResult.stored -eq 2) { Pass "Removing a line updates the page and the stored cart" }
  else { Fail "Removing a line left $($removedResult.lines) lines on the page and $($removedResult.stored) in storage" }
  if ($removedResult.total -eq "₱595.00") { Pass "The total after removal is ₱595.00" }
  else { Fail "The total after removal is '$($removedResult.total)' (expected ₱595.00)" }

  $emptied = Eval @'
(function () {
  document.getElementById('clear-cart').click();
  var empty = document.getElementById('cart-empty');
  return JSON.stringify({
    emptyShown: !empty.hidden,
    checkoutHidden: document.getElementById('cart-checkout').hidden,
    heading: empty.querySelector('h3').textContent,
    stored: (JSON.parse(localStorage.getItem('lutonglokal.cart.v1') || '[]')).length
  });
})();
'@
  $emptiedResult = $emptied | ConvertFrom-Json
  if ($emptiedResult.emptyShown -eq $true -and $emptiedResult.checkoutHidden -eq $true) { Pass "Emptying the cart shows the empty-cart message again" }
  else { Fail "Emptying the cart did not show the empty-cart message" }
  if ($emptiedResult.heading -eq "Your cart is empty") { Pass "The empty-cart message says 'Your cart is empty'" }
  else { Fail "The empty-cart message heading is '$($emptiedResult.heading)'" }
  if ($emptiedResult.stored -eq 0) { Pass "The stored cart is empty after clearing" }
  else { Fail "The stored cart still has $($emptiedResult.stored) line(s)" }

  # =========================================================================
  Write-Host "`n=== 7. Pickup order form validation ===" -ForegroundColor Cyan
  Open-Page "cart.html"
  Eval @'
(function () {
  localStorage.clear();
  localStorage.setItem('lutonglokal.cart.v1', JSON.stringify([
    { itemId: 'm01', name: 'Chicken Adobo', price: 185, quantity: 1, image: '' }
  ]));
  return 'seeded';
})();
'@ | Out-Null
  Open-Page "cart.html"

  $emptySubmit = Eval @'
(function () {
  document.getElementById('order-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var status = document.getElementById('cart-status');
  return JSON.stringify({
    statusKind: status.className,
    statusShown: !status.hidden,
    nameError: document.getElementById('order-name-error').textContent,
    nameErrorShown: !document.getElementById('order-name-error').hidden,
    orders: (JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]')).length
  });
})();
'@
  $emptySubmitResult = $emptySubmit | ConvertFrom-Json
  if ($emptySubmitResult.statusShown -eq $true -and $emptySubmitResult.statusKind -like "*alert-error*") { Pass "Submitting the empty pickup form shows an error message" }
  else { Fail "Submitting the empty pickup form did not show an error message" }
  if ($emptySubmitResult.nameErrorShown -eq $true -and $emptySubmitResult.nameError -like "*required*") { Pass "The empty pickup form shows a field error: '$($emptySubmitResult.nameError)'" }
  else { Fail "The empty pickup form did not show a field error" }
  if ($emptySubmitResult.orders -eq 0) { Pass "No order is created when the pickup form is invalid" }
  else { Fail "An order was created from an invalid pickup form" }

  $badEmail = Eval @'
(function () {
  document.getElementById('order-name').value = 'Maria Santos';
  document.getElementById('order-email').value = 'maria@@bad';
  document.getElementById('order-pickup-time').value = 'As soon as possible';
  document.getElementById('order-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var error = document.getElementById('order-email-error');
  return JSON.stringify({
    shown: !error.hidden,
    text: error.textContent,
    orders: (JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]')).length
  });
})();
'@
  $badEmailResult = $badEmail | ConvertFrom-Json
  if ($badEmailResult.shown -eq $true -and $badEmailResult.text -like "*valid email*") { Pass "An invalid email address is rejected: '$($badEmailResult.text)'" }
  else { Fail "An invalid email address was not rejected" }
  if ($badEmailResult.orders -eq 0) { Pass "No order is created when the email address is invalid" }
  else { Fail "An order was created with an invalid email address" }

  $badTime = Eval @'
(function () {
  document.getElementById('order-email').value = 'maria@example.com';
  document.getElementById('order-pickup-time').value = '';
  document.getElementById('order-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var error = document.getElementById('order-time-error');
  return JSON.stringify({ shown: !error.hidden, text: error.textContent });
})();
'@
  $badTimeResult = $badTime | ConvertFrom-Json
  if ($badTimeResult.shown -eq $true) { Pass "A missing pickup time is rejected: '$($badTimeResult.text)'" }
  else { Fail "A missing pickup time was not rejected" }

  # =========================================================================
  Write-Host "`n=== 8. Valid pickup order ===" -ForegroundColor Cyan
  $placed = Eval @'
(function () {
  document.getElementById('order-name').value = 'Maria Santos';
  document.getElementById('order-email').value = 'maria@example.com';
  document.getElementById('order-phone').value = '0917 555 0142';
  document.getElementById('order-pickup-time').value = 'In about 30 minutes';
  document.getElementById('order-note').value = 'Extra rice please.';
  document.getElementById('order-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

  var success = document.getElementById('order-success');
  var orders = JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]');
  var order = orders[0] || {};
  return JSON.stringify({
    successShown: !success.hidden,
    successText: success.textContent,
    id: order.id || '',
    status: order.status || '',
    total: order.total,
    itemCount: order.itemCount,
    customerName: order.customerName,
    pickupTime: order.pickupTime,
    note: order.pickupNote,
    items: (order.items || []).length,
    cart: (JSON.parse(localStorage.getItem('lutonglokal.cart.v1') || '[]')).length,
    myOrders: (JSON.parse(localStorage.getItem('lutonglokal.myorders.v1') || '[]')).length
  });
})();
'@
  $placedResult = $placed | ConvertFrom-Json
  if ($placedResult.successShown -eq $true) { Pass "A valid pickup order shows the success panel" }
  else { Fail "A valid pickup order did not show the success panel" }
  if ($placedResult.id -match '^LL-\d{8}-[A-Z0-9]{4}$') { Pass "The demo order id is well formed: $($placedResult.id)" }
  else { Fail "The demo order id '$($placedResult.id)' is not in the expected format" }
  if ($placedResult.status -eq "Pending") { Pass "A new order starts with the status 'Pending'" }
  else { Fail "A new order has the status '$($placedResult.status)' (expected Pending)" }
  if ($placedResult.total -eq 185 -and $placedResult.itemCount -eq 1) { Pass "The saved order has the correct total (185) and item count (1)" }
  else { Fail "The saved order has total '$($placedResult.total)' and item count '$($placedResult.itemCount)'" }
  if ($placedResult.customerName -eq "Maria Santos" -and $placedResult.pickupTime -eq "In about 30 minutes") { Pass "The pickup details are saved with the order" }
  else { Fail "The pickup details were not saved correctly" }
  if ($placedResult.items -eq 1) { Pass "The order records 1 line item" }
  else { Fail "The order records $($placedResult.items) line items" }
  if ($placedResult.cart -eq 0) { Pass "The cart is emptied after a successful order" }
  else { Fail "The cart still has $($placedResult.cart) line(s) after ordering" }
  if ($placedResult.myOrders -eq 1) { Pass "The order id is recorded against this device" }
  else { Fail "The order id was not recorded against this device" }
  if ($placedResult.successText -like "*No payment*") { Pass "The success panel states that no payment was taken" }
  else { Fail "The success panel does not state that no payment was taken" }
  if ($placedResult.successText -like "*no email was sent*") { Pass "The success panel states that no email was sent" }
  else { Fail "The success panel does not state that no email was sent" }

  # =========================================================================
  Write-Host "`n=== 9. Order ids are unique and orders survive a reload ===" -ForegroundColor Cyan
  $second = Eval @'
(function () {
  localStorage.setItem('lutonglokal.cart.v1', JSON.stringify([
    { itemId: 'm08', name: 'Pancit Bihon', price: 125, quantity: 1, image: '' }
  ]));
  return 'seeded';
})();
'@ | Out-Null
  Open-Page "cart.html"
  $secondOrder = Eval @'
(function () {
  document.getElementById('order-name').value = 'Juan Dela Cruz';
  document.getElementById('order-email').value = 'juan@example.com';
  document.getElementById('order-pickup-time').value = 'As soon as possible';
  document.getElementById('order-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var orders = JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]');
  var ids = orders.map(function (o) { return o.id; });
  return JSON.stringify({ count: ids.length, ids: ids, unique: ids.length === new Set(ids).size });
})();
'@
  $secondResult = $secondOrder | ConvertFrom-Json
  if ($secondResult.count -eq 2) { Pass "A second order is saved alongside the first" }
  else { Fail "Only $($secondResult.count) order(s) were saved" }
  if ($secondResult.unique -eq $true) { Pass "The two demo order ids are different" }
  else { Fail "The demo order ids are not unique: $($secondResult.ids -join ', ')" }

  Open-Page "cart.html"
  $afterReload = Eval @'
(function () {
  var orders = JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]');
  return JSON.stringify({
    count: orders.length,
    firstId: orders[0] ? orders[0].id : '',
    firstStatus: orders[0] ? orders[0].status : ''
  });
})();
'@
  $reloadResult = $afterReload | ConvertFrom-Json
  if ($reloadResult.count -eq 2) { Pass "Both demo orders are still saved after a page reload" }
  else { Fail "Only $($reloadResult.count) order(s) survived the reload" }

  # =========================================================================
  Write-Host "`n=== 10. Order status tracking ===" -ForegroundColor Cyan
  $statusChange = Eval @'
(function () {
  var orders = JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]');
  var id = orders[0].id;
  var results = [];
  ['Preparing', 'Ready for Pickup', 'Completed'].forEach(function (s) {
    var ok = LutongOrders.setStatus(id, s);
    var check = LutongOrders.findById(id);
    results.push({ wanted: s, ok: ok, got: check ? check.status : '' });
  });
  var bad = LutongOrders.setStatus(id, 'Not A Real Status');
  return JSON.stringify({ results: results, rejectedBadStatus: bad === false, finalStatus: LutongOrders.findById(id).status });
})();
'@
  $statusResult = $statusChange | ConvertFrom-Json
  foreach ($step in $statusResult.results) {
    if ($step.ok -eq $true -and $step.got -eq $step.wanted) { Pass "Status can be changed to '$($step.wanted)'" }
    else { Fail "Status change to '$($step.wanted)' failed (got '$($step.got)')" }
  }
  if ($statusResult.rejectedBadStatus -eq $true) { Pass "An unknown status is rejected" }
  else { Fail "An unknown status was accepted" }
  if ($statusResult.finalStatus -eq "Completed") { Pass "The final status is 'Completed'" }
  else { Fail "The final status is '$($statusResult.finalStatus)'" }

  $persisted = Eval @'
(function () {
  var orders = JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]');
  return JSON.stringify({ status: orders[0].status });
})();
'@
  $persistedResult = $persisted | ConvertFrom-Json
  if ($persistedResult.status -eq "Completed") { Pass "The new status is saved in storage" }
  else { Fail "The stored status is '$($persistedResult.status)' (expected Completed)" }

  # =========================================================================
  Write-Host "`n=== 11. A sold-out dish cannot be ordered from the cart ===" -ForegroundColor Cyan
  $soldOutOrder = Eval @'
(function () {
  var menu = JSON.parse(localStorage.getItem('lutonglokal.menu.v1') || '[]');
  menu.forEach(function (m) { if (m.id === 'm04') { m.available = false; } });
  localStorage.setItem('lutonglokal.menu.v1', JSON.stringify(menu));
  localStorage.setItem('lutonglokal.cart.v1', JSON.stringify([
    { itemId: 'm04', name: 'Kare-Kare', price: 245, quantity: 1, image: '' }
  ]));
  return 'seeded';
})();
'@ | Out-Null
  Open-Page "cart.html"
  $soldOutSubmit = Eval @'
(function () {
  document.getElementById('order-name').value = 'Maria Santos';
  document.getElementById('order-email').value = 'maria@example.com';
  document.getElementById('order-pickup-time').value = 'As soon as possible';
  var before = (JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]')).length;
  document.getElementById('order-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  var after = (JSON.parse(localStorage.getItem('lutonglokal.orders.v1') || '[]')).length;
  var status = document.getElementById('cart-status');
  return JSON.stringify({
    before: before, after: after,
    statusText: status.textContent,
    statusKind: status.className
  });
})();
'@
  $soldOutSubmitResult = $soldOutSubmit | ConvertFrom-Json
  if ($soldOutSubmitResult.after -eq $soldOutSubmitResult.before) { Pass "No order is created when a cart dish has sold out" }
  else { Fail "An order was created even though Kare-Kare had sold out" }
  if ($soldOutSubmitResult.statusText -like "*sold out*") { Pass "The customer is told the dish sold out: '$($soldOutSubmitResult.statusText)'" }
  else { Fail "The sold-out message was not shown. Text: '$($soldOutSubmitResult.statusText)'" }

  # =========================================================================
  Write-Host "`n=== 12. No console errors during the whole run ===" -ForegroundColor Cyan
  Open-Page "menu.html"
  Open-Page "cart.html"
  $errors = Eval "JSON.stringify(window.__e || [])"
  $errorList = $errors | ConvertFrom-Json
  if ($errorList.Count -eq 0) { Pass "No console errors on the menu or cart pages" }
  else { Fail "Console errors found: $($errorList -join ' | ')" }

  $ws.Dispose()
}
finally {
  try { if ($chrome -and -not $chrome.HasExited) { $chrome.Kill() } } catch { }
  try { if (Test-Path -LiteralPath $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue } } catch { }
}

Write-Host "`n============================================" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
  Write-Host "ALL STAGE 3 CHECKS PASSED ($passes checks)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "FAILURES: $($failures.Count)   PASSES: $passes" -ForegroundColor Red
  foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
  exit 1
}
