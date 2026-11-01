using System.Security.Cryptography;
using System.Text.Json.Nodes;
using LingWay.Web.Data.Entities;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Controllers;

public partial class ApiController
{
    string MediaRoot => Path.Combine(HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().ContentRootPath,"App_Data","media-library");

    [HttpGet("media")]
    public async Task<IActionResult> MediaLibrary()
    {
        await Current(); RequireAdmin();
        return Ok(await db.MediaFiles.AsNoTracking().OrderByDescending(m=>m.CreatedAt)
            .Select(m=>new {id=m.Id,name=m.OriginalName,type=m.ContentType,bytes=m.SizeBytes}).ToListAsync());
    }

    [HttpGet("media/{id:guid}")]
    public async Task<IActionResult> MediaContent(Guid id)
    {
        await Current(); RequireAdmin();
        var item=await db.MediaFiles.FindAsync(id)??throw new ArgumentException("Файл не найден");
        // Only read content-addressed files created by this endpoint, never arbitrary legacy paths.
        if(!System.Text.RegularExpressions.Regex.IsMatch(item.StoragePath,"^[A-F0-9]{64}\\.bin$"))
            throw new ArgumentException("Этот старый файл необходимо загрузить в медиатеку повторно");
        var path=Path.Combine(MediaRoot,item.StoragePath);
        if(!System.IO.File.Exists(path))throw new ArgumentException("Файл недоступен. Загрузите его повторно");
        return Ok(new {data_uri=$"data:{item.ContentType};base64,{Convert.ToBase64String(await System.IO.File.ReadAllBytesAsync(path))}"});
    }

    [HttpPost("media")]
    public async Task<IActionResult> UploadMedia([FromBody]JsonObject body)
    {
        var user=await Write(); RequireAdmin();
        var uri=Text(body,"data_uri",1_800_000);
        var isImage=uri.StartsWith("data:image/",StringComparison.Ordinal);
        var allowed=isImage?new[]{"image/png","image/jpeg","image/webp"}:new[]{"audio/mpeg","audio/wav","audio/x-wav","audio/ogg"};
        var type=allowed.FirstOrDefault(t=>uri.StartsWith($"data:{t};base64,",StringComparison.Ordinal))??throw new ArgumentException("Неподдерживаемый формат");
        MediaValidation.Validate(uri,isImage);
        var bytes=Convert.FromBase64String(uri[(uri.IndexOf(',')+1)..]);
        var name=Text(body,"name",200);
        var filename=Convert.ToHexString(SHA256.HashData(bytes))+".bin";
        await using var transaction=await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='LingWay:media', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 50001, 'Media is busy', 1;");
        var existing=await db.MediaFiles.FirstOrDefaultAsync(m=>m.StoragePath==filename&&m.ContentType==type);
        Directory.CreateDirectory(MediaRoot);
        await System.IO.File.WriteAllBytesAsync(Path.Combine(MediaRoot,filename),bytes);
        if(existing==null) {
            existing=new MediaFile {Id=Guid.NewGuid(),UploadedBy=user.Id,OriginalName=name,ContentType=type,SizeBytes=bytes.Length,StoragePath=filename,CreatedAt=DateTime.UtcNow};
            db.MediaFiles.Add(existing);await db.SaveChangesAsync();
        }
        await transaction.CommitAsync();
        return Ok(new{id=existing.Id,name=existing.OriginalName});
    }
}
