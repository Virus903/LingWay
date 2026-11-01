using System.IO.Compression;
using System.Text;
using System.Text.Json.Nodes;
using ClosedXML.Excel;
using LingWay.Web.Data;
using LingWay.Web.Data.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic.FileIO;

namespace LingWay.Web.Services;
public sealed class TableService(LingWayDbContext db,AccountService accounts,UserManager<ApplicationUser> users)
{
    public static object Parse(JsonObject body)
    {
        var bytes=Convert.FromBase64String(body.Text("file"));if(bytes.Length>5_000_000)throw new ArgumentException("Максимальный размер — 5 МБ");
        var records=new List<string[]>();var name=body.Text("name");
        if(name.EndsWith(".xlsx",StringComparison.OrdinalIgnoreCase)) {
            using(var zip=new ZipArchive(new MemoryStream(bytes)))if(zip.Entries.Sum(e=>e.Length)>30_000_000)throw new ArgumentException("Слишком большой архив");
            using var wb=new XLWorkbook(new MemoryStream(bytes));var ws=wb.Worksheets.First();
            var count=ws.LastRowUsed()?.RowNumber()??0;var columns=ws.LastColumnUsed()?.ColumnNumber()??0;
            if(count>2001||columns>100)throw new ArgumentException("Максимум 2000 строк и 100 столбцов");
            for(int r=1;r<=count;r++)records.Add(Enumerable.Range(1,columns).Select(c=>ws.Cell(r,c).GetFormattedString()).ToArray());
        } else if(name.EndsWith(".csv",StringComparison.OrdinalIgnoreCase)) {
            var text=Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');var first=text.Split('\n')[0];
            var delimiter=new[]{",",";","\t"}.OrderByDescending(d=>first.Split(d).Length).First();
            using var parser=new TextFieldParser(new StringReader(text));parser.SetDelimiters(delimiter);parser.HasFieldsEnclosedInQuotes=true;
            try {
                while(!parser.EndOfData){records.Add(parser.ReadFields()??[]);if(records.Count>2001)throw new ArgumentException("Максимум 2000 строк");}
            } catch(MalformedLineException ex) { throw new ArgumentException($"CSV: повреждены кавычки или разделители в строке {ex.LineNumber}"); }
        } else throw new ArgumentException("Поддерживаются CSV и XLSX");
        if(records.Count==0||records[0].Length is <1 or >100||records[0].Any(string.IsNullOrWhiteSpace)||records[0].Select(h=>h.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count()!=records[0].Length)throw new ArgumentException("Нужны непустые уникальные заголовки, максимум 100 столбцов");
        var headers=records[0].Select(h=>h.Trim()).ToArray();
        for(int i=1;i<records.Count;i++)if(records[i].Length>headers.Length)throw new ArgumentException($"Строка {i+1}: полей больше, чем заголовков");
        return new{columns=headers,rows=records.Skip(1).Select(r=>headers.Select((h,i)=>new{h,value=i<r.Length?r[i]:""}).ToDictionary(x=>x.h,x=>x.value)).ToArray()};
    }
    public async Task<object> Import(ApplicationUser actor,JsonObject body,bool commit)
    {
        // Validate and persist under one transaction: account creation also uses this DbContext.
        await using var transaction=commit?await db.Database.BeginTransactionAsync():null;
        if(commit)await db.Database.ExecuteSqlRawAsync("DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource='LingWay:import', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000; IF @r<0 THROW 50001, 'Import is busy; retry', 1;");
        var items=body["rows"]?.AsArray()??[];if(items.Count is <1 or >2000)throw new ArgumentException("От 1 до 2000 строк");
        var kind=body.Text("kind","phrases");var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);var errors=new List<object>();var valid=new List<JsonObject>();
        int line=1;
        foreach(var item in items){line++;try{
            var r=item?.AsObject()??throw new ArgumentException("Некорректная строка");var entry=new JsonObject();
            if(kind=="students"){
                var email=r.Text("email").Trim().ToLowerInvariant();
                if(!System.Net.Mail.MailAddress.TryCreate(email,out var parsed)||email!=parsed.Address||email.Length>200||!seen.Add(email))throw new ArgumentException("Некорректная почта или дубликат строки");
                var person=await users.FindByEmailAsync(email);entry["email"]=email;
                if(person!=null){
                    if(!await users.IsInRoleAsync(person,"Student"))throw new ArgumentException("Почта принадлежит сотруднику");
                    if(await db.GroupMembers.AnyAsync(m=>m.GroupId==body.Int("group_id")&&m.UserId==person.Id))throw new ArgumentException("Ученик уже в группе");
                    entry["user_guid"]=person.Id.ToString();entry["id"]=person.LegacyId;
                }else{
                    foreach(var (key,max) in new[]{("first_name",40),("last_name",60),("password",200)}){var value=r.Text(key).Trim();if(value.Length<1||value.Length>max||(key=="password"&&value.Length<8))throw new ArgumentException("Проверьте "+key);entry[key]=value;}
                    var candidate=new ApplicationUser{UserName=email,Email=email};
                    foreach(var validator in users.UserValidators)AccountService.Require(await validator.ValidateAsync(users,candidate));
                    foreach(var validator in users.PasswordValidators)AccountService.Require(await validator.ValidateAsync(users,candidate,entry.Text("password")));
                }
            }else{
                foreach(var (key,max) in new[]{("en",400),("ru",500),("category",100),("ipa",500)}){var value=r.Text(key).Trim();if(value.Length>max||(key!="ipa"&&value.Length==0))throw new ArgumentException("Проверьте "+key);entry[key]=value;}
                var en=entry.Text("en");if(!seen.Add(en)||await db.Phrases.AnyAsync(p=>p.English==en))throw new ArgumentException("Дубликат фразы");
            }
            valid.Add(entry);
        }catch(ArgumentException e){errors.Add(new{row=line,error=e.Message});}}
        if(commit){
            foreach(var r in valid){
                if(kind=="students"){
                    var uid=r.Text("user_guid")!=""?Guid.Parse(r.Text("user_guid")):(await accounts.Create(r.Text("email"),r.Text("password"),r.Text("first_name"),r.Text("last_name"))).Id;
                    db.GroupMembers.Add(new GroupMember{GroupId=body.Int("group_id"),UserId=uid,JoinedAt=DateTime.UtcNow});
                }else db.Phrases.Add(new Phrase{English=r.Text("en"),Translation=r.Text("ru"),Category=r.Text("category"),Transcription=r.Text("ipa")});
            }
            db.ImportBatches.Add(new ImportBatch{Id=Guid.NewGuid(),UserId=actor.Id,Kind=kind,AddedCount=valid.Count,ErrorCount=errors.Count,ErrorsJson=System.Text.Json.JsonSerializer.Serialize(errors),CreatedAt=DateTime.UtcNow});await db.SaveChangesAsync();
            await transaction!.CommitAsync();
        }
        return new{valid=valid.Count,errors,preview=valid.Take(10).Select(r=>r.Where(kv=>kv.Key is not ("password" or "user_guid")).ToDictionary(kv=>kv.Key,kv=>kv.Value?.DeepClone())),added=commit?valid.Count:0};
    }
    static string Safe(string s)=>s.Length>0&&"=+-@".Contains(s[0])?"'"+s:s;
    public static byte[] Csv(List<string[]> rows)=>Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(string.Join("\r\n",rows.Select(r=>string.Join(",",r.Select(s=>"\""+Safe(s).Replace("\"","\"\"")+"\"")))))).ToArray();
    public static byte[] Xlsx(List<string[]> rows)
    {
        using var wb=new XLWorkbook();var ws=wb.AddWorksheet("Прогресс");for(int r=0;r<rows.Count;r++)for(int c=0;c<rows[r].Length;c++)ws.Cell(r+1,c+1).Value=Safe(rows[r][c]);
        ws.SheetView.FreezeRows(1);ws.RangeUsed()?.SetAutoFilter();ws.Row(1).Style.Font.Bold=true;ws.Columns().Width=28;
        using var output=new MemoryStream();wb.SaveAs(output);return output.ToArray();
    }
}
