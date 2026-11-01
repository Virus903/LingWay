param([switch]$FullScript)
$ErrorActionPreference='Stop'
$database='LingWay_PublicVerify_'+(Get-Date -Format 'yyyyMMddHHmmss')
$connection=New-Object System.Data.SqlClient.SqlConnection('Server=localhost;Database=master;Integrated Security=True;TrustServerCertificate=True')
$connection.Open()
try {
 $q=$connection.CreateCommand();$q.CommandTimeout=120
 $FullScript=$true
 $files=@(Get-Item (Join-Path $PSScriptRoot '../Database/LingWay.sql'))
 foreach($file in $files) {
  $sql=[IO.File]::ReadAllText($file.FullName).Replace('[LingWay]',"[$database]").Replace("N'LingWay'","N'$database'").Replace("N''LingWay''","N''$database''")
  if(-not $FullScript -and $file.Name -notlike '001_*'){$q.CommandText="USE [$database]";[void]$q.ExecuteNonQuery()}
  foreach($batch in [regex]::Split($sql,'(?im)^\s*GO\s*\r?$')) {
   if($batch.Trim()){$q.CommandText=$batch;[void]$q.ExecuteNonQuery()}
  }
  Write-Output "Applied $($file.Name)"
 }
 $q.CommandText="USE [$database]; SELECT (SELECT COUNT(*) FROM dbo.AspNetUsers),(SELECT COUNT(*) FROM dbo.Lessons),(SELECT COUNT(*) FROM dbo.Modules),(SELECT COUNT(*) FROM dbo.Phrases)"
 $reader=$q.ExecuteReader();[void]$reader.Read()
 if($reader.GetInt32(0) -ne 0 -or $reader.GetInt32(1) -ne 21 -or $reader.GetInt32(2) -ne 7 -or $reader.GetInt32(3) -ne 375){throw 'Unexpected public seed counts'}
 $reader.Close()
 if($FullScript){
  # A second run must skip every section, including cleanup migrations and seed.
  foreach($batch in [regex]::Split($sql,'(?im)^\s*GO\s*\r?$')) {
   if($batch.Trim()){$q.CommandText=$batch;[void]$q.ExecuteNonQuery()}
  }
  $q.CommandText="USE [$database]; SELECT COUNT(*) FROM dbo.Lessons"
  if([int]$q.ExecuteScalar() -ne 21){throw 'Repeat run changed content'}
  Write-Output 'PASS: repeated full installer skipped existing database.'
 }
 $q.CommandText="DBCC CHECKDB ([$database]) WITH NO_INFOMSGS";[void]$q.ExecuteNonQuery()
 Write-Output 'PASS: fresh schema, 7 modules, 21 lessons, 375 phrases, zero users, CHECKDB.'
} finally {
 if($connection.State -eq 'Open') {
  $cleanup=$connection.CreateCommand()
  $cleanup.CommandText="USE master; IF DB_ID(N'$database') IS NOT NULL BEGIN ALTER DATABASE [$database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$database]; END"
  [void]$cleanup.ExecuteNonQuery();$connection.Dispose()
 }
}
