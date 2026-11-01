$ErrorActionPreference='Stop'
$root=Join-Path $PSScriptRoot '../src/LingWay.Web/App_Data'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$current=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
$principals=@($current,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')),(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544')))
$acl=New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true,$false)
foreach($sid in $principals){$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))}
Set-Acl -LiteralPath $root -AclObject $acl
$secret=Join-Path $env:APPDATA 'Microsoft/UserSecrets/LingWay.Local.2026/secrets.json'
$credentials=Join-Path $PSScriptRoot '../tests/accounts.local.txt'
foreach($file in @($secret,$credentials)){
 if(Test-Path -LiteralPath $file){
  $fileAcl=New-Object System.Security.AccessControl.FileSecurity
  $fileAcl.SetAccessRuleProtection($true,$false)
  foreach($sid in $principals){$fileAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow')))}
  Set-Acl -LiteralPath $file -AclObject $fileAcl
 }
}
Write-Output 'Restricted application data and credential files to current Windows user, SYSTEM and Administrators.'
