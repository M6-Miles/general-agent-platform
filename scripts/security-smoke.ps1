$ErrorActionPreference = 'Stop'
$base = if ($env:BASE_URL) { $env:BASE_URL.TrimEnd('/') } else { 'http://localhost:8000' }
$checks = @(
  @{ Path = '/health'; Expected = 200 },
  @{ Path = '/ready'; Expected = 200 },
  @{ Path = '/api/v1/agents'; Expected = 401 }
)
foreach ($check in $checks) {
  try { $response = Invoke-WebRequest -UseBasicParsing "$base$($check.Path)"; $code = $response.StatusCode }
  catch { $code = [int]$_.Exception.Response.StatusCode }
  if ($code -ne $check.Expected) { throw "Security smoke failed: $($check.Path) returned $code" }
  Write-Output "PASS $($check.Path) $code"
}
