param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$rootEnvPath = Join-Path $repositoryRoot '.env'

if (!(Test-Path -LiteralPath $rootEnvPath)) {
    throw 'The root .env file is missing. Configure the local Keycloak bootstrap credentials first.'
}

$rootEnv = @{}
foreach ($lineText in Get-Content -LiteralPath $rootEnvPath) {
    if ($lineText -match '^\s*([A-Z0-9_]+)=(.*)$') {
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $rootEnv[$Matches[1]] = $value
    }
}

$required = @('KEYCLOAK_PORT', 'KEYCLOAK_BOOTSTRAP_ADMIN_USERNAME', 'KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD')
foreach ($key in $required) {
    if ([string]::IsNullOrWhiteSpace($rootEnv[$key])) { throw "Missing $key in root .env." }
}

$settings = [ordered]@{
    bruteForceProtected = $true
    permanentLockout = $false
    failureFactor = 10
    bruteForceStrategy = 'MULTIPLE'
    waitIncrementSeconds = 300
    maxFailureWaitSeconds = 300
}

if (!$Apply) {
    Write-Output 'No Keycloak settings changed. The local realm will be configured for 10 failed attempts and a 5-minute temporary lockout. Re-run with -Apply to update only these brute-force settings.'
    exit 0
}

$baseUrl = "http://localhost:$($rootEnv['KEYCLOAK_PORT'])"
$realmUrl = "$baseUrl/admin/realms/mis-student-portal"

try {
    $tokenReply = Invoke-RestMethod -Method Post `
        -Uri "$baseUrl/realms/master/protocol/openid-connect/token" `
        -ContentType 'application/x-www-form-urlencoded' `
        -Body @{
            grant_type = 'password'
            client_id = 'admin-cli'
            username = $rootEnv['KEYCLOAK_BOOTSTRAP_ADMIN_USERNAME']
            password = $rootEnv['KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD']
        }
    $headers = @{ Authorization = "Bearer $($tokenReply.access_token)" }
    $realm = Invoke-RestMethod -Method Get -Uri $realmUrl -Headers $headers
    foreach ($key in $settings.Keys) {
        $realm | Add-Member -NotePropertyName $key -NotePropertyValue $settings[$key] -Force
    }
    $body = $realm | ConvertTo-Json -Depth 100 -Compress
    Invoke-RestMethod -Method Put -Uri $realmUrl -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
} catch {
    throw 'Could not update the local MIS realm brute-force settings. Check that local Keycloak is running and the bootstrap admin credentials in .env are valid.'
}

Write-Output 'Local MIS realm updated: brute-force protection is enabled, 10 failed attempts trigger a temporary lockout, and the lockout wait is capped at 5 minutes.'
