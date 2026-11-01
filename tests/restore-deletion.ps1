param([ValidateSet('Prepare','VerifyDeleted','Restore','VerifyRestored','Cleanup')][string]$Mode,[int]$LegacyId,[ValidatePattern('^\d{14}$')][string]$Stamp)
$ErrorActionPreference='Stop'
$source='LingWay_HardeningTest20261101'
$target='LingWay_StagingDeletion'+$Stamp
$c=New-Object System.Data.SqlClient.SqlConnection('Server=localhost;Database=master;Integrated Security=True;TrustServerCertificate=True')
$c.Open();$q=$c.CreateCommand();$q.CommandTimeout=180
try {
 $q.CommandText="SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))";$root=$q.ExecuteScalar()
 $backup=Join-Path $root ($source+'_Daily_'+$Stamp.Substring(0,8)+'_'+$Stamp.Substring(8)+'.bak')
 [void]$q.Parameters.AddWithValue('@legacy',$LegacyId)
 if($Mode -eq 'Prepare'){
  $q.CommandText=@'
USE [LingWay_HardeningTest20261101];
DECLARE @id uniqueidentifier=(SELECT Id FROM dbo.AspNetUsers WHERE LegacyId=@legacy);
IF @id IS NULL THROW 50000,'Synthetic account missing',1;
INSERT migration.SourceRows VALUES('users',@legacy,CONCAT('{"id":',@legacy,'}'));
INSERT migration.EntityMap VALUES('users',CONVERT(nvarchar(100),@legacy),CONVERT(nvarchar(100),@id));
'@
  [void]$q.ExecuteNonQuery()
  $q.Parameters.Clear();[void]$q.Parameters.AddWithValue('@path',$backup)
  $q.CommandText="BACKUP DATABASE [$source] TO DISK=@path WITH COPY_ONLY,CHECKSUM,COMPRESSION";[void]$q.ExecuteNonQuery()
 }
 if($Mode -eq 'Restore'){
  $q.Parameters.Clear();[void]$q.Parameters.AddWithValue('@path',$backup)
  $q.CommandText="IF DB_ID('$target') IS NOT NULL THROW 50000,'Target already exists',1; RESTORE FILELISTONLY FROM DISK=@path";$r=$q.ExecuteReader();$files=New-Object System.Data.DataTable;$files.Load($r)
  $moves=@();$n=0
  foreach($f in $files.Rows){$n++;$dest=Join-Path $root ($target+'_'+$n+$(if($f.Type -eq 'L'){'.ldf'}else{'.mdf'}));$moves+="MOVE N'"+$f.LogicalName.Replace("'","''")+"' TO N'"+$dest.Replace("'","''")+"'"}
  $q.CommandText="RESTORE DATABASE [$target] FROM DISK=@path WITH "+($moves -join ',')+',RECOVERY';[void]$q.ExecuteNonQuery()
  $q.Parameters.Clear();[void]$q.Parameters.AddWithValue('@legacy',$LegacyId)
  $q.CommandText="SELECT COUNT(*) FROM [$target].dbo.AspNetUsers WHERE LegacyId=@legacy"
  if($q.ExecuteScalar() -ne 1){throw 'Backup did not restore the synthetic account'}
 }
 if($Mode -in @('VerifyDeleted','VerifyRestored')){
  $db=if($Mode -eq 'VerifyDeleted'){$source}else{$target}
  $q.CommandText="USE [$db]; SELECT (SELECT COUNT(*) FROM dbo.AspNetUsers WHERE LegacyId=@legacy)+(SELECT COUNT(*) FROM migration.SourceRows WHERE SourceTable='users' AND JSON_VALUE(RowJson,'$.id')=CONVERT(nvarchar(100),@legacy))+(SELECT COUNT(*) FROM migration.EntityMap WHERE EntityType='users' AND SourceId=CONVERT(nvarchar(100),@legacy))"
  if($q.ExecuteScalar() -ne 0){throw 'Deleted personal data reappeared'}
  if($Mode -eq 'VerifyRestored'){
   $q.CommandText="SELECT (SELECT COUNT(*) FROM [$target].dbo.AspNetUsers)-(SELECT COUNT(*) FROM [$source].dbo.AspNetUsers)"
   if($q.ExecuteScalar() -ne 0){throw 'Replay affected unrelated accounts'}
  }
  $q.CommandText="SELECT COUNT(*) FROM [$db].dbo.AccountDeletions WHERE LegacyId=@legacy";if($q.ExecuteScalar() -lt 1){throw 'Deletion ledger missing'}
  $q.CommandText="DBCC CHECKDB ([$db]) WITH NO_INFOMSGS,ALL_ERRORMSGS; DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS";$r=$q.ExecuteReader();do{if($r.HasRows){throw 'Database integrity check returned errors'}}while($r.NextResult());$r.Close()
 }
 if($Mode -eq 'Cleanup'){
  # Exact synthetic restore database, never the source or live database.
  $q.CommandText="IF DB_ID('$target') IS NOT NULL DROP DATABASE [$target]";[void]$q.ExecuteNonQuery()
 }
 Write-Output "PASS $Mode"
} finally {$c.Close()}
