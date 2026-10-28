param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Read-DotEnv([string]$filePath) {
    $values = @{}
    foreach ($lineText in Get-Content -LiteralPath $filePath) {
        if ($lineText -match '^\s*([A-Z0-9_]+)=(.*)$') {
            $value = $Matches[2].Trim()
            if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$Matches[1]] = $value
        }
    }
    return $values
}

$rootEnvPath = Join-Path $repositoryRoot '.env'
$keycloakEnvPath = Join-Path $repositoryRoot 'keycloak\.env'
if (!(Test-Path -LiteralPath $rootEnvPath) -or !(Test-Path -LiteralPath $keycloakEnvPath)) {
    throw 'Required local .env files are missing; copy the example files and configure credentials first.'
}

$rootEnv = Read-DotEnv $rootEnvPath
$mailEnv = Read-DotEnv $keycloakEnvPath
$requiredRoot = @('KEYCLOAK_PORT', 'KEYCLOAK_BOOTSTRAP_ADMIN_USERNAME', 'KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD')
$requiredMail = @('MAIL_HOST', 'MAIL_PORT', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM_ADDRESS')
foreach ($key in $requiredRoot) { if ([string]::IsNullOrWhiteSpace($rootEnv[$key])) { throw "Missing $key in root .env." } }
foreach ($key in $requiredMail) { if ([string]::IsNullOrWhiteSpace($mailEnv[$key])) { throw "Missing $key in keycloak/.env." } }

$baseUrl = "http://localhost:$($rootEnv['KEYCLOAK_PORT'])"
$realmUrl = "$baseUrl/admin/realms/mis-student-portal"
$frontendClientId = 'mis-student-portal-frontend'
$studentFrontendClientId = 'student-portal-frontend'

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
    $clientMatches = Invoke-RestMethod -Method Get -Uri "$realmUrl/clients?clientId=$frontendClientId" -Headers $headers
    if (!$clientMatches -or $clientMatches.Count -ne 1) {
        throw 'The MIS frontend OIDC client could not be resolved in the MIS realm.'
    }
    $frontendClient = Invoke-RestMethod -Method Get -Uri "$realmUrl/clients/$($clientMatches[0].id)" -Headers $headers
    $studentClientMatches = Invoke-RestMethod -Method Get -Uri "$realmUrl/clients?clientId=$studentFrontendClientId" -Headers $headers
    if ($studentClientMatches -and $studentClientMatches.Count -gt 1) {
        throw 'More than one Student Portal client was found in the MIS realm.'
    }
} catch {
    throw 'Could not read the MIS realm or frontend client from the local Keycloak Admin API. Check that Keycloak is running and the bootstrap admin credentials in .env are valid.'
}

$frontendClient.publicClient = $true
$frontendClient.standardFlowEnabled = $true
$frontendClient.redirectUris = @($frontendClient.redirectUris + @('http://localhost:3000/dashboard', 'http://localhost:3000/*') | Select-Object -Unique)
$frontendClient.webOrigins = @($frontendClient.webOrigins + 'http://localhost:3000' | Select-Object -Unique)
$clientAttributes = $frontendClient.attributes
if ($null -eq $clientAttributes) {
    $clientAttributes = [pscustomobject]@{}
    $frontendClient | Add-Member -NotePropertyName attributes -NotePropertyValue $clientAttributes -Force
}
$clientAttributes | Add-Member -NotePropertyName 'pkce.code.challenge.method' -NotePropertyValue 'S256' -Force

$attributes = $realm.attributes
if ($null -eq $attributes) {
    $attributes = [pscustomobject]@{}
    $realm | Add-Member -NotePropertyName attributes -NotePropertyValue $attributes -Force
}
$attributes | Add-Member -NotePropertyName 'actionTokenGeneratedByUserLifespan.reset-credentials' -NotePropertyValue '900' -Force

$realm.loginWithEmailAllowed = $true
$realm.registrationEmailAsUsername = $false
$realm.resetPasswordAllowed = $true
$realm.internationalizationEnabled = $true
$realm | Add-Member -NotePropertyName 'supportedLocales' -NotePropertyValue @('en') -Force
$realm | Add-Member -NotePropertyName 'defaultLocale' -NotePropertyValue 'en' -Force
$realm.bruteForceProtected = $true
$realm.permanentLockout = $false
$realm.failureFactor = 10
$realm.bruteForceStrategy = 'MULTIPLE'
$realm.waitIncrementSeconds = 60
$realm.maxFailureWaitSeconds = 60
$realm.smtpServer = [pscustomobject]@{
    host = $mailEnv['MAIL_HOST']
    port = $mailEnv['MAIL_PORT']
    from = $mailEnv['MAIL_FROM_ADDRESS']
    fromDisplayName = 'MIS Student Portal'
    auth = 'true'
    user = $mailEnv['MAIL_USERNAME']
    password = $mailEnv['MAIL_PASSWORD']
    ssl = 'false'
    starttls = 'true'
}

