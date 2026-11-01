$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot
$outputRoot = Join-Path $projectRoot 'tests/fixtures'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$connection = New-Object System.Data.SqlClient.SqlConnection('Server=localhost;Database=LingWay;Integrated Security=True;TrustServerCertificate=True')
$connection.Open()
try {
    $command = $connection.CreateCommand()
    $command.CommandText = @'
SELECT l.Id AS id,l.Title AS title,l.ModuleId AS module_id,v.Version AS version,
 JSON_QUERY(v.StepsJson) AS steps,JSON_QUERY(v.MetadataJson) AS meta
FROM dbo.Lessons l JOIN dbo.LessonVersions v ON v.LessonId=l.Id
WHERE v.Version=(SELECT MAX(Version) FROM dbo.LessonVersions WHERE LessonId=l.Id)
ORDER BY l.Id FOR JSON PATH
'@
    $reader = $command.ExecuteReader()
    $json = New-Object System.Text.StringBuilder
    while ($reader.Read()) { [void]$json.Append($reader.GetString(0)) }
    $reader.Close()
    [IO.File]::WriteAllText((Join-Path $outputRoot 'learning-content.json'),$json.ToString(),[Text.UTF8Encoding]::new($false))
    Write-Output 'Exported lesson content only (no accounts or results).'
} finally { $connection.Dispose() }
