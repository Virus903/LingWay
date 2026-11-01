param([string]$Database='LingWay',[switch]$VerifyRestore,[int]$RetentionDays=30)
$ErrorActionPreference='Stop'
$VerifyRestore=$VerifyRestore -or (Get-Date).Day -eq 1
if($Database -notmatch '^LingWay(?:_[A-Za-z0-9]+)?$'){throw 'Unexpected database name'}
if($RetentionDays -lt 7){throw 'Retention must be at least seven days'}
$c=New-Object System.Data.SqlClient.SqlConnection('Server=localhost;Database=master;Integrated Security=True;TrustServerCertificate=True')
$c.Open();$q=$c.CreateCommand();$q.CommandTimeout=300
try {
    $q.CommandText="SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))";$root=[IO.Path]::GetFullPath($q.ExecuteScalar())
    $file=Join-Path $root ($Database+'_Daily_'+(Get-Date -Format yyyyMMdd_HHmmss)+'.bak')
    $q.CommandText="BACKUP DATABASE [$Database] TO DISK=@path WITH COPY_ONLY,CHECKSUM,COMPRESSION";[void]$q.Parameters.AddWithValue('@path',$file);[void]$q.ExecuteNonQuery()
    $q.CommandText='RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM';[void]$q.ExecuteNonQuery()
    if($VerifyRestore){
        $restoreName=$Database+'_RestoreCheck_'+(Get-Date -Format yyyyMMddHHmmss)
        $q.CommandText='RESTORE FILELISTONLY FROM DISK=@path';$r=$q.ExecuteReader();$files=New-Object System.Data.DataTable;$files.Load($r)
        $moves=@();$n=0
        foreach($f in $files.Rows){$n++;$target=Join-Path $root ($restoreName+'_'+$n+$(if($f.Type -eq 'L'){'.ldf'}else{'.mdf'}));$logical=$f.LogicalName.Replace("'","''");$escaped=$target.Replace("'","''");$moves+="MOVE N'$logical' TO N'$escaped'"}
        $q.CommandText="RESTORE DATABASE [$restoreName] FROM DISK=@path WITH "+($moves -join ',')+',RECOVERY';[void]$q.ExecuteNonQuery()
        $q.Parameters.Clear();$q.CommandText="DBCC CHECKDB ([$restoreName]) WITH NO_INFOMSGS, ALL_ERRORMSGS";[void]$q.ExecuteNonQuery()
        # The exact newly created restore-check database is the only deletion target.
        $q.CommandText="DROP DATABASE [$restoreName]";[void]$q.ExecuteNonQuery()
        Write-Output "Restore and CHECKDB passed: $restoreName (temporary copy removed)"
    }
    $q.Parameters.Clear();$q.CommandText="IF OBJECT_ID('[$Database].dbo.AccountDeletions','U') IS NOT NULL SELECT UserId,LegacyId,DeletedAt FROM [$Database].dbo.AccountDeletions FOR JSON PATH ELSE SELECT N'[]'";
    $r=$q.ExecuteReader();$ledger=New-Object Text.StringBuilder;while($r.Read()){[void]$ledger.Append($r.GetString(0))};$r.Close()
    $opsRoot=Join-Path $PSScriptRoot '../src/LingWay.Web/App_Data/operations'
    New-Item -ItemType Directory -Path $opsRoot -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $opsRoot ($Database+'_DeletionLedger.json')),$ledger.ToString())
    # Only generated daily backups in the verified SQL backup directory are retained/removed.
    $q.Parameters.Clear();$q.CommandText='SELECT DISTINCT f.physical_device_name FROM msdb.dbo.backupset b JOIN msdb.dbo.backupmediafamily f ON b.media_set_id=f.media_set_id WHERE b.database_name=@db AND b.backup_finish_date<DATEADD(day,-@days,GETDATE())'
    [void]$q.Parameters.AddWithValue('@db',$Database);[void]$q.Parameters.AddWithValue('@days',$RetentionDays)
    $r=$q.ExecuteReader();$expiredFiles=@();while($r.Read()){$expiredFiles+=$r.GetString(0)};$r.Close()
    foreach($expiredFile in $expiredFiles){
        $resolved=[IO.Path]::GetFullPath($expiredFile)
        if([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne $root.TrimEnd('\')){continue}
        if([IO.Path]::GetFileName($resolved) -notmatch ('^'+[regex]::Escape($Database)+'_(Daily|BeforeHardening)_\d{8}_\d{6}\.bak$')){continue}
        $q.Parameters.Clear();$q.CommandText='EXEC master.dbo.xp_delete_file 0,@expired';[void]$q.Parameters.AddWithValue('@expired',$resolved);[void]$q.ExecuteNonQuery()
        Write-Output "Expired daily backup removed: $resolved"
    }
    Write-Output "Verified backup: $file; retention: $RetentionDays days"
} finally {$c.Close()}