if (!$Apply) {
    Write-Output 'Ready to configure ST-01, MIS Internal, and Student Portal browser clients (public clients with PKCE S256). No settings were changed. Re-run with -Apply to apply.'
    exit 0
}

try {
    $body = $realm | ConvertTo-Json -Depth 100 -Compress
    Invoke-RestMethod -Method Put -Uri $realmUrl -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
    $clientBody = $frontendClient | ConvertTo-Json -Depth 100 -Compress
    Invoke-RestMethod -Method Put -Uri "$realmUrl/clients/$($clientMatches[0].id)" -Headers $headers -ContentType 'application/json' -Body $clientBody | Out-Null

    if (!$studentClientMatches) {
        $studentClientDefinition = [pscustomobject]@{
            clientId = $studentFrontendClientId
            name = 'Student Portal Frontend'
            enabled = $true
            protocol = 'openid-connect'
            publicClient = $true
            standardFlowEnabled = $true
            directAccessGrantsEnabled = $false
            implicitFlowEnabled = $false
            fullScopeAllowed = $true
            attributes = @{ 'pkce.code.challenge.method' = 'S256' }
            redirectUris = @('http://localhost:3001/dashboard', 'http://localhost:3001/*')
            webOrigins = @('http://localhost:3001')
            protocolMappers = @(@{
                name = 'student-portal-audience'
                protocol = 'openid-connect'
                protocolMapper = 'oidc-audience-mapper'
                consentRequired = $false
                config = @{
                    'included.client.audience' = $studentFrontendClientId
                    'access.token.claim' = 'true'
                    'id.token.claim' = 'false'
                }
            })
        }
        $studentClientBody = $studentClientDefinition | ConvertTo-Json -Depth 100 -Compress
        Invoke-RestMethod -Method Post -Uri "$realmUrl/clients" -Headers $headers -ContentType 'application/json' -Body $studentClientBody | Out-Null
        $studentClientMatches = Invoke-RestMethod -Method Get -Uri "$realmUrl/clients?clientId=$studentFrontendClientId" -Headers $headers
    }

    if (!$studentClientMatches -or $studentClientMatches.Count -ne 1) {
        throw 'Could not create or resolve the Student Portal OIDC client.'
    }
    $studentClient = Invoke-RestMethod -Method Get -Uri "$realmUrl/clients/$($studentClientMatches[0].id)" -Headers $headers
    $studentClient.publicClient = $true
    $studentClient.standardFlowEnabled = $true
    $studentClient.directAccessGrantsEnabled = $false
    $studentClient.fullScopeAllowed = $true
    $studentClient.redirectUris = @($studentClient.redirectUris + @('http://localhost:3001/dashboard', 'http://localhost:3001/*') | Select-Object -Unique)
    $studentClient.webOrigins = @($studentClient.webOrigins + 'http://localhost:3001' | Select-Object -Unique)
    if ($null -eq $studentClient.attributes) { $studentClient | Add-Member -NotePropertyName attributes -NotePropertyValue ([pscustomobject]@{}) -Force }
    $studentClient.attributes | Add-Member -NotePropertyName 'pkce.code.challenge.method' -NotePropertyValue 'S256' -Force
    $studentAudienceMapper = @{
        name = 'student-portal-audience'
        protocol = 'openid-connect'
        protocolMapper = 'oidc-audience-mapper'
        consentRequired = $false
        config = @{
            'included.client.audience' = $studentFrontendClientId
            'access.token.claim' = 'true'
            'id.token.claim' = 'false'
        }
    }
    $studentClient.protocolMappers = @($studentClient.protocolMappers | Where-Object { $_.name -ne 'student-portal-audience' }) + @($studentAudienceMapper)
    $studentClientBody = $studentClient | ConvertTo-Json -Depth 100 -Compress
    Invoke-RestMethod -Method Put -Uri "$realmUrl/clients/$($studentClientMatches[0].id)" -Headers $headers -ContentType 'application/json' -Body $studentClientBody | Out-Null
} catch {
    throw 'Keycloak rejected the ST-01 or frontend-client update. No credentials or server response details were printed.'
}

Write-Output 'ST-01 realm settings saved. MIS Internal and Student Portal clients are public and use PKCE S256; local redirect addresses were added. Reset link lifetime: 15 minutes; login accepts username or email; accounts lock for 1 minute after 10 consecutive failures. SMTP configured from keycloak/.env.'
