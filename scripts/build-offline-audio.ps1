param([string]$Database='LingWay')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Speech
$synth=New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice=$synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1
if(-not $voice){throw 'An installed English Windows voice is required.'}
$synth.SelectVoice($voice.VoiceInfo.Name)
$assetRoot=Join-Path $PSScriptRoot '../src/LingWay.Web/App_Data/offline-audio'
New-Item -ItemType Directory -Path $assetRoot -Force | Out-Null
$c=New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=$Database;Integrated Security=True;TrustServerCertificate=True")
$c.Open(); $q=$c.CreateCommand()
$q.CommandText='SELECT English FROM dbo.Phrases UNION SELECT JSON_VALUE(j.value,''$.audio'') FROM dbo.LessonVersions v CROSS APPLY OPENJSON(v.StepsJson) j WHERE NOT EXISTS(SELECT 1 FROM dbo.LessonVersions n WHERE n.LessonId=v.LessonId AND n.Version>v.Version) UNION SELECT JSON_VALUE(j.value,''$.prompt'') FROM dbo.LessonVersions v CROSS APPLY OPENJSON(v.StepsJson) j WHERE NOT EXISTS(SELECT 1 FROM dbo.LessonVersions n WHERE n.LessonId=v.LessonId AND n.Version>v.Version) UNION SELECT a.value FROM dbo.LessonVersions v CROSS APPLY OPENJSON(v.StepsJson) j CROSS APPLY OPENJSON(j.value,''$.accepted'') a WHERE NOT EXISTS(SELECT 1 FROM dbo.LessonVersions n WHERE n.LessonId=v.LessonId AND n.Version>v.Version)'
$r=$q.ExecuteReader(); $phrases=New-Object 'System.Collections.Generic.HashSet[string]'
while($r.Read()){if(-not $r.IsDBNull(0)){ $phrase=$r.GetString(0).Trim(); if($phrase -match '[a-zA-Z]' -and $phrase -notmatch '[\u0400-\u04ff]' -and $phrase.Length -le 2000){[void]$phrases.Add($phrase)}}};$r.Close();$c.Close()
$manifest=@();$sha=[System.Security.Cryptography.SHA256]::Create();$i=0
foreach($phrase in $phrases){
    $key=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($phrase)))).Replace('-','').ToLowerInvariant()
    $file=Join-Path $assetRoot ($key+'.wav')
    if(-not(Test-Path -LiteralPath $file)){
        $temp=$file+'.pending.wav'
        $format=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)
        $synth.SetOutputToWaveFile($temp,$format);$synth.Speak($phrase);$synth.SetOutputToNull()
        Move-Item -LiteralPath $temp -Destination $file
    }
    $manifest+=@{text=$phrase;file=$key+'.wav';voice=$voice.VoiceInfo.Name}
    $i++;if($i%100 -eq 0){Write-Output "Prepared $i / $($phrases.Count) audio files"}
}
# Generated content manifest, not application source.
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $assetRoot 'index.json') -Encoding UTF8
$synth.Dispose();$sha.Dispose()
Write-Output "Offline speech assets: $i. Voice: $($voice.VoiceInfo.Name). Synthetic audio; editorial review still required."
