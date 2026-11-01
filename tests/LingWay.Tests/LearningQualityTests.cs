using System.Text.Json.Nodes;
using LingWay.Web.Services;

namespace LingWay.Tests;

public class LearningQualityTests
{
    static JsonObject Step(string answer)=>new(){["type"]="text",["prompt"]="Translate",["accepted"]=new JsonArray(answer)};
    [Theory]
    [InlineData("I will travel", "I won't travel")]
    [InlineData("She has a ticket", "She hasn't a ticket")]
    [InlineData("From 12 to 14", "From 14 to 12")]
    public void MeaningChangesAreNotNear(string expected,string value)=>Assert.Equal("incorrect",Assessment.Check(Step(expected),value,.5).Text("status"));
    [Fact] public void MissingKeywordIsNotNear() {
        var s=Step("I need a refund please");s["keywords"]=new JsonArray("refund");
        Assert.Equal("incorrect",Assessment.Check(s,"I need a refun please").Text("status"));
    }
    [Fact] public void RepeatedAnswerHasHalfCredit() {
        var (score,stars,results)=Assessment.Score(new JsonArray(Step("yes")),new JsonArray(new JsonObject{["value"]="yes",["tries"]=2}),new());
        Assert.Equal(50,score);Assert.Equal(1,stars);Assert.Equal(2,results[0].Int("tries"));
    }
    [Fact] public void HintLevelCannotBypassStarRule() {
        var (_,stars,_)=Assessment.Score(new JsonArray(Step("yes")),new JsonArray(new JsonObject{["value"]="yes",["hint_level"]=3}),new());
        Assert.Equal(2,stars);
    }
    [Fact] public void RejectsFourthTry()=>Assert.Throws<ArgumentException>(()=>Assessment.Score(new JsonArray(Step("yes")),new JsonArray(new JsonObject{["value"]="yes",["tries"]=4}),new()));
    [Fact] public void PublicationRejectsUnreachableStep() {
        var s=Step("yes");s["next"]=2;
        Assert.Throws<ArgumentException>(()=>Assessment.ValidatePublication(new JsonArray(s,Step("no")),new()));
    }
    [Fact] public void PublishedCoursePassesValidation() {
        var path=Path.Combine(AppContext.BaseDirectory,"Fixtures/learning-content.json");
        Assert.True(File.Exists(path), "The educational content fixture must be included in the test build.");
        foreach(var lesson in JsonNode.Parse(File.ReadAllText(path))!.AsArray()) {
            Assessment.ValidatePublication(lesson!["steps"]!.AsArray(),lesson["meta"]!.AsObject());
            var steps=lesson["steps"]!.AsArray();
            foreach(var alternative in new[]{false,true}) {
                var answers=new JsonArray();int index=0,dialogues=0;
                while(index<steps.Count) {
                    var step=steps[index]!;
                    var value=step["options"]!=null?step.Text("answer"):step["accepted"]![0]!.ToString();
                    if(alternative&&step["routes"] is JsonArray routes&&routes.Count>1)value=routes[1].Text("answer");
                    answers.Add(new JsonObject{["step_index"]=index,["value"]=value});
                    if(step.Text("type")=="dialogue")dialogues++;
                    index=Assessment.Next(steps,index,value);
                }
                Assert.True(dialogues>=5);
                var (score,stars,_)=Assessment.Score(steps,answers,lesson["meta"]!.AsObject());
                Assert.Equal(100,score);Assert.Equal(3,stars);
            }
        }
    }
    [Theory]
    [InlineData("en, EN\r\na,b")]
    [InlineData("en,ru\r\na,b,c")]
    [InlineData("en,ru\r\n\"unterminated,b")]
    public void InvalidCsvProducesReadableError(string csv) {
        var body=new JsonObject{["name"]="test.csv",["file"]=Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(csv))};
        Assert.Throws<ArgumentException>(()=>TableService.Parse(body));
    }
}
