using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using LingWay.Web.Data;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Services;

public sealed record OfflineAsset(string Url, string Sha256, long Bytes, string Type);
public sealed class OfflinePackageService(IWebHostEnvironment env)
{
    readonly SemaphoreSlim gate = new(1,1);
    JsonObject? manifest;
    string signature="";
    string Root => Path.Combine(env.ContentRootPath,"App_Data","offline-public");

    OfflineAsset Store(byte[] bytes,string extension,string type)
    {
        Directory.CreateDirectory(Root);
        var hash=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var name=hash+"."+extension;var target=Path.Combine(Root,name);
        if(!File.Exists(target))File.WriteAllBytes(target,bytes); // Serialized by gate; manifest appears only after all writes.
        return new("/offline-assets/"+name,hash,bytes.LongLength,type);
    }

    public async Task<JsonObject> Manifest(LingWayDbContext db)
    {
        var package=await db.ContentPackages.AsNoTracking().OrderByDescending(x=>x.Id).FirstAsync();
        var audioPath=Path.Combine(env.ContentRootPath,"App_Data","offline-audio","index.json");
        var current=package.Id+":"+(File.Exists(audioPath)?File.GetLastWriteTimeUtc(audioPath).Ticks:0);
        await gate.WaitAsync();
        try
        {
            if(current==signature&&manifest!=null)return manifest.DeepClone().AsObject();
            var assets=new Dictionary<string,OfflineAsset>();
            OfflineAsset Add(byte[] bytes,string ext,string type) {var a=Store(bytes,ext,type);assets[a.Url]=a;return a;}
            var content=JsonNode.Parse(package.ContentJson)!.AsObject();
            var publishedStrings=new HashSet<string>(StringComparer.Ordinal);
            void Collect(JsonNode? node)
            {
                if(node is JsonObject obj)foreach(var kv in obj)Collect(kv.Value);
                else if(node is JsonArray arr)foreach(var entry in arr)Collect(entry);
                else if(node is JsonValue value&&value.TryGetValue<string>(out var str))publishedStrings.Add(str.Trim());
            }
            Collect(content);
            var parts=new JsonObject();
            foreach(var field in new[]{"modules","lessons","phrases"})
            {
                var chunks=new JsonArray();
                foreach(var entry in content[field]?.AsArray()??[])
                {
                    var a=Add(Encoding.UTF8.GetBytes(entry!.ToJsonString()),"json","application/json");
                    chunks.Add(a.Url);
                }
                parts[field]=chunks;
            }
            var audioMap=new JsonObject();
            if(File.Exists(audioPath))
            {
                foreach(var item in JsonNode.Parse(await File.ReadAllTextAsync(audioPath))!.AsArray())
                {
                    if(!publishedStrings.Contains(item.Text("text")))continue;
                    var name=item.Text("file");
                    if(!Regex.IsMatch(name,"^[a-f0-9]{64}\\.wav$"))continue;
                    var path=Path.Combine(Path.GetDirectoryName(audioPath)!,name);
                    var a=Add(await File.ReadAllBytesAsync(path),"wav","audio/wav");
                    audioMap[item.Text("text")]=a.Url;
                }
            }
            // Static code-native illustrations and logos are part of the downloaded content, too.
            foreach(var file in new[]{"learning_visuals.js","lingway-logo-light.svg","lingway-logo-dark.svg","icon.svg"})
                Add(await File.ReadAllBytesAsync(Path.Combine(env.WebRootPath,file)),Path.GetExtension(file)[1..],file.EndsWith("svg")?"image/svg+xml":"text/javascript");
            manifest=new JsonObject {
                ["id"]=package.Id,["schema"]=1,["created"]=LearningService.Iso(package.PublishedAt),
                ["bytes"]=assets.Values.Sum(a=>a.Bytes),["parts"]=parts,["audio"]=audioMap,
                ["assets"]=JsonSerializer.SerializeToNode(assets.Values,new JsonSerializerOptions{PropertyNamingPolicy=JsonNamingPolicy.CamelCase}),
                ["audio_source"]="Microsoft Zira Desktop / synthetic speech"
            };
            manifest["revision"]=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(manifest.ToJsonString()))).ToLowerInvariant();
            signature=current;return manifest.DeepClone().AsObject();
        }
        finally {gate.Release();}
    }
    public string? AssetPath(string name) => Regex.IsMatch(name,"^[a-f0-9]{64}\\.(json|wav|svg|js)$") && File.Exists(Path.Combine(Root,name)) ? Path.Combine(Root,name):null;
}
