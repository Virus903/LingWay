using System.Net;
using System.Net.Mail;

namespace LingWay.Web.Services;

public sealed class MailService(IConfiguration config, IWebHostEnvironment env, ILogger<MailService> logger)
{
    public bool Local => env.IsDevelopment() && config["Mail:Mode"] == "Local";

    public void EnsureConfigured()
    {
        if (Local) return;
        if (config["Mail:Mode"] != "Smtp" || string.IsNullOrWhiteSpace(config["Mail:Password"]))
            throw new ArgumentException("Отправка почты ещё не настроена. Администратору нужно задать пароль приложения SMTP.");
    }

    public async Task SendCode(string email, string purpose, string code)
    {
        EnsureConfigured();
        if (Local)
        {
            var folder = Path.Combine(env.ContentRootPath, "App_Data");
            Directory.CreateDirectory(folder);
            await File.AppendAllTextAsync(Path.Combine(folder, "mailbox.txt"),
                $"{DateTime.UtcNow:O} | {email} | {purpose} | {code}{Environment.NewLine}");
            return;
        }

        using var message = new MailMessage();
        message.From = new MailAddress(config["Mail:From"]!, "LingWay");
        message.To.Add(new MailAddress(email));
        message.Subject = purpose == "verify" ? "LingWay: подтверждение почты" : "LingWay: восстановление доступа";
        message.Body = $"Ваш код: {code}\n\nОн действует 15 минут. Никому не сообщайте код.\nЕсли вы не запрашивали его, проигнорируйте письмо.";
        using var smtp = new SmtpClient(config["Mail:Host"], config.GetValue("Mail:Port", 587))
        {
            EnableSsl = true,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(config["Mail:User"], config["Mail:Password"]),
            Timeout = 20000
        };
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(25));
            await smtp.SendMailAsync(message, timeout.Token);
        }
        catch (Exception ex) when (ex is SmtpException or OperationCanceledException)
        {
            // Do not log the address, credentials, body or verification code.
            logger.LogWarning("SMTP delivery failed ({Type})", ex.GetType().Name);
            throw new ArgumentException("Не удалось отправить письмо. Попробуйте позже или сообщите администратору.");
        }
    }
}
