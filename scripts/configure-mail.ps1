$ErrorActionPreference='Stop'
$project=Join-Path $PSScriptRoot '../src/LingWay.Web/LingWay.Web.csproj'
$sender=Read-Host 'Gmail sender address'
if($sender -notmatch '^[^\s@]+@gmail\.com$'){throw 'Enter a valid Gmail sender address.'}
Write-Host 'Enter a Google App Password, NOT your account password.'
$secret=Read-Host 'Google App Password (hidden)' -AsSecureString
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $value=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Replace(' ','')
    if($value.Length -ne 16){throw 'Expected a 16-character Google App Password.'}
    @{ 'Mail:Password'=$value; 'Mail:From'=$sender; 'Mail:User'=$sender; 'Mail:Mode'='Smtp'; 'Mail:Host'='smtp.gmail.com'; 'Mail:Port'='587' } | ConvertTo-Json -Compress | & dotnet user-secrets set --project $project
    if($LASTEXITCODE -ne 0){throw 'Secret configuration failed.'}
    Write-Host 'Saved in .NET user secrets outside the project. Restart the application, then request an email code.'
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $value=$null }
