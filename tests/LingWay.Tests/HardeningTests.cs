using System.Text.Json.Nodes;
using LingWay.Web.Services;
namespace LingWay.Tests;
public class HardeningTests
{
    [Theory]
    [InlineData("22:30","23:00","22:00","08:00",true,false,false)]
    [InlineData("08:00","23:00","22:00","08:00",true,false,true)]
    [InlineData("19:00","19:00","22:00","08:00",true,true,false)]
    [InlineData("19:00","19:00","22:00","08:00",false,false,false)]
    [InlineData("19:00","19:00","22:00","22:00",true,false,true)]
    [InlineData("12:00","12:00","11:00","13:00",true,false,false)]
    [InlineData("13:00","12:00","11:00","13:00",true,false,true)]
    public void RemindersRespectHours(string now,string at,string start,string end,bool enabled,bool sent,bool expected)
        =>Assert.Equal(expected,PushService.IsDue(TimeOnly.Parse(now),TimeOnly.Parse(at),TimeOnly.Parse(start),TimeOnly.Parse(end),enabled,sent));
    [Fact] public void HashIgnoresJsonPropertyOrder()
    {
        var a=JsonNode.Parse("{\"lesson_id\":1,\"version\":2,\"answers\":[{\"value\":\"yes\",\"step_index\":0}]}")!.AsObject();
        var b=JsonNode.Parse("{\"answers\":[{\"step_index\":0,\"value\":\"yes\"}],\"version\":2,\"lesson_id\":1}")!.AsObject();
        Assert.Equal(LearningService.SubmissionHash(a),LearningService.SubmissionHash(b));
        b["answers"]![0]!["value"]="no";
        Assert.NotEqual(LearningService.SubmissionHash(a),LearningService.SubmissionHash(b));
    }
    [Theory]
    [InlineData("data:image/png;base64,PHNjcmlwdD4=",true)]
    [InlineData("data:audio/wav;base64,PHNjcmlwdD4=",false)]
    [InlineData("data:image/svg+xml;base64,PHN2Zz4=",true)]
    public void RejectsDisguisedMedia(string content,bool image)=>Assert.Throws<ArgumentException>(()=>MediaValidation.Validate(content,image));
}
