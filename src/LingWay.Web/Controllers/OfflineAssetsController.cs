using LingWay.Web.Data;
using LingWay.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LingWay.Web.Controllers;
[ApiController]
public sealed class OfflineAssetsController(OfflinePackageService packages,LingWayDbContext db):ControllerBase
{
    [Authorize,HttpGet("api/offline-manifest")]
    public async Task<IActionResult> Manifest()=>Ok(await packages.Manifest(db));

    // Only hash-addressed, published course content; never user data or arbitrary disk paths.
    [HttpGet("offline-assets/{name}")]
    public IActionResult Asset(string name)
    {
        var path=packages.AssetPath(name);if(path==null)return NotFound();
        Response.Headers.CacheControl="public,max-age=31536000,immutable";
        var type=Path.GetExtension(path) switch { ".wav"=>"audio/wav",".svg"=>"image/svg+xml",".js"=>"text/javascript",_=>"application/json" };
        return PhysicalFile(path,type,enableRangeProcessing:true);
    }
}
