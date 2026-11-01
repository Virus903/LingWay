using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace LingWay.Web.Services;

public static class JsonFields
{
    public static string Text(this JsonNode? node, string key, string fallback = "") => node?[key]?.ToString() ?? fallback;
    public static int Int(this JsonNode? node, string key, int fallback = 0) => int.TryParse(node.Text(key), out var n) ? n : fallback;
    public static bool Bool(this JsonNode? node, string key) => node.Text(key).Equals("true", StringComparison.OrdinalIgnoreCase) || node.Text(key)=="1";
    public static double Number(this JsonNode? node, string key, double fallback) => double.TryParse(node.Text(key), System.Globalization.CultureInfo.InvariantCulture, out var n) && double.IsFinite(n) ? n : fallback;
    public static JsonObject Object(string? json) => JsonNode.Parse(json ?? "{}")?.AsObject() ?? new();
}

public static class Assessment
{
    public static string Normalize(string value)
    {
        var text=value.ToLowerInvariant().Replace('’','\'');
        var forms=new Dictionary<string,string>{{"i'm","i am"},{"you're","you are"},{"we're","we are"},{"they're","they are"},{"it's","it is"},{"that's","that is"},{"i've","i have"},{"we've","we have"},{"i'll","i will"},{"we'll","we will"},{"can't","cannot"},{"won't","will not"}};
        foreach(var pair in forms)text=Regex.Replace(text,@"\b"+Regex.Escape(pair.Key)+@"\b",pair.Value);
        text=Regex.Replace(text,@"\b(don|doesn|didn|isn|aren|wasn|weren|haven|hasn|hadn|wouldn|shouldn|couldn)'t\b",m=>m.Groups[1].Value[..^1]+" not");
        return Regex.Replace(Regex.Replace(text,@"[^\w\s]",""),@"\s+"," ").Trim();
    }
    // Ratcliff/Obershelp matching, matching the prototype's SequenceMatcher for short phrases.
    public static double Similarity(string a, string b)
    {
        if (a.Length+b.Length==0) return 1;
        int Match(int a0,int a1,int b0,int b1)
        {
            int best=0,ai=a0,bi=b0;
            var previous=new int[b.Length+1];
            for(int i=a0;i<a1;i++) {
                var current=new int[b.Length+1];
                for(int j=b0;j<b1;j++) if(a[i]==b[j]) {
                    current[j+1]=previous[j]+1;
                    if(current[j+1]>best) { best=current[j+1];ai=i-best+1;bi=j-best+1; }
                }
                previous=current;
            }
            return best==0 ? 0 : best+Match(a0,ai,b0,bi)+Match(ai+best,a1,bi+best,b1);
        }
        return 2.0*Match(0,a.Length,0,b.Length)/(a.Length+b.Length);
    }
    static bool SameMeaning(string a,string b)
    {
        string[] negations=["no","not","never","dont","doesnt","didnt","cannot","cant","wont","wouldnt","shouldnt","couldnt","isnt","arent","wasnt","werent","havent","hasnt","hadnt","without"];
        return a.Split(' ').Any(negations.Contains)==b.Split(' ').Any(negations.Contains)
            && Regex.Matches(a,@"\d+").Select(m=>m.Value).SequenceEqual(Regex.Matches(b,@"\d+").Select(m=>m.Value));
    }
    public static JsonObject Check(JsonNode step,string value,double threshold=.82)
    {
        var type=step.Text("type");
        bool correct; string status; double similarity;
        if(type=="vocabulary") { correct=true;status="studied";similarity=1; }
        else if(new[]{"choice","listening","situation"}.Contains(type)) {
            correct=value==step.Text("answer");status=correct?"correct":"incorrect";similarity=correct?1:0;
        } else {
            var v=Normalize(value);
            var choices=(step["accepted"]?.AsArray()??[]).Select(x=>Normalize(x!.ToString())).ToArray();
            correct=choices.Contains(v); similarity=v.Length==0?0:choices.Select(c=>Similarity(v,c)).DefaultIfEmpty().Max();
            var keywords=(step["keywords"]?.AsArray()??[]).Select(x=>Normalize(x!.ToString()));
            var near=v.Length>0&&keywords.All(k=>(" "+v+" ").Contains(" "+k+" "))&&choices.Any(c=>Similarity(v,c)>=threshold&&SameMeaning(v,c));
            status=correct?"correct":near?"near":v.Length==0?"unrecognized":"incorrect";
        }
        return new JsonObject { ["correct"]=correct,["status"]=status,["similarity"]=Math.Round(similarity,2) };
    }
    public static int Next(JsonArray steps,int index,string value)
    {
        var s=steps[index]!;
        foreach(var r in s["routes"]?.AsArray() ?? []) if(Normalize(r.Text("answer"))==Normalize(value)) return r.Int("target");
        return s.Int("next",index+1);
    }
    public static void Validate(JsonArray steps,JsonObject meta)
    {
        if(steps.Count is <1 or >100) throw new ArgumentException("В уроке должно быть от 1 до 100 заданий");
        string[] types=["vocabulary","choice","listening","text","dictation","order","gap","repeat","situation","dialogue"];
        for(int i=0;i<steps.Count;i++) {
            var s=steps[i] ?? throw new ArgumentException("Пустое задание");
            if(!types.Contains(s.Text("type"))||s.Text("prompt").Length is <1 or >2000) throw new ArgumentException("Проверьте тип и текст задания");
            if(new[]{"choice","listening","situation"}.Contains(s.Text("type"))) {
                if(s["options"] is not JsonArray opts || opts.Count is <2 or >10 || s.Int("answer",-1)<0||s.Int("answer")>=opts.Count) throw new ArgumentException("Проверьте варианты ответа");
                if(opts.Any(x=>string.IsNullOrWhiteSpace(x?.ToString()))||opts.Select(x=>Normalize(x!.ToString())).Distinct().Count()!=opts.Count)throw new ArgumentException($"Задание {i+1}: пустые или повторяющиеся варианты");
            } else if(s["accepted"] is not JsonArray accepted||accepted.Count==0||accepted.Any(x=>string.IsNullOrWhiteSpace(x?.ToString()))) throw new ArgumentException("Укажите допустимые ответы");
            foreach(var field in new[]{"accepted","options"})if(s[field] is JsonArray values&&(values.Count>20||values.Any(x=>x!.ToString().Length>2000)))throw new ArgumentException("Слишком много или слишком длинные варианты ответа");
            foreach(var field in new[]{"image","audio_file"}) {
                var media=s.Text(field);if(media.Length==0)continue;
                var prefixes=field=="image"?new[]{"data:image/png;base64,","data:image/jpeg;base64,","data:image/webp;base64,"}:new[]{"data:audio/mpeg;base64,","data:audio/wav;base64,","data:audio/ogg;base64,","data:audio/x-wav;base64,"};
                if(media.Length>1_800_000||!prefixes.Any(media.StartsWith))throw new ArgumentException("Неподдерживаемый медиафайл");
                MediaValidation.Validate(media,field=="image");
            }
            var targets=new List<int>{s.Int("next",i+1)};var seen=new HashSet<string>();
            if(s["keywords"] is JsonArray keywords && (keywords.Count>20||keywords.Any(k=>string.IsNullOrWhiteSpace(k?.ToString())||k!.ToString().Length>100)))throw new ArgumentException($"Задание {i+1}: проверьте ключевые слова");
            foreach(var branch in s["branches"]?.AsArray()??[])
                if(string.IsNullOrWhiteSpace(branch.Text("previous"))||string.IsNullOrWhiteSpace(branch.Text("prompt")))throw new ArgumentException($"Задание {i+1}: пустая реплика ветки диалога");
            foreach(var r in s["routes"]?.AsArray()??[]) {
                if(string.IsNullOrWhiteSpace(r.Text("answer"))||!seen.Add(Normalize(r.Text("answer")))) throw new ArgumentException("Проверьте ответы переходов");
                targets.Add(r.Int("target",-1));
            }
            if(targets.Count>21||targets.Any(t=>t<=i||t>steps.Count)) throw new ArgumentException("Переход должен вести к следующему заданию или завершению");
        }
        var criteria=meta["criteria"];
        if(criteria.Number("pass_score",80) is <50 or >100 || criteria.Number("near_threshold",.82) is <.5 or >.99) throw new ArgumentException("Проверьте критерии оценки");
        if(meta["vocabulary"] is JsonArray words && (words.Count>100||words.Any(w=>string.IsNullOrWhiteSpace(w.Text("en"))||string.IsNullOrWhiteSpace(w.Text("ru"))))) throw new ArgumentException("Проверьте словарь урока");
    }
    public static void ValidatePublication(JsonArray steps,JsonObject meta)
    {
        Validate(steps,meta);
        if(steps.All(s=>s.Text("type")=="vocabulary"))throw new ArgumentException("Добавьте хотя бы одно оцениваемое задание");
        for(int i=0;i<steps.Count;i++) {
            var step=steps[i]!;
            if(step.Text("type")=="listening"&&string.IsNullOrWhiteSpace(step.Text("audio"))&&string.IsNullOrWhiteSpace(step.Text("audio_file")))throw new ArgumentException($"Задание {i+1}: отсутствует озвучка аудирования");
            if(step.Text("type")=="vocabulary"&&string.IsNullOrWhiteSpace(step.Text("ipa")))throw new ArgumentException($"Задание {i+1}: добавьте транскрипцию карточки");
            if(step["routes"] is JsonArray routes&&step["accepted"] is JsonArray accepted)
                foreach(var route in routes)if(!accepted.Any(a=>Normalize(a!.ToString())==Normalize(route.Text("answer"))))throw new ArgumentException($"Задание {i+1}: ответ перехода отсутствует в допустимых ответах");
        }
        var reachable=new HashSet<int>{0};
        for(int i=0;i<steps.Count;i++) if(reachable.Contains(i)) {
            reachable.Add(steps[i].Int("next",i+1));
            foreach(var route in steps[i]?["routes"]?.AsArray()??[])reachable.Add(route.Int("target",-1));
        }
        var missing=Enumerable.Range(0,steps.Count).Where(i=>!reachable.Contains(i)).ToArray();
        if(missing.Length>0)throw new ArgumentException("Недостижимые задания: "+string.Join(", ",missing.Select(i=>i+1)));
        if(meta["vocabulary"] is JsonArray words&&words.Any(w=>string.IsNullOrWhiteSpace(w.Text("ipa"))))throw new ArgumentException("Добавьте транскрипции в словарь перед публикацией");
    }
    public static (int score,int stars,JsonArray results) Score(JsonArray steps,JsonArray answers,JsonObject meta)
    {
        int index=0;var results=new JsonArray();
        foreach(var a in answers) {
            if(index>=steps.Count||a.Int("step_index",index)!=index) throw new ArgumentException("Некорректный маршрут урока");
            var s=steps[index]!;var value=a.Text("value");
            if(value.Length>2000) throw new ArgumentException("Слишком длинный ответ");
            var r=Check(s,value,meta["criteria"].Number("near_threshold",.82));
            var tries=a.Int("tries",1);
            if(tries is <1 or >3)throw new ArgumentException("Допустимо от 1 до 3 попыток на задание");
            r["prompt"]=s.Text("prompt");r["value"]=value;r["hint"]=a.Bool("hint")||a.Int("hint_level")>0;r["hint_level"]=Math.Clamp(a.Int("hint_level"),0,3);r["tries"]=tries;
            r["credit"]=(r.Bool("correct")?1:r.Text("status")=="near"?.5:0)*(tries==1?1:.5);
            r["expected"]=s["options"] is JsonArray options ? options[s.Int("answer")]!.ToString() : s["accepted"]![0]!.ToString();
            r["type"]=s.Text("type");r["step_index"]=index;results.Add(r);
            index=Next(steps,index,value);
        }
        if(index!=steps.Count) throw new ArgumentException("Завершите все задания");
        var graded=results.Where(r=>r.Text("type")!="vocabulary").ToArray();
        int score=(int)Math.Round(100*graded.Sum(r=>r.Number("credit",0))/Math.Max(1,graded.Length),MidpointRounding.AwayFromZero);
        var pass=meta["criteria"].Number("pass_score",80);
        int stars=score>=Math.Max(90,pass)&&!graded.Any(r=>r.Bool("hint")||r.Int("tries")>1)?3:score>=pass?2:score>=50?1:0;
        return(score,stars,results);
    }
}
