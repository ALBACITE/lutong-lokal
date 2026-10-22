# ============================================================================
#  Lutong Lokal — tests/run-checks.ps1
#  Static checks for the prototype. No external tools required.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File tests\run-checks.ps1
#  Exit code 0 = all checks passed.
# ============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$pages = @(
  "index.html", "menu.html", "cart.html", "about.html", "contact.html",
  "login.html", "register.html", "dashboard.html", "admin.html"
)

$failures = New-Object System.Collections.ArrayList
$passes = 0

function Pass($msg) {
  $script:passes += 1
  Write-Host "  PASS  $msg" -ForegroundColor Green
}

function Fail($msg) {
  [void]$script:failures.Add($msg)
  Write-Host "  FAIL  $msg" -ForegroundColor Red
}

Write-Host "`n=== 1. Page files exist ===" -ForegroundColor Cyan
foreach ($page in $pages) {
  $path = Join-Path $root $page
  if (Test-Path -LiteralPath $path) { Pass "$page exists" }
  else { Fail "$page is missing" }
}

Write-Host "`n=== 2. Local links and assets resolve ===" -ForegroundColor Cyan
# Only HTML and CSS are scanned for links. JavaScript builds some URLs at
# runtime, so its string literals are not real document links.
$linkFiles = Get-ChildItem -LiteralPath $root -Recurse -File |
  Where-Object { $_.Extension -eq ".html" -or $_.Extension -eq ".css" } |
  Select-Object -ExpandProperty FullName
