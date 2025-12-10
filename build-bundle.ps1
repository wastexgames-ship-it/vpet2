#!/usr/bin/env pwsh
# Build the bundle file from individual source files

$srcPath = ".\src"
$bundlePath = ".\app.bundle.js"

$bundleContent = @"
// Single-file bundle for file:// usage (no modules needed)
(() => {
  // --- stateMachine.js ---`n
"@

# Add stateMachine.js (remove export)
$stateMachineLines = @(Get-Content "$srcPath\stateMachine.js" -Encoding UTF8)
foreach ($line in $stateMachineLines) {
  $line = $line -replace 'export class', 'class'
  $bundleContent += $line + "`n"
}

# Add pet.js (remove export)
$bundleContent += "`n  // --- pet.js ---`n"
$petLines = @(Get-Content "$srcPath\pet.js" -Encoding UTF8)
foreach ($line in $petLines) {
  $line = $line -replace 'export class', 'class'
  $bundleContent += $line + "`n"
}

# Add render.js (remove imports and exports)
$bundleContent += "`n  // --- render.js ---`n"
$renderLines = @(Get-Content "$srcPath\render.js" -Encoding UTF8)
foreach ($line in $renderLines) {
  $line = $line -replace 'import.*from.*', ''
  $line = $line -replace 'export ', ''
  $bundleContent += $line + "`n"
}

# Add main.js (remove imports)
$bundleContent += "`n  // --- main.js ---`n"
$mainLines = @(Get-Content "$srcPath\main.js" -Encoding UTF8)
foreach ($line in $mainLines) {
  $line = $line -replace 'import.*from.*', ''
  $bundleContent += $line + "`n"
}

# Close the IIFE
$bundleContent += "`n})();`n"

# Write to file
Set-Content -Path $bundlePath -Value $bundleContent -Encoding UTF8
Write-Host "Bundle created: $bundlePath"