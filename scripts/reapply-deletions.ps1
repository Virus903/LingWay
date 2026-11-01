param([Parameter(Mandatory=$true)][string]$RestoredDatabase)
$ErrorActionPreference='Stop'
if($RestoredDatabase -notmatch '^LingWay_(Restore|Staging)[A-Za-z0-9_]*$'){throw 'Run only against an isolated restored/staging database, never the live database.'}
$ledgerRoot=Join-Path $PSScriptRoot '../src/LingWay.Web/App_Data/operations/deletions'
$c=New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=$RestoredDatabase;Integrated Security=True;TrustServerCertificate=True")
$c.Open()
try {
    foreach($file in Get-ChildItem -LiteralPath $ledgerRoot -Filter '*.json' -File){
        $entry=Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        $q=$c.CreateCommand();[void]$q.Parameters.AddWithValue('@id',[Guid]$entry.UserId);[void]$q.Parameters.AddWithValue('@legacy',[string]$entry.LegacyId)
        $q.CommandText=@'
SET XACT_ABORT ON;
-- Test and production databases can reuse numeric legacy IDs; only the exact
-- account GUID is authoritative when replaying an external deletion ledger.
IF NOT EXISTS(SELECT 1 FROM dbo.AspNetUsers WHERE Id=@id AND CONVERT(nvarchar(100),LegacyId)=@legacy) RETURN;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.StudyGroups WHERE TeacherId=@id) THROW 50010,'Staff account cannot be removed by student deletion replay',1;
DELETE dbo.Attempts WHERE UserId=@id;
IF COL_LENGTH('dbo.Assignments','StudentId') IS NOT NULL
 EXEC sp_executesql N'DELETE dbo.Assignments WHERE StudentId=@userId',N'@userId uniqueidentifier',@id;
DELETE dbo.GroupMembers WHERE UserId=@id;
UPDATE dbo.AuditEvents SET UserId=NULL,Action=N'Deleted account action' WHERE UserId=@id;
UPDATE dbo.MediaFiles SET UploadedBy=NULL WHERE UploadedBy=@id;
UPDATE dbo.ImportBatches SET UserId=NULL,ErrorsJson=N'[]' WHERE UserId=@id;
DELETE migration.SourceRows WHERE JSON_VALUE(RowJson,'$.user_id')=@legacy OR (SourceTable='users' AND JSON_VALUE(RowJson,'$.id')=@legacy);
DELETE migration.EntityMap WHERE EntityType='users' AND (SourceId=@legacy OR TargetId=CONVERT(nvarchar(100),@id));
DELETE dbo.AspNetUsers WHERE Id=@id;
IF OBJECT_ID('dbo.AccountDeletions','U') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.AccountDeletions WHERE UserId=@id)
 INSERT dbo.AccountDeletions(UserId,LegacyId) VALUES(@id,CONVERT(int,@legacy));
COMMIT;
'@
        [void]$q.ExecuteNonQuery()
    }
    Write-Output 'Deletion ledger replayed. Run DBCC CHECKCONSTRAINTS and application checks before switching to restored data.'
} finally {$c.Close()}
