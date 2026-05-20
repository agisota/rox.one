# Generate a self-signed Authenticode certificate for ROX.ONE Windows codesigning.
#
# Run this manually on a Windows machine (or Windows VM) once a year — when
# the previous cert is within 30 days of expiring. Paste the printed base64
# + password into GitHub Actions Secrets:
#   - WIN_SELF_SIGNED_CERT_PFX        ← base64 string
#   - WIN_SELF_SIGNED_CERT_PASSWORD   ← password
#
# Cert details:
#   - Subject:       CN=ROX.ONE, O=ROX.ONE
#   - Type:          CodeSigningCert
#   - KeyAlgorithm:  RSA 4096
#   - HashAlgorithm: SHA256
#   - Validity:      365 days
#   - Store:         Cert:\CurrentUser\My (deleted from local store after export)
#
# Self-signed signatures are cryptographically valid but NOT trusted by the
# Windows certificate store. Users see SmartScreen «Unknown publisher» on
# first launch. After they click «More info → Run anyway» once, subsequent
# launches are quiet. This is documented in README and on rox.one.
#
# To upgrade to a commercial OV certificate later, replace the two GH Secrets
# with the OV cert's PFX + password — no other code changes needed.

[CmdletBinding()]
param(
    [string]$Subject = "CN=ROX.ONE, O=ROX.ONE, C=US",
    [string]$FriendlyName = "ROX.ONE self-signed codesign",
    [int]$ValidityDays = 365,
    [string]$OutputDir = "$env:TEMP\rox-one-codesign"
)

$ErrorActionPreference = 'Stop'

if (-not $IsWindows -and -not ($PSVersionTable.PSEdition -eq 'Desktop')) {
    Write-Error "This script must run on Windows. New-SelfSignedCertificate is unavailable elsewhere."
    exit 1
}

# Generate a random password (32 chars, alphanumeric + a couple of symbols
# that survive copy/paste into GH Secrets without escaping).
$passwordChars = ([char[]](48..57 + 65..90 + 97..122 + 33 + 35 + 64 + 45 + 95))
$plainPassword = -join (1..32 | ForEach-Object { Get-Random -InputObject $passwordChars })
$securePassword = ConvertTo-SecureString -String $plainPassword -Force -AsPlainText

Write-Host "Generating self-signed code-signing certificate..." -ForegroundColor Cyan
Write-Host "  Subject:       $Subject"
Write-Host "  Validity:      $ValidityDays days"
Write-Host "  Hash:          SHA256"
Write-Host "  Key:           RSA 4096"
Write-Host ""

$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $Subject `
    -FriendlyName $FriendlyName `
    -NotAfter (Get-Date).AddDays($ValidityDays) `
    -KeyAlgorithm RSA `
    -KeyLength 4096 `
    -HashAlgorithm SHA256 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")  # EKU = Code Signing

$thumbprint = $cert.Thumbprint
$certPath = "Cert:\CurrentUser\My\$thumbprint"

Write-Host "Certificate generated:" -ForegroundColor Green
Write-Host "  Thumbprint:    $thumbprint"
Write-Host "  NotBefore:     $($cert.NotBefore)"
Write-Host "  NotAfter:      $($cert.NotAfter)"
Write-Host ""

# Export PFX
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$pfxPath = Join-Path $OutputDir "rox-one-codesign.pfx"

Export-PfxCertificate `
    -Cert $certPath `
    -FilePath $pfxPath `
    -Password $securePassword `
    -ChainOption EndEntityCertOnly | Out-Null

# Encode to base64 for GH Secrets
$pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
$pfxBase64 = [Convert]::ToBase64String($pfxBytes)

# Clean up local cert store — we only want the PFX file
Remove-Item -Path $certPath -Force
Remove-Item -Path $pfxPath -Force

Write-Host "===========================================================" -ForegroundColor Yellow
Write-Host "  GitHub Actions secrets to set (Settings -> Secrets)" -ForegroundColor Yellow
Write-Host "===========================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Name:  WIN_SELF_SIGNED_CERT_PFX"
Write-Host "Value: (base64, $($pfxBase64.Length) chars — entire line below)"
Write-Host ""
Write-Host $pfxBase64
Write-Host ""
Write-Host "Name:  WIN_SELF_SIGNED_CERT_PASSWORD"
Write-Host "Value: $plainPassword"
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Cert expires: $($cert.NotAfter)" -ForegroundColor Cyan
Write-Host "Set a calendar reminder 30 days before that date to re-run this script." -ForegroundColor Cyan
