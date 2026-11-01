param([string]$Server='localhost',[string]$Database='LingWay')
$ErrorActionPreference='Stop'
# Explicit educational-data allowlist: never export accounts, results, archives or packages.
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source']=$Server; $builder['Initial Catalog']=$Database
$builder['Integrated Security']=$true; $builder['TrustServerCertificate']=$true
$connection=New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
$connection.Open()
$sql=New-Object System.Text.StringBuilder
[void]$sql.AppendLine('-- Educational content only. Apply after 001-009 to a NEW database.')
[void]$sql.AppendLine('SET XACT_ABORT ON; BEGIN TRANSACTION;')
[void]$sql.AppendLine("IF EXISTS(SELECT 1 FROM dbo.AspNetUsers) OR EXISTS(SELECT 1 FROM dbo.Lessons) OR EXISTS(SELECT 1 FROM dbo.Phrases) THROW 51020,'Seed requires an empty application database.',1;")
[void]$sql.AppendLine('DELETE FROM dbo.Modules; DELETE FROM dbo.Achievements;')
$tables=@(
 @{Name='Modules'; Query='SELECT Id,Title,Description,SortOrder,IsEmergency,IsPublished FROM dbo.Modules ORDER BY Id';Identity=$true},
 @{Name='Lessons'; Query='SELECT Id,ModuleId,Title,Description,EnglishLevel,SortOrder,IsPublished FROM dbo.Lessons ORDER BY Id';Identity=$true},
 @{Name='LessonVersions'; Query='SELECT v.LessonId,v.Version,v.StepsJson,v.MetadataJson,v.CreatedAt FROM dbo.LessonVersions v WHERE v.Version=(SELECT MAX(x.Version) FROM dbo.LessonVersions x WHERE x.LessonId=v.LessonId) ORDER BY v.LessonId';Identity=$false},
 @{Name='Phrases'; Query='SELECT Id,English,Translation,Transcription,Category,CAST(NULL AS nvarchar(500)) AS AudioPath FROM dbo.Phrases ORDER BY Id';Identity=$true},
 @{Name='Achievements'; Query='SELECT Code,Title,Description FROM dbo.Achievements ORDER BY Code';Identity=$false}
)
try {
 foreach($table in $tables) {
  $command=$connection.CreateCommand(); $command.CommandText=$table.Query
  $reader=$command.ExecuteReader(); $count=0
  if($table.Identity){[void]$sql.AppendLine("SET IDENTITY_INSERT dbo.$($table.Name) ON;")}
  while($reader.Read()) {
   $columns=@(); $values=@()
   for($i=0;$i -lt $reader.FieldCount;$i++) {
    $columns+='['+$reader.GetName($i)+']'; $value=$reader.GetValue($i)
    if($value -is [DBNull]){$values+='NULL'}
    elseif($value -is [bool]){$values+=[string][int]$value}
    elseif($value -is [DateTime]){$values+="N'"+$value.ToString('yyyy-MM-ddTHH:mm:ss.fffffff')+"'"}
    elseif($value -is [string]){
     # Keep long Unicode JSON values as nvarchar(max), without truncating literals.
     $chunks=@("CAST(N'' AS nvarchar(max))")
     for($j=0;$j -lt $value.Length;$j+=2000){$chunks+="N'"+$value.Substring($j,[Math]::Min(2000,$value.Length-$j)).Replace("'","''")+"'"}
     $values+=($chunks -join '+')
    } else {$values+=[Convert]::ToString($value,[Globalization.CultureInfo]::InvariantCulture)}
   }
   [void]$sql.AppendLine("INSERT dbo.$($table.Name) ($($columns -join ',')) VALUES ($($values -join ','));")
   $count++
  }
  $reader.Close(); $command.Dispose()
  if($table.Identity){[void]$sql.AppendLine("SET IDENTITY_INSERT dbo.$($table.Name) OFF;")}
  Write-Output "$($table.Name): $count rows"
 }
 [void]$sql.AppendLine('COMMIT;')
 $destination=Join-Path $PSScriptRoot '../Database/010_CourseSeed.sql'
 [IO.File]::WriteAllText($destination,$sql.ToString(),[Text.UTF8Encoding]::new($false))
} finally {$connection.Dispose()}