foreach ($file in $linkFiles) {
  $text = Get-Content -LiteralPath $file -Raw
  $relative = $file.Substring($root.Length + 1).Replace("\", "/")

  $matches = [regex]::Matches($text, '(?:href|src)\s*=\s*"([^"]+)"')
  foreach ($m in $matches) {
    $link = $m.Groups[1].Value
    if ($link -match '^(https?:|mailto:|tel:|#|data:)') { continue }

    $clean = ($link -split '#')[0]
    if ($clean -eq "") { continue }

    $target = Join-Path (Split-Path -Parent $file) $clean
    if (Test-Path -LiteralPath $target) {
      Pass "$relative -> $link"
    } else {
      Fail "$relative -> $link (target not found)"
    }
  }
}

Write-Host "`n=== 3. Every page has the shared header, footer and skip link ===" -ForegroundColor Cyan
foreach ($page in $pages) {
  $text = Get-Content -LiteralPath (Join-Path $root $page) -Raw
  $checks = @{
    "skip link"      = 'class="skip-link"'
    "site header"    = 'class="site-header"'
    "main landmark"  = '<main id="main">'
    "site footer"    = 'class="site-footer"'
    "stylesheet"     = 'assets/css/style.css'
    "viewport meta"  = 'name="viewport"'
    "lang attribute" = '<html lang="en">'
  }
  $missing = @()
  foreach ($key in $checks.Keys) {
    if ($text -notlike "*$($checks[$key])*") { $missing += $key }
  }
  if ($missing.Count -eq 0) { Pass "$page has all shared layout parts" }
  else { Fail "$page is missing: $($missing -join ', ')" }
}

Write-Host "`n=== 4. Every page links to every main page ===" -ForegroundColor Cyan
foreach ($page in $pages) {
  $text = Get-Content -LiteralPath (Join-Path $root $page) -Raw
  $missing = @()
  foreach ($target in $pages) {
    if ($text -notlike "*href=`"$target`"*") { $missing += $target }
  }
  if ($missing.Count -eq 0) { Pass "$page links to all 9 pages" }
  else { Fail "$page does not link to: $($missing -join ', ')" }
}

Write-Host "`n=== 5. HTML tag balance ===" -ForegroundColor Cyan
foreach ($page in $pages) {
  $text = Get-Content -LiteralPath (Join-Path $root $page) -Raw
  $pairs = @("div","ul","li","section","form","table","nav","main","header","footer","article","aside","select","textarea","button","dl","h1","h2","h3","ol","p","span","fieldset","legend","label","td","th","tr","thead","tbody","caption")
  $problems = @()
  foreach ($tag in $pairs) {
    $open  = ([regex]::Matches($text, "<$tag(\s[^>]*)?>")).Count
    $close = ([regex]::Matches($text, "</$tag>")).Count
    if ($open -ne $close) { $problems += "$tag ($open open / $close close)" }
  }
  if ($problems.Count -eq 0) { Pass "$page tags are balanced" }
  else { Fail "$page unbalanced: $($problems -join ', ')" }
}

Write-Host "`n=== 6. Every local image has alt text ===" -ForegroundColor Cyan
foreach ($page in $pages) {
  $text = Get-Content -LiteralPath (Join-Path $root $page) -Raw
  $imgs = [regex]::Matches($text, '<img\b[^>]*>')
  $bad = 0
  foreach ($img in $imgs) {
    if ($img.Value -notmatch 'alt\s*=') { $bad += 1 }
  }
  if ($bad -eq 0) { Pass "$page : all $($imgs.Count) images have alt attributes" }
  else { Fail "$page : $bad image(s) without alt attribute" }
}

Write-Host "`n=== 7. No secrets or real credentials in source ===" -ForegroundColor Cyan
# The tests folder holds the pattern strings themselves, so it is skipped.
$sourceFiles = Get-ChildItem -LiteralPath $root -Recurse -File |
  Where-Object {
    ($_.Extension -eq ".html" -or $_.Extension -eq ".css" -or $_.Extension -eq ".js") -and
    ($_.FullName -notlike "$root\tests\*")
  } |
  Select-Object -ExpandProperty FullName
$secretFound = $false
foreach ($file in $sourceFiles) {
  $text = Get-Content -LiteralPath $file -Raw
  $relative = $file.Substring($root.Length + 1)
  if ($text -match '(?i)(api[_-]?key|service[_-]?role|secret[_-]?key|BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,})') {
    Fail "$relative looks like it contains a secret"
    $secretFound = $true
  }
}
if (-not $secretFound) { Pass "No API keys, service-role keys or private keys found in source" }

Write-Host "`n=== 8. Demo passcodes are not written to browser storage ===" -ForegroundColor Cyan
$storageText = Get-Content -LiteralPath (Join-Path $root "assets\js\storage.js") -Raw
$authHits = [regex]::Matches($storageText, "demo123|admin123").Count
if ($authHits -eq 0) { Pass "storage.js contains no demo passcodes" }
else { Fail "storage.js references demo passcodes ($authHits times)" }

$uiText = Get-Content -LiteralPath (Join-Path $root "assets\js\ui.js") -Raw
$uiHits = [regex]::Matches($uiText, "demo123|admin123").Count
if ($uiHits -eq 0) { Pass "ui.js contains no demo passcodes" }
else { Fail "ui.js references demo passcodes ($uiHits times)" }

Write-Host "`n=== 9. CSS custom properties are all defined ===" -ForegroundColor Cyan
$css = Get-Content -LiteralPath (Join-Path $root "assets\css\style.css") -Raw
$defined = [regex]::Matches($css, '(--[a-z0-9-]+)\s*:') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$used = [regex]::Matches($css, 'var\((--[a-z0-9-]+)') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$undefined = $used | Where-Object { $defined -notcontains $_ }
if ($undefined.Count -eq 0) { Pass "All $($used.Count) CSS variables used in the stylesheet are defined" }
else { Fail "Undefined CSS variables: $($undefined -join ', ')" }

Write-Host "`n=== 10. JavaScript files referenced by pages exist ===" -ForegroundColor Cyan
foreach ($page in $pages) {
  $text = Get-Content -LiteralPath (Join-Path $root $page) -Raw
  $scripts = [regex]::Matches($text, '<script\s+src\s*=\s*"([^"]+)"')
  $missing = @()
  foreach ($s in $scripts) {
    $target = Join-Path $root $s.Groups[1].Value
    if (-not (Test-Path -LiteralPath $target)) { $missing += $s.Groups[1].Value }
  }
  if ($missing.Count -eq 0) { Pass "$page : all $($scripts.Count) script files exist" }
  else { Fail "$page : missing script(s) $($missing -join ', ')" }
}

Write-Host "`n=== 11. No leftover placeholders or TODO markers ===" -ForegroundColor Cyan
# "placeholder" is a valid HTML attribute and a valid CSS pseudo-element,
# so only real unfinished-work wording is flagged here.
$placeholderPattern = '(?i)\bTODO\b|\bFIXME\b|\bcoming soon\b|\bunder construction\b|lorem ipsum|\bTBD\b|not implemented yet|placeholder text|your text here'
foreach ($file in $sourceFiles) {
  $text = Get-Content -LiteralPath $file -Raw
  $relative = $file.Substring($root.Length + 1)
  if ($text -match $placeholderPattern) {
    Fail "$relative contains a placeholder or TODO marker"
  }
}
Pass "No TODO, FIXME or unfinished-work wording found in source"

Write-Host "`n=== 12. Colour contrast meets WCAG AA ===" -ForegroundColor Cyan

function Get-Luminance([string]$hex) {
  $clean = $hex.TrimStart('#')
  $r = [Convert]::ToInt32($clean.Substring(0, 2), 16) / 255.0
  $g = [Convert]::ToInt32($clean.Substring(2, 2), 16) / 255.0
  $b = [Convert]::ToInt32($clean.Substring(4, 2), 16) / 255.0
  foreach ($name in @('r', 'g', 'b')) {
    $value = Get-Variable -Name $name -ValueOnly
    if ($value -le 0.03928) { $value = $value / 12.92 }
    else { $value = [Math]::Pow((($value + 0.055) / 1.055), 2.4) }
    Set-Variable -Name $name -Value $value
  }
  return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b
}

function Get-Contrast([string]$fg, [string]$bg) {
  $l1 = Get-Luminance $fg
  $l2 = Get-Luminance $bg
  $light = [Math]::Max($l1, $l2)
  $dark = [Math]::Min($l1, $l2)
  return [Math]::Round(($light + 0.05) / ($dark + 0.05), 2)
}

# foreground, background, minimum ratio, description
$contrastPairs = @(
  @('#33302E', '#FDF8F3', 4.5, 'body text on the page background'),
  @('#33302E', '#FFFFFF', 4.5, 'body text on a white card'),
  @('#5C554E', '#FDF8F3', 4.5, 'muted text on the page background'),
  @('#5C554E', '#FFFFFF', 4.5, 'muted text on a white card'),
  @('#7A2E0E', '#FFFFFF', 4.5, 'link and price text on white'),
  @('#7A2E0E', '#FFF4EC', 4.5, 'heading text on the brand tint'),
  @('#FFFFFF', '#9C3A12', 4.5, 'primary button label'),
  @('#FFFFFF', '#7A2E0E', 4.5, 'current navigation link label'),
  @('#FFFFFF', '#78350F', 4.5, 'admin button label'),
  @('#EDE3DA', '#3A1C0B', 4.5, 'footer body text'),
  @('#FFD9C2', '#3A1C0B', 4.5, 'footer link text'),
  @('#D9CCC2', '#3A1C0B', 4.5, 'footer small print'),
  @('#14532D', '#E7F6EC', 4.5, 'success message text'),
  @('#7F1D1D', '#FDECEC', 4.5, 'error message text'),
  @('#1E3A8A', '#E8F1FD', 4.5, 'info message text'),
  @('#78350F', '#FEF3C7', 4.5, 'warning message text'),
  @('#78350F', '#FEF3C7', 4.5, 'admin banner text'),
  @('#8A8079', '#FFFFFF', 3.0, 'input placeholder text'),
  @('#1A73E8', '#FFFFFF', 3.0, 'focus outline on white'),
  @('#1A73E8', '#FDF8F3', 3.0, 'focus outline on the page background')
)

foreach ($pair in $contrastPairs) {
  $ratio = Get-Contrast $pair[0] $pair[1]
  if ($ratio -ge $pair[2]) {
    Pass ("{0} = {1}:1 (needs {2}:1)" -f $pair[3], $ratio, $pair[2])
  } else {
    Fail ("{0} = {1}:1 is below the required {2}:1" -f $pair[3], $ratio, $pair[2])
  }
}

Write-Host "`n=== 13. Every page loads the scripts its own scripts depend on ===" -ForegroundColor Cyan

# Which file provides each shared global. If a page loads a script that uses
# one of these globals, the page must also load the file that defines it.
$globalProviders = @{
  "LutongValidate" = "assets/js/validate.js"
  "LutongUI"       = "assets/js/ui.js"
  "LutongOrders"   = "assets/js/orders.js"
  "lutongGetMenu"  = "assets/js/storage.js"
  "lutongGetCart"  = "assets/js/storage.js"
  "lutongGetOrders"= "assets/js/storage.js"
  "lutongSaveCart" = "assets/js/storage.js"
  "lutongGetSession" = "assets/js/storage.js"
}

foreach ($page in $pages) {
  $text = Get-Content -LiteralPath (Join-Path $root $page) -Raw
  $loaded = @()
  foreach ($m in [regex]::Matches($text, '<script\s+src\s*=\s*"([^"]+)"')) {
    $loaded += $m.Groups[1].Value
  }

  $scriptText = ""
  foreach ($s in $loaded) {
    $p = Join-Path $root ($s -replace '/', '\')
    if (Test-Path -LiteralPath $p) {
      $scriptText += (Get-Content -LiteralPath $p -Raw)
    }
  }

  $missing = @()
  foreach ($global in $globalProviders.Keys) {
    if ($scriptText -match ("\b" + $global + "\.")) {
      if ($loaded -notcontains $globalProviders[$global]) {
        $missing += "$global (defined in $($globalProviders[$global]))"
      }
    }
  }

  if ($missing.Count -eq 0) { Pass "$page loads every script its own scripts depend on" }
  else { Fail "$page does not load: $($missing -join ', ')" }
}

Write-Host "`n============================================" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
  Write-Host "ALL CHECKS PASSED ($passes checks)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "FAILURES: $($failures.Count)   PASSES: $passes" -ForegroundColor Red
  foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
  exit 1
}
