namespace LingWay.Web.Services;
public sealed class SubmissionConflictException : Exception
{
    public SubmissionConflictException() : base("Этот ID попытки уже принят с другим содержимым") { }
}
