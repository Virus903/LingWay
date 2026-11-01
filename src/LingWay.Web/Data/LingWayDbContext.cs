using System;
using System.Collections.Generic;
using LingWay.Web.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LingWay.Web.Data;

public partial class LingWayDbContext : DbContext
{
    public LingWayDbContext(DbContextOptions<LingWayDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Achievement> Achievements { get; set; }

    public virtual DbSet<ApplicationCode> ApplicationCodes { get; set; }

    public virtual DbSet<AspNetRole> AspNetRoles { get; set; }

    public virtual DbSet<AspNetRoleClaim> AspNetRoleClaims { get; set; }

    public virtual DbSet<AspNetUser> AspNetUsers { get; set; }

    public virtual DbSet<AspNetUserClaim> AspNetUserClaims { get; set; }

    public virtual DbSet<AspNetUserLogin> AspNetUserLogins { get; set; }

    public virtual DbSet<AspNetUserToken> AspNetUserTokens { get; set; }

    public virtual DbSet<Assignment> Assignments { get; set; }

    public virtual DbSet<Attempt> Attempts { get; set; }

    public virtual DbSet<AttemptAnswer> AttemptAnswers { get; set; }

    public virtual DbSet<AuditEvent> AuditEvents { get; set; }

    public virtual DbSet<ContentPackage> ContentPackages { get; set; }

    public virtual DbSet<FavoritePhrase> FavoritePhrases { get; set; }

    public virtual DbSet<GroupMember> GroupMembers { get; set; }

    public virtual DbSet<ImportBatch> ImportBatches { get; set; }

    public virtual DbSet<LegacyPasswordCredential> LegacyPasswordCredentials { get; set; }

    public virtual DbSet<Lesson> Lessons { get; set; }

    public virtual DbSet<LessonVersion> LessonVersions { get; set; }

    public virtual DbSet<MediaFile> MediaFiles { get; set; }

    public virtual DbSet<Module> Modules { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<PassportStamp> PassportStamps { get; set; }

    public virtual DbSet<Phrase> Phrases { get; set; }

    public virtual DbSet<PhraseReview> PhraseReviews { get; set; }

    public virtual DbSet<PushSubscription> PushSubscriptions { get; set; }

    public virtual DbSet<RecentPhrase> RecentPhrases { get; set; }

    public virtual DbSet<SchemaVersion> SchemaVersions { get; set; }

    public virtual DbSet<StudyGroup> StudyGroups { get; set; }

    public virtual DbSet<UserAchievement> UserAchievements { get; set; }

    public virtual DbSet<UserProfile> UserProfiles { get; set; }

    public virtual DbSet<VocabularyItem> VocabularyItems { get; set; }

    public virtual DbSet<VwLearningResult> VwLearningResults { get; set; }

    public virtual DbSet<VwLesson> VwLessons { get; set; }

    public virtual DbSet<VwLessonStep> VwLessonSteps { get; set; }

    public virtual DbSet<VwUser> VwUsers { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Achievement>(entity =>
        {
            entity.HasKey(e => e.Code);

            entity.Property(e => e.Code)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Title).HasMaxLength(100);
        });

        modelBuilder.Entity<ApplicationCode>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.Purpose }).HasName("PK__Applicat__91624BE225254C2C");

