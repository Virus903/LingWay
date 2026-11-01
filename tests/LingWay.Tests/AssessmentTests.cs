using System.Text.Json.Nodes;
using LingWay.Web.Services;

namespace LingWay.Tests;
public class AssessmentTests
{
    static JsonObject Step(string answer)=>new(){["type"]="text",["prompt"]="Say it",["accepted"]=new JsonArray(answer)};
    [Theory]
    [InlineData("Hello, please!","hello please","correct")]
    [InlineData("I need a ticket","I need a tiket","near")]
    [InlineData("I need 2 tickets","I need 3 tickets","incorrect")]
    [InlineData("I want a ticket","I dont want a ticket","incorrect")]
    [InlineData("Hello","","unrecognized")]
    public void GradesText(string expected,string actual,string status)=>Assert.Equal(status,Assessment.Check(Step(expected),actual).Text("status"));
    [Fact] public void VocabularyIsNotGraded(){var s=Step("hello");s["type"]="vocabulary";Assert.Equal("studied",Assessment.Check(s,"").Text("status"));}
    [Fact] public void RejectsIncompletePath(){var steps=new JsonArray(Step("one"),Step("two"));Assert.Throws<ArgumentException>(()=>Assessment.Score(steps,[],new()));}
    [Fact] public void BranchesFollowAnswer(){var s=Step("yes");s["routes"]=new JsonArray(new JsonObject{["answer"]="yes",["target"]=2});var steps=new JsonArray(s,Step("skip"),Step("end"));Assert.Equal(2,Assessment.Next(steps,0,"YES!"));}
    [Fact] public void RejectsBackwardRoutes(){var s=Step("yes");s["next"]=0;Assert.Throws<ArgumentException>(()=>Assessment.Validate(new JsonArray(s),new()));}
    [Fact] public void HintsReduceStars(){var (score,stars,_)=Assessment.Score(new JsonArray(Step("yes")),new JsonArray(new JsonObject{["value"]="yes",["hint"]=true}),new());Assert.Equal(100,score);Assert.Equal(2,stars);}
    [Fact] public void NearIsHalfCredit(){var (score,_,_)=Assessment.Score(new JsonArray(Step("I need a ticket")),new JsonArray(new JsonObject{["value"]="I need a tiket"}),new());Assert.Equal(50,score);}
    [Theory]
    [InlineData("http://localhost/push",false)]
    [InlineData("https://fcm.googleapis.com/fcm/send/abc",true)]
    [InlineData("https://fcm.googleapis.com.evil.test/x",false)]
    [InlineData("https://fcm.googleapis.com:8080/x",false)]
    public void PushEndpointsAreRestricted(string endpoint,bool allowed)=>Assert.Equal(allowed,PushService.Allowed(endpoint));
    [Fact] public void SpreadsheetFormulaIsEscaped(){var csv=System.Text.Encoding.UTF8.GetString(TableService.Csv([new[]{"=HYPERLINK(\"bad\")"}]));Assert.Contains("'=HYPERLINK",csv);}
}
