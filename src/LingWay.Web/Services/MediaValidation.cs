using System.Buffers.Binary;
using System.Text;

namespace LingWay.Web.Services;
public static class MediaValidation
{
    public static void Validate(string dataUri,bool image)
    {
        if(dataUri.Length>1_800_000)throw new ArgumentException("Слишком большой медиафайл");
        var comma=dataUri.IndexOf(',');if(comma<0)throw new ArgumentException("Повреждённый медиафайл");
        byte[] b;try { b=Convert.FromBase64String(dataUri[(comma+1)..]); }catch(FormatException){throw new ArgumentException("Повреждённый медиафайл");}
        var header=dataUri[..comma];
        var valid=false;
        if(image)
        {
            if(header=="data:image/png;base64"&&b.Length>=33&&b.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}))
            {
                var w=BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(16,4));var h=BinaryPrimitives.ReadUInt32BigEndian(b.AsSpan(20,4));
                valid=w>0&&h>0&&w<=8192&&h<=8192&&(long)w*h<=32_000_000;
            }
            if(header=="data:image/jpeg;base64")valid=b.Length>=4&&b[0]==255&&b[1]==216&&b[^2]==255&&b[^1]==217;
            if(header=="data:image/webp;base64")valid=b.Length>=16&&Encoding.ASCII.GetString(b,0,4)=="RIFF"&&Encoding.ASCII.GetString(b,8,4)=="WEBP";
        }
        else
        {
            if(header is "data:audio/wav;base64" or "data:audio/x-wav;base64")valid=b.Length>=44&&Encoding.ASCII.GetString(b,0,4)=="RIFF"&&Encoding.ASCII.GetString(b,8,4)=="WAVE";
            if(header=="data:audio/ogg;base64")valid=b.Length>=28&&Encoding.ASCII.GetString(b,0,4)=="OggS";
            if(header=="data:audio/mpeg;base64")valid=b.Length>=3&&(Encoding.ASCII.GetString(b,0,3)=="ID3"||(b[0]==255&&(b[1]&224)==224));
        }
        if(!valid)throw new ArgumentException("Содержимое медиафайла не соответствует заявленному формату");
    }
}