            entity.Property(e => e.Purpose)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.CodeHash)
                .HasMaxLength(64)
                .IsUnicode(false)
                .IsFixedLength();

            entity.HasOne(d => d.User).WithMany(p => p.ApplicationCodes)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__Applicati__UserI__7D0E9093");
        });

        modelBuilder.Entity<AspNetRole>(entity =>
        {
            entity.HasIndex(e => e.NormalizedName, "RoleNameIndex")
                .IsUnique()
                .HasFilter("([NormalizedName] IS NOT NULL)");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Name).HasMaxLength(256);
            entity.Property(e => e.NormalizedName).HasMaxLength(256);
        });

        modelBuilder.Entity<AspNetRoleClaim>(entity =>
        {
            entity.HasIndex(e => e.RoleId, "IX_AspNetRoleClaims_RoleId");

            entity.HasOne(d => d.Role).WithMany(p => p.AspNetRoleClaims)
                .HasForeignKey(d => d.RoleId)
                .HasConstraintName("FK__AspNetRol__RoleI__619B8048");
        });

        modelBuilder.Entity<AspNetUser>(entity =>
        {
            entity.HasIndex(e => e.NormalizedEmail, "EmailIndex");

            entity.HasIndex(e => e.LegacyId, "IX_Users_LegacyId")
                .IsUnique()
                .HasFilter("([LegacyId] IS NOT NULL)");

            entity.HasIndex(e => e.NormalizedUserName, "UserNameIndex")
                .IsUnique()
                .HasFilter("([NormalizedUserName] IS NOT NULL)");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.LegacyDisplayName).HasMaxLength(200);
            entity.Property(e => e.LockoutEnabled).HasDefaultValue(true, "DF_Users_Lockout");
            entity.Property(e => e.NormalizedEmail).HasMaxLength(256);
            entity.Property(e => e.NormalizedUserName).HasMaxLength(256);
            entity.Property(e => e.UserName).HasMaxLength(256);

            entity.HasMany(d => d.Roles).WithMany(p => p.Users)
                .UsingEntity<Dictionary<string, object>>(
                    "AspNetUserRole",
                    r => r.HasOne<AspNetRole>().WithMany()
                        .HasForeignKey("RoleId")
                        .HasConstraintName("FK__AspNetUse__RoleI__5BE2A6F2"),
                    l => l.HasOne<AspNetUser>().WithMany()
                        .HasForeignKey("UserId")
                        .HasConstraintName("FK__AspNetUse__UserI__5AEE82B9"),
                    j =>
                    {
                        j.HasKey("UserId", "RoleId");
                        j.ToTable("AspNetUserRoles");
                        j.HasIndex(new[] { "RoleId" }, "IX_AspNetUserRoles_RoleId");
                    });
        });

        modelBuilder.Entity<AspNetUserClaim>(entity =>
        {
            entity.HasIndex(e => e.UserId, "IX_AspNetUserClaims_UserId");

            entity.HasOne(d => d.User).WithMany(p => p.AspNetUserClaims)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__AspNetUse__UserI__5EBF139D");
        });

        modelBuilder.Entity<AspNetUserLogin>(entity =>
        {
            entity.HasKey(e => new { e.LoginProvider, e.ProviderKey });

            entity.HasIndex(e => e.UserId, "IX_AspNetUserLogins_UserId");

            entity.Property(e => e.LoginProvider).HasMaxLength(128);
            entity.Property(e => e.ProviderKey).HasMaxLength(128);

            entity.HasOne(d => d.User).WithMany(p => p.AspNetUserLogins)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__AspNetUse__UserI__6477ECF3");
        });

        modelBuilder.Entity<AspNetUserToken>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.LoginProvider, e.Name });

            entity.Property(e => e.LoginProvider).HasMaxLength(128);
            entity.Property(e => e.Name).HasMaxLength(128);

            entity.HasOne(d => d.User).WithMany(p => p.AspNetUserTokens)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__AspNetUse__UserI__6754599E");
        });

        modelBuilder.Entity<Assignment>(entity =>
        {
            entity.HasIndex(e => new { e.GroupId, e.ModuleId }, "UX_Assignments_Group").IsUnique().HasFilter("[StudentId] IS NULL");
            entity.HasIndex(e => new { e.GroupId, e.ModuleId, e.StudentId }, "UX_Assignments_Student").IsUnique().HasFilter("[StudentId] IS NOT NULL");

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Group).WithMany(p => p.Assignments)
                .HasForeignKey(d => d.GroupId)
                .HasConstraintName("FK__Assignmen__Group__17F790F9");

            entity.HasOne(d => d.Module).WithMany(p => p.Assignments)
                .HasForeignKey(d => d.ModuleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Assignmen__Modul__18EBB532");
        });

        modelBuilder.Entity<Attempt>(entity =>
        {
            entity.HasIndex(e => new { e.LessonId, e.CompletedAt }, "IX_Attempts_LessonDate");

            entity.HasIndex(e => new { e.UserId, e.CompletedAt }, "IX_Attempts_UserDate");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.ReceivedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Score).HasColumnType("decimal(5, 2)");

            entity.HasOne(d => d.User).WithMany(p => p.Attempts)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Attempts__UserId__1CBC4616");

            entity.HasOne(d => d.LessonVersionNavigation).WithMany(p => p.Attempts)
                .HasForeignKey(d => new { d.LessonId, d.LessonVersion })
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Attempts_Version");
        });

        modelBuilder.Entity<AttemptAnswer>(entity =>
        {
            entity.HasKey(e => new { e.AttemptId, e.SequenceNumber });

            entity.Property(e => e.ExerciseType)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.ExpectedAnswer).HasMaxLength(2000);
            entity.Property(e => e.Prompt).HasMaxLength(2000);
            entity.Property(e => e.Status)
                .HasMaxLength(15)
                .IsUnicode(false);
            entity.Property(e => e.UserAnswer).HasMaxLength(2000);

            entity.HasOne(d => d.Attempt).WithMany(p => p.AttemptAnswers)
                .HasForeignKey(d => d.AttemptId)
                .HasConstraintName("FK__AttemptAn__Attem__245D67DE");
        });

        modelBuilder.Entity<AuditEvent>(entity =>
        {
            entity.HasIndex(e => e.CreatedAt, "IX_AuditEvents_Date");

            entity.Property(e => e.Action).HasMaxLength(300);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.User).WithMany(p => p.AuditEvents)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__AuditEven__UserI__634EBE90");
        });

        modelBuilder.Entity<ContentPackage>(entity =>
        {
            entity.Property(e => e.PublishedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Sha256)
                .HasMaxLength(64)
                .IsUnicode(false)
                .IsFixedLength();
        });

        modelBuilder.Entity<FavoritePhrase>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.PhraseId });

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Phrase).WithMany(p => p.FavoritePhrases)
                .HasForeignKey(d => d.PhraseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__FavoriteP__Phras__2DE6D218");

            entity.HasOne(d => d.User).WithMany(p => p.FavoritePhrases)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__FavoriteP__UserI__2CF2ADDF");
        });

        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.HasKey(e => new { e.GroupId, e.UserId });

            entity.HasIndex(e => e.UserId, "IX_GroupMembers_UserId");

            entity.Property(e => e.JoinedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Group).WithMany(p => p.GroupMembers)
                .HasForeignKey(d => d.GroupId)
                .HasConstraintName("FK__GroupMemb__Group__123EB7A3");

            entity.HasOne(d => d.User).WithMany(p => p.GroupMembers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__GroupMemb__UserI__1332DBDC");
        });

        modelBuilder.Entity<ImportBatch>(entity =>
        {
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Kind)
                .HasMaxLength(20)
                .IsUnicode(false);

            entity.HasOne(d => d.User).WithMany(p => p.ImportBatches)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__ImportBat__UserI__5BAD9CC8");
        });

        modelBuilder.Entity<LegacyPasswordCredential>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PK__LegacyPa__1788CC4CC2E72C2C");

            entity.Property(e => e.UserId).ValueGeneratedNever();
            entity.Property(e => e.Algorithm)
                .HasMaxLength(30)
                .IsUnicode(false);
            entity.Property(e => e.HashHex)
                .HasMaxLength(128)
                .IsUnicode(false);
            entity.Property(e => e.SaltHex)
                .HasMaxLength(32)
                .IsUnicode(false);

            entity.HasOne(d => d.User).WithOne(p => p.LegacyPasswordCredential)
                .HasForeignKey<LegacyPasswordCredential>(d => d.UserId)
                .HasConstraintName("FK__LegacyPas__UserI__6EC0713C");
        });

        modelBuilder.Entity<Lesson>(entity =>
        {
            entity.HasIndex(e => new { e.ModuleId, e.SortOrder }, "UQ_Lessons_Order").IsUnique();

            entity.Property(e => e.Description).HasMaxLength(2000);
            entity.Property(e => e.EnglishLevel)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasDefaultValue("A1");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.Module).WithMany(p => p.Lessons)
                .HasForeignKey(d => d.ModuleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Lessons__ModuleI__01142BA1");
        });

        modelBuilder.Entity<LessonVersion>(entity =>
        {
            entity.HasKey(e => new { e.LessonId, e.Version });

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Lesson).WithMany(p => p.LessonVersions)
                .HasForeignKey(d => d.LessonId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__LessonVer__Lesso__06CD04F7");
        });

        modelBuilder.Entity<MediaFile>(entity =>
        {
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.ContentType)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.OriginalName).HasMaxLength(255);
            entity.Property(e => e.StoragePath).HasMaxLength(500);

            entity.HasOne(d => d.UploadedByNavigation).WithMany(p => p.MediaFiles)
                .HasForeignKey(d => d.UploadedBy)
                .HasConstraintName("FK__MediaFile__Uploa__56E8E7AB");
        });

        modelBuilder.Entity<Module>(entity =>
        {
            entity.HasIndex(e => e.SortOrder, "UQ_Modules_Order").IsUnique();

            entity.Property(e => e.Description).HasMaxLength(2000);
            entity.Property(e => e.Title).HasMaxLength(200);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.CreatedAt }, "IX_Notifications_UserDate");

            entity.Property(e => e.Body).HasMaxLength(2000);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.TargetUrl).HasMaxLength(500);
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.User).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__Notificat__UserI__4E53A1AA");
        });

        modelBuilder.Entity<PassportStamp>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.ModuleId });

            entity.Property(e => e.EarnedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Module).WithMany(p => p.PassportStamps)
                .HasForeignKey(d => d.ModuleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__PassportS__Modul__45BE5BA9");

            entity.HasOne(d => d.User).WithMany(p => p.PassportStamps)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__PassportS__UserI__44CA3770");
        });

        modelBuilder.Entity<Phrase>(entity =>
        {
            entity.HasIndex(e => e.English, "UQ_Phrases_English").IsUnique();

            entity.Property(e => e.AudioPath).HasMaxLength(500);
            entity.Property(e => e.Category).HasMaxLength(100);
            entity.Property(e => e.English).HasMaxLength(400);
            entity.Property(e => e.Transcription).HasMaxLength(500);
            entity.Property(e => e.Translation).HasMaxLength(500);
        });

        modelBuilder.Entity<PhraseReview>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.PhraseId });

            entity.HasOne(d => d.Phrase).WithMany(p => p.PhraseReviews)
                .HasForeignKey(d => d.PhraseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__PhraseRev__Phras__72910220");

            entity.HasOne(d => d.User).WithMany(p => p.PhraseReviews)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__PhraseRev__UserI__719CDDE7");
        });

        modelBuilder.Entity<PushSubscription>(entity =>
        {
            entity.HasIndex(e => e.UserId, "IX_Push_User");

            entity.HasIndex(e => e.EndpointHash, "UQ_Push_EndpointHash").IsUnique();

            entity.Property(e => e.Auth)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.Endpoint).HasMaxLength(2000);
            entity.Property(e => e.EndpointHash)
                .HasMaxLength(32)
                .IsFixedLength();
            entity.Property(e => e.P256dh)
                .HasMaxLength(200)
                .IsUnicode(false);

            entity.HasOne(d => d.User).WithMany(p => p.PushSubscriptions)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__PushSubsc__UserI__531856C7");
        });

        modelBuilder.Entity<RecentPhrase>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.PhraseId });

            entity.HasOne(d => d.Phrase).WithMany(p => p.RecentPhrases)
                .HasForeignKey(d => d.PhraseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__RecentPhr__Phras__32AB8735");

            entity.HasOne(d => d.User).WithMany(p => p.RecentPhrases)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__RecentPhr__UserI__31B762FC");
        });

        modelBuilder.Entity<SchemaVersion>(entity =>
        {
            entity.HasKey(e => e.Version);

            entity.Property(e => e.Version).ValueGeneratedNever();
            entity.Property(e => e.AppliedAt).HasDefaultValueSql("(sysutcdatetime())", "DF_SchemaVersions_Date");
            entity.Property(e => e.Description).HasMaxLength(300);
        });

        modelBuilder.Entity<StudyGroup>(entity =>
        {
            entity.HasIndex(e => e.TeacherId, "IX_StudyGroups_TeacherId");

            entity.HasIndex(e => e.JoinCode, "UQ_StudyGroups_Code").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.JoinCode)
                .HasMaxLength(32)
                .IsUnicode(false);
            entity.Property(e => e.Name).HasMaxLength(200);

            entity.HasOne(d => d.Teacher).WithMany(p => p.StudyGroups)
                .HasForeignKey(d => d.TeacherId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__StudyGrou__Teach__0E6E26BF");
        });

        modelBuilder.Entity<UserAchievement>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.AchievementCode });

            entity.Property(e => e.AchievementCode)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.EarnedAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.AchievementCodeNavigation).WithMany(p => p.UserAchievements)
                .HasForeignKey(d => d.AchievementCode)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__UserAchie__Achie__40F9A68C");

            entity.HasOne(d => d.User).WithMany(p => p.UserAchievements)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__UserAchie__UserI__40058253");
        });

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.UserId);

            entity.Property(e => e.UserId).ValueGeneratedNever();
            entity.Property(e => e.About).HasMaxLength(1000);
            entity.Property(e => e.AvatarPath).HasMaxLength(500);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.DailyMinutes).HasDefaultValue(15);
            entity.Property(e => e.Destination).HasMaxLength(200);
            entity.Property(e => e.EnglishLevel)
                .HasMaxLength(2)
                .IsUnicode(false);
            entity.Property(e => e.FirstName).HasMaxLength(40);
            entity.Property(e => e.Language)
                .HasMaxLength(5)
                .IsUnicode(false)
                .HasDefaultValue("ru");
            entity.Property(e => e.LastName).HasMaxLength(60);
            entity.Property(e => e.LearningGoal).HasMaxLength(300);
            entity.Property(e => e.QuietEnd)
                .HasPrecision(0)
                .HasDefaultValue(new TimeOnly(8, 0, 0));
            entity.Property(e => e.QuietStart)
                .HasPrecision(0)
                .HasDefaultValue(new TimeOnly(22, 0, 0));
            entity.Property(e => e.ReminderTime)
                .HasPrecision(0)
                .HasDefaultValue(new TimeOnly(19, 0, 0));
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.SpeechRate)
                .HasDefaultValue(1m)
                .HasColumnType("decimal(3, 2)");
            entity.Property(e => e.Theme)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("system");
            entity.Property(e => e.TimeZoneId)
                .HasMaxLength(100)
                .HasDefaultValue("Russian Standard Time");

            entity.HasOne(d => d.User).WithOne(p => p.UserProfile)
                .HasForeignKey<UserProfile>(d => d.UserId)
                .HasConstraintName("FK__UserProfi__UserI__6A30C649");
        });

        modelBuilder.Entity<VocabularyItem>(entity =>
        {
            entity.HasIndex(e => new { e.UserId, e.DueAt }, "IX_Vocabulary_UserDue");

            entity.HasIndex(e => new { e.UserId, e.English }, "UQ_Vocabulary_UserWord").IsUnique();

            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.DueAt).HasDefaultValueSql("(sysutcdatetime())");
            entity.Property(e => e.English).HasMaxLength(400);
            entity.Property(e => e.Transcription).HasMaxLength(500);
            entity.Property(e => e.Translation).HasMaxLength(500);

            entity.HasOne(d => d.SourcePhrase).WithMany(p => p.VocabularyItems)
                .HasForeignKey(d => d.SourcePhraseId)
                .HasConstraintName("FK__Vocabular__Sourc__37703C52");

            entity.HasOne(d => d.User).WithMany(p => p.VocabularyItems)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("FK__Vocabular__UserI__367C1819");
        });

        modelBuilder.Entity<VwLearningResult>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vwLearningResults");

            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.Lesson).HasMaxLength(200);
            entity.Property(e => e.Module).HasMaxLength(200);
            entity.Property(e => e.Score).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.StudentName).HasMaxLength(200);
        });

        modelBuilder.Entity<VwLesson>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vwLessons");

            entity.Property(e => e.EnglishLevel)
                .HasMaxLength(2)
                .IsUnicode(false);
            entity.Property(e => e.Module).HasMaxLength(200);
            entity.Property(e => e.Title).HasMaxLength(200);
        });

        modelBuilder.Entity<VwLessonStep>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vwLessonSteps");

            entity.Property(e => e.ExerciseType).HasMaxLength(4000);
            entity.Property(e => e.Prompt).HasMaxLength(4000);
            entity.Property(e => e.Title).HasMaxLength(200);
            entity.Property(e => e.Translation).HasMaxLength(4000);
        });

        modelBuilder.Entity<VwUser>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("vwUsers");

            entity.Property(e => e.Destination).HasMaxLength(200);
            entity.Property(e => e.DisplayName).HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.EnglishLevel)
                .HasMaxLength(2)
                .IsUnicode(false);
            entity.Property(e => e.FirstName).HasMaxLength(40);
            entity.Property(e => e.LastName).HasMaxLength(60);
            entity.Property(e => e.Role).HasMaxLength(256);
        });
        modelBuilder.HasSequence<int>("UserPublicId").StartsAt(5L);

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
