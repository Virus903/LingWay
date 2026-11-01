"use strict";

// Account-specific UI. Course content remains in its original learning language.
const tr = (ru, en) => (profile().language === "en" ? en : ru);
const iconPaths = {
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-1.5a7 7 0 0 1 14 0V21"/>',
  users:
    '<path d="M16 21v-1.5a6 6 0 0 0-6-6H6a4 4 0 0 0-4 4V19"/><circle cx="8" cy="7" r="4"/><path d="M16 4.2a4 4 0 0 1 0 7.6M22 19v-1.5a4 4 0 0 0-3-3.87"/>',
  lock: '<rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
  plane: '<path d="m3 11 7 2 3 8 3-18L3 11Z"/><path d="m10 13 6-10"/>',
  shield:
    '<path d="m12 2 8 4v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6l8-4Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>',
  route:
    '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2a2 2 0 0 0 2-2v-8a2 2 0 0 1 2-2h2"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22V4.5ZM20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22V4.5Z"/>',
  repeat:
    '<path d="M20 7h-9a7 7 0 0 0-7 7v1"/><path d="m17 4 3 3-3 3M4 17h9a7 7 0 0 0 7-7V9"/><path d="m7 20-3-3 3-3"/>',
  layers:
    '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  upload: '<path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 15v5h16v-5"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m5 7H2"/>',
  report:
    '<path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5M9 16l2-3 2 2 3-5"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  passport:
    '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 10h6M12 7c1 2 1 4 0 6M9 17h6"/>',
  volume:
    '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  download: '<path d="M12 3v13m0 0 5-5m-5 5-5-5"/><path d="M4 20h16"/>',
  device:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3m3 0-1 16H6L5 6M10 11v6m4-6v6"/>',
};
const accountIcon = (name) =>
  `<svg class="account-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" focusable="false" aria-hidden="true">${iconPaths[name] || iconPaths.home}</svg>`;
function accountShell(body) {
  const page = route().page;
  const nav = (r, icon, ru, en) => {
    const target = r.split("?")[0],
      tab = new URLSearchParams(r.split("?")[1] || "").get("tab");
    const active =
      (page === target &&
        (tab
          ? route().params.get("tab") === tab
          : target !== "reports" || !route().params.get("tab"))) ||
      (r === "profile" && page === "profile-edit") ||
      (r === "groups" && page === "group") ||
      (r === "modules" && page === "editor");
    return razorTemplate("Shared._AccountLayout.1", {
      value_0: active ? "active" : "",
      r_1: r,
      value_2: active ? 'aria-current="page"' : "",
      value_3: accountIcon(icon),
      value_4: tr(ru, en),
    });
  };
  const role = data.user?.role || "student";
  const adminPages = ["admin", "modules", "editor", "import"];
  const sharedStaffPages = ["groups", "group", "registry", "reports"];
  const adminMode =
    role === "admin" &&
    (adminPages.includes(page) || sharedStaffPages.includes(page));
  const teacherMode =
    role === "teacher" &&
    (page === "teacher" || sharedStaffPages.includes(page));
  const personalMenu = razorTemplate("Shared._AccountLayout.2", {
    value_0: tr("ОБУЧЕНИЕ", "LEARNING"),
    value_1: nav("dashboard", "home", "Мой день", "My day"),
    value_2: nav("map", "route", "Маршрут обучения", "Learning route"),
    value_3: nav("phrasebook", "book", "Разговорник", "Phrasebook"),
    value_4: nav("mistakes", "repeat", "Повторение", "Review"),
    value_5: tr("УПРАВЛЕНИЕ", "MANAGEMENT"),
    value_6: nav("profile", "user", "Профиль", "Profile"),
    value_7: nav(
      "account",
      "lock",
      "Аккаунт и безопасность",
      "Account & security",
    ),
    value_8: nav("settings", "settings", "Настройки", "Settings"),
    value_9:
      role === "teacher"
        ? nav("teacher", "users", "Панель преподавателя", "Teacher panel")
        : "",
    value_10:
      role === "admin"
        ? nav("admin", "shield", "Админ-панель", "Admin panel")
        : "",
  });
  const teacherMenu = razorTemplate("Shared._AccountLayout.3", {
    value_0: tr("КАБИНЕТ ПРЕПОДАВАТЕЛЯ", "TEACHER WORKSPACE"),
    value_1: nav("teacher", "home", "Обзор", "Overview"),
    value_2: nav("groups", "users", "Мои группы", "My groups"),
    value_3: nav("registry", "chart", "Результаты учеников", "Student results"),
    value_4: nav("reports", "report", "Отчёты", "Reports"),
    value_5: nav("profile", "user", "Личный кабинет", "Personal account"),
  });
  const adminMenu = razorTemplate("Shared._AccountLayout.4", {
    value_0: tr("АДМИНИСТРИРОВАНИЕ", "ADMINISTRATION"),
    value_1: nav("admin", "home", "Обзор системы", "System overview"),
    value_2: nav(
      "reports?tab=users",
      "users",
      "Пользователи и роли",
      "Users & roles",
    ),
    value_3: nav("groups", "users", "Все учебные группы", "All study groups"),
    value_4: tr("УЧЕБНЫЙ КОНТЕНТ", "LEARNING CONTENT"),
    value_5: nav("modules", "layers", "Модули и уроки", "Modules & lessons"),
    value_6: nav(
      "import",
      "upload",
      "Разговорник и импорт",
      "Phrasebook & import",
    ),
    value_7: tr("АНАЛИТИКА", "ANALYTICS"),
    value_8: nav("registry", "chart", "Все результаты", "All results"),
    value_9: nav("reports", "report", "Общие отчёты", "General reports"),
    value_10: nav(
      "reports?tab=audit",
      "history",
      "Журнал действий",
      "Activity log",
    ),
    value_11: nav("profile", "user", "Личный кабинет", "Personal account"),
  });
  const workspaceMode = adminMode || teacherMode;
  const menu = adminMode ? adminMenu : teacherMode ? teacherMenu : personalMenu;
  const start = adminMode ? "admin" : teacherMode ? "teacher" : "dashboard";
  const workspace = adminMode
    ? tr("Панель администратора", "Administrator workspace")
    : teacherMode
      ? tr("Панель преподавателя", "Teacher workspace")
      : tr("Личный кабинет", "Personal account");
  const roleLabel =
    role === "admin"
      ? tr("Администратор", "Administrator")
      : role === "teacher"
        ? tr("Преподаватель", "Teacher")
        : tr("Ученик", "Student");
  return razorTemplate("Shared._AccountLayout.6", {
    value_0: workspaceMode ? `role-${role}-workspace` : "personal-workspace",
    value_1: logo().replace('href="#home"', `href="#${start}"`),
    menu_2: menu,
    workspace_3: workspace,
    workspace_4: workspace,
    value_5: accountIcon(role === "admin" ? "shield" : "user"),
    data_user__name_6: esc(data.user?.name),
    rolelabel_7: roleLabel,
    value_8: tr("Выйти", "Sign out"),
    value_9: !navigator.onLine
      ? razorTemplate("Shared._AccountLayout.5", {
          value_0: tr(
            "Нет сети. Изменения аккаунта требуют подключения.",
            "Offline. Account changes require a connection.",
          ),
        })
      : "",
    body_10: body,
  });
}
function accountHeading(title, subtitle, actions = "") {
  return razorTemplate("Shared._AccountHeading.1", {
    value_0: tr("ЛИЧНЫЙ КАБИНЕТ", "PERSONAL ACCOUNT"),
    title_1: title,
    subtitle_2: subtitle,
    actions_3: actions,
  });
}
function accountRow(label, value) {
  return razorTemplate("Shared._AccountRow.1", {
    label_0: label,
    value_1: esc(value || tr("Не указано", "Not specified")),
  });
}
function accountCard(title, body, icon = "book") {
  return razorTemplate("Shared._AccountCard.1", {
    value_0: accountIcon(icon),
    title_1: title,
    body_2: body,
  });
}
function avatarMarkup(p, editable = false) {
  const picture = p.avatar
    ? razorTemplate("Shared._Avatar.1", {
        p_avatar_0: esc(p.avatar),
      })
    : accountIcon("user");
  return razorTemplate("Shared._Avatar.3", {
    picture_0: picture,
    value_1: editable
      ? razorTemplate("Shared._Avatar.2", {
          value_0: tr("Выбрать фото", "Choose photo"),
          value_1: tr("Удалить фото", "Remove photo"),
          value_2: tr(
            "PNG, JPEG или WebP, до 1 МБ.",
            "PNG, JPEG or WebP, up to 1 MB.",
          ),
        })
      : "",
  });
}
function previewProfileAvatar(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 1024 * 1024
  ) {
    input.value = "";
    return notice(
      tr(
        "Выберите PNG, JPEG или WebP до 1 МБ",
        "Choose a PNG, JPEG or WebP file up to 1 MB",
      ),
    );
  }
  const reader = new FileReader();
  reader.onload = () => {
    document.querySelector("#avatar-preview").innerHTML = razorTemplate(
      "Shared._PreviewProfileAvatar.1",
      {
        reader_result_0: reader.result,
      },
    );
    input.form.elements.remove_avatar.value = "0";
  };
  reader.readAsDataURL(file);
}
function removeProfileAvatar(button) {
  const form = button.form;
  form.elements.avatar_file.value = "";
  form.elements.remove_avatar.value = "1";
  document.querySelector("#avatar-preview").innerHTML = accountIcon("user");
}
function travelProfile() {
  const p = profile(),
    passed = new Set(
      ownAttempts()
        .filter((a) => a.score >= 80)
        .map((a) => a.lesson_id),
    ).size;
  return shell(
    razorTemplate("Account.Profile.8", {
      value_0: accountHeading(
        tr("Профиль", "Profile"),
        tr(
          "Ваши поездки, цели и успехи в английском.",
          "Your trips, goals and English progress.",
        ),
        button(
          tr("Редактировать профиль", "Edit profile"),
          "go('profile-edit')",
        ),
      ),
      value_1: accountIcon("user"),
      data_user_name_2: esc(data.user.name),
      data_user_email_3: esc(data.user.email),
      value_4: esc(p.level || tr("Уровень не указан", "Level not set")),
      value_5: admin()
        ? tr("Администратор", "Administrator")
        : staff()
          ? tr("Преподаватель", "Teacher")
          : tr("Путешественник", "Traveller"),
      value_6: [
        [passed, tr("Уроков пройдено", "Lessons passed")],
        [data.favorites.length, tr("Сохранённых фраз", "Saved phrases")],
        [p.minutes || 15, tr("Минут в день", "Minutes per day")],
      ]
        .map(([v, l]) =>
          razorTemplate("Account.Profile.1", {
            l_0: l,
            v_1: v,
          }),
        )
        .join(""),
      value_7: accountCard(
        tr("Моя следующая поездка", "My next trip"),
        accountRow(tr("Направление", "Destination"), p.destination) +
          accountRow(tr("Дата поездки", "Travel date"), p.trip_date) +
          accountRow(tr("Цель изучения", "Learning goal"), p.goal),
        "plane",
      ),
      value_8: accountCard(
        tr("Учебный план", "Learning plan"),
        accountRow(tr("Уровень английского", "English level"), p.level) +
          accountRow(
            tr("Ежедневная цель", "Daily goal"),
            `${p.minutes || 15} ${tr("минут", "minutes")}`,
          ) +
          razorTemplate("Account.Profile.2", {
            value_0: tr(
              "Уровень в профиле — самооценка. Диагностический тест доступен отдельно.",
              "Your profile level is self-assessed. A placement test is available separately.",
            ),
            value_1: button(
              tr("Продолжить обучение", "Continue learning"),
              "go('map')",
            ),
            value_2: button(
              tr("Пройти тест уровня", "Take placement test"),
              "go('level-test')",
              true,
            ),
          }),
        "target",
      ),
      value_9: accountCard(
        tr("Паспорт путешественника", "Travel passport"),
        razorTemplate("Account.Profile.4", {
          value_0: data.modules
            .map((m) =>
              razorTemplate("Account.Profile.3", {
                m_id_0: m.id,
                m_title_1: esc(m.title),
                value_2: moduleProgress(m.id),
                value_3: progress(moduleProgress(m.id)),
              }),
            )
            .join(""),
        }),
        "passport",
      ),
      value_10: accountCard(
        tr("О себе", "About me"),
        razorTemplate("Account.Profile.5", {
          value_0: esc(
            p.about ||
              tr(
                "Расскажите, куда мечтаете отправиться и в каких ситуациях хотите увереннее говорить по-английски.",
                "Tell us where you would like to travel and when you want to speak English with confidence.",
              ),
          ),
        }),
        "user",
      ),
      value_11: accountCard(
        tr("Мой словарь", "My vocabulary"),
        razorTemplate("Account.Profile.6", {
          value_0: tr(
            "Сохранённые фразы и повторение сложных выражений.",
            "Saved phrases and practice for difficult expressions.",
          ),
          value_1: button(
            tr("Открыть разговорник", "Open phrasebook"),
            "go('phrasebook')",
            true,
          ),
          value_2: button(
            tr("Повторить фразы", "Review phrases"),
            "go('mistakes')",
            true,
          ),
        }),
        "book",
      ),
      value_12: !staff()
        ? accountCard(
            tr("Учебная группа", "Study group"),
            razorTemplate("Account.Profile.7", {
              value_0:
                data.groups.map((g) => esc(g.name)).join(", ") ||
                tr(
                  "Вы пока не состоите в группе.",
                  "You have not joined a group yet.",
                ),
              value_1: input("code", tr("Код приглашения", "Invitation code")),
              value_2: tr("Вступить", "Join"),
            }),
            "users",
          )
        : "",
    }),
  );
}
function profileEditor() {
  const p = profile();
  return shell(
    razorTemplate("Account.EditProfile.3", {
      value_0: accountHeading(
        tr("Редактирование профиля", "Edit profile"),
        tr(
          "Только информация для вашего учебного маршрута.",
          "Information for your learning journey.",
        ),
      ),
      value_1: accountCard(
        tr("Основная информация", "Basic information"),
        input(
          "name",
          tr("Имя или псевдоним", "Name or nickname"),
          data.user.name,
        ) +
          razorTemplate("Account.EditProfile.1", {
            data_user_email_0: esc(data.user.email),
            value_1: tr(
              "Почта используется для входа.",
              "Email is used to sign in.",
            ),
          }),
        "user",
      ),
      value_2: accountCard(
        tr("Поездка и обучение", "Travel & learning"),
        input(
          "destination",
          tr("Страна или город", "Country or city"),
          p.destination || "",
          "text",
          false,
        ) +
          input(
            "trip_date",
            tr("Дата поездки", "Travel date"),
            p.trip_date || "",
            "date",
            false,
          ) +
          input(
            "goal",
            tr("Зачем мне английский", "Why I learn English"),
            p.goal || "",
            "text",
            false,
          ) +
          select(
            "level",
            tr("Мой уровень", "My level"),
            [
              ["", tr("Не определён", "Not set")],
              ["A1", "A1 — Beginner"],
              ["A2", "A2 — Elementary"],
              ["B1", "B1 — Intermediate"],
              ["B2", "B2 — Upper intermediate"],
              ["C1", "C1 — Advanced"],
              ["C2", "C2 — Proficient"],
            ],
            p.level || "",
          ) +
          select(
            "minutes",
            tr("Ежедневная цель", "Daily goal"),
            [5, 10, 15, 20, 30, 45, 60].map((n) => [
              n,
              `${n} ${tr("минут", "minutes")}`,
            ]),
            p.minutes || 15,
          ),
      ),
      value_3: accountCard(
        tr("О себе", "About me"),
        razorTemplate("Account.EditProfile.2", {
          value_0: tr("Мои планы и интересы", "My plans & interests"),
          value_1: esc(p.about || ""),
        }),
        "user",
      ),
      value_4: tr("Сохранить изменения", "Save changes"),
      value_5: button(tr("Отмена", "Cancel"), "go('profile')", true),
    }),
  );
}
async function saveTravelProfile(form) {
  const v = payload(form);
  await action(async () => {
    await api("profile", {
      name: v.name,
      profile: {
        destination: v.destination,
        trip_date: v.trip_date,
        goal: v.goal,
        level: v.level,
        minutes: Number(v.minutes),
        about: v.about,
      },
    });
    await refresh();
    go("profile");
    notice(tr("Профиль сохранён", "Profile saved"));
  });
}
function accountSecurity() {
  return shell(
    razorTemplate("Account.Security.6", {
      value_0: accountHeading(
        tr("Аккаунт и безопасность", "Account & security"),
        tr(
          "Вход, пароль и контроль доступа к вашим учебным данным.",
          "Sign-in, password and access to your learning data.",
        ),
      ),
      value_1: accountCard(
        tr("Данные аккаунта", "Account details"),
        accountRow(tr("Электронная почта", "Email"), data.user.email) +
          accountRow(
            tr("Подтверждение почты", "Email verification"),
            data.user.verified
              ? tr("Подтверждена", "Verified")
              : tr("Не подтверждена", "Not verified"),
          ) +
          accountRow(
            tr("Роль", "Role"),
            admin()
              ? tr("Администратор", "Administrator")
              : staff()
                ? tr("Преподаватель", "Teacher")
                : tr("Ученик", "Student"),
          ) +
          razorTemplate("Account.Security.1", {
            value_0: tr(
              "Один вход для ученика, преподавателя и администратора. Роль назначается на сервере.",
              "One sign-in for students, teachers and administrators. Roles are assigned on the server.",
            ),
            value_1: !data.user.verified
              ? button(
                  tr("Подтвердить почту", "Verify email"),
                  "go('verify')",
                  true,
                )
              : "",
          }),
        "user",
      ),
      value_2: accountCard(
        tr("Смена пароля", "Change password"),
        razorTemplate("Account.Security.2", {
          value_0: input(
            "old",
            tr("Текущий пароль", "Current password"),
            "",
            "password",
          ),
          value_1: input(
            "password",
            tr("Новый пароль", "New password"),
            "",
            "password",
          ),
          value_2: input(
            "confirm",
            tr("Повторите новый пароль", "Confirm new password"),
            "",
            "password",
          ),
          value_3: tr(
            "Минимум 8 символов. После смены остальные сеансы завершатся.",
            "At least 8 characters. Other sessions will be signed out.",
          ),
          value_4: tr("Изменить пароль", "Change password"),
        }),
        "lock",
      ),
      value_3: accountCard(
        tr("Сеансы", "Sessions"),
        razorTemplate("Account.Security.3", {
          value_0: tr(
            "Завершите все входы, включая текущий, если пользовались чужим устройством.",
            "End all sessions, including this one, after using a shared device.",
          ),
          value_1: button(
            tr("Выйти на всех устройствах", "Sign out everywhere"),
            "logoutEverywhere()",
            true,
          ),
        }),
        "shield",
      ),
      value_4: tr("Удаление аккаунта", "Delete account"),
      value_5: staff()
        ? razorTemplate("Account.Security.4", {
            value_0: tr(
              "Самостоятельное удаление аккаунта сотрудника отключено: к нему могут быть привязаны группы и материалы.",
              "Staff accounts cannot self-delete because groups and content may depend on them.",
            ),
          })
        : razorTemplate("Account.Security.5", {
            value_0: tr(
              "Это действие необратимо. Сначала скачайте копию данных в настройках.",
              "This cannot be undone. Download a copy of your data in Settings first.",
            ),
            value_1: input(
              "password",
              tr("Текущий пароль", "Current password"),
              "",
              "password",
            ),
            value_2: input(
              "confirmation",
              tr("Введите УДАЛИТЬ", "Type УДАЛИТЬ"),
            ),
            value_3: tr(
              "Удалить аккаунт и учебные результаты",
              "Delete account and learning results",
            ),
          }),
    }),
  );
}
async function saveAccountPassword(form) {
  const v = payload(form);
  if (v.password !== v.confirm)
    return notice(tr("Пароли не совпадают", "Passwords do not match"));
  await action(async () => {
    await api("password", v);
    form.reset();
    notice(
      tr(
        "Пароль изменён. Остальные сеансы завершены.",
        "Password changed. Other sessions signed out.",
      ),
    );
  });
}
function clearAccountCache(uid) {
  for (const k of ["tt-snapshot-", "tt-queue-", "tt-result-", "tt-training-", "lw-progress-"])
    localStorage.removeItem(k + uid);
  sessionStorage.removeItem("tt-training-" + uid);
  sessionStorage.removeItem("tt-result-" + uid);
  localStorage.removeItem("tt-last-user");
  training = null;
}
async function logoutEverywhere() {
  await action(async () => {
    const uid = data.user.id;
    await api("logout-all", {});
    await clearAccountCache(uid);
    await refresh();
    go("login");
    notice("Все сеансы завершены / All sessions signed out");
  });
}
async function confirmAccountDeletion(form) {
  if (payload(form).confirmation !== "УДАЛИТЬ")
    return notice(
      tr("Введите УДАЛИТЬ для подтверждения", "Type УДАЛИТЬ to confirm"),
    );
  await deleteAccount(form);
}
function accountSettings() {
  const p = profile();
  return shell(
    razorTemplate("Account.Settings.4", {
      value_0: accountHeading(
        tr("Настройки", "Settings"),
        tr(
          "Оформление и удобный ритм изучения английского.",
          "Appearance and a comfortable pace for learning English.",
        ),
      ),
      value_1: accountCard(
        tr("Отображение", "Appearance"),
        razorTemplate("Account.Settings.1", {
          value_0: select(
            "theme",
            tr("Тема", "Theme"),
            [
              ["dark", tr("Тёмная", "Dark")],
              ["light", tr("Светлая", "Light")],
              ["system", tr("Как в системе", "System")],
            ],
            p.theme || "dark",
          ),
          value_1: select(
            "language",
            tr("Язык личного кабинета", "Account language"),
            [
              ["ru", "Русский"],
              ["en", "English"],
            ],
            p.language || "ru",
          ),
          value_2: tr(
            "RU/EN для личного кабинета и меню. Учебные материалы и остальные разделы сохраняют исходный язык.",
            "RU/EN for account screens and navigation. Learning content and other sections keep their original language.",
          ),
        }),
        "settings",
      ),
      value_2: accountCard(
        tr("Озвучка английских фраз", "English phrase playback"),
        select(
          "speech_rate",
          tr("Скорость речи", "Speech rate"),
          [
            [0.65, tr("Медленно", "Slow")],
            [0.85, tr("Чуть медленнее", "Relaxed")],
            [1, tr("Обычная", "Normal")],
            [1.15, tr("Быстро", "Fast")],
          ],
          p.speech_rate || 1,
        ) +
          button(
            tr("Прослушать пример", "Play sample"),
            "previewAccountVoice()",
            true,
          ),
        "volume",
      ),
      value_3: accountCard(
        tr("Напоминания внутри сайта", "In-app reminders"),
        razorTemplate("Account.Settings.2", {
          value_0: tr(
            "Напоминать о повторении фраз",
            "Remind me to review phrases",
          ),
          value_1: tr(
            "Подсказка появится в личном кабинете, когда наступит срок повторения. Письма и push не отправляются.",
            "A reminder appears in your account when phrases are due. No emails or push notifications are sent.",
          ),
          value_2: p.notifications !== false ? "checked" : "",
        }),
        "bell",
      ),
      value_4: tr("Сохранить настройки", "Save settings"),
      value_5: accountCard(
        tr("Конфиденциальность", "Privacy"),
        razorTemplate("Account.Settings.3", {
          value_0: tr(
            "Скачайте профиль, результаты и список сохранённых фраз. Пароли и сеансы в выгрузку не входят.",
            "Download your profile, results and saved phrases. Passwords and sessions are excluded.",
          ),
          value_1: button(
            tr("Скачать мои данные (JSON)", "Download my data (JSON)"),
            "exportAccount()",
            true,
          ),
        }),
        "download",
      ),
    }),
  );
}
async function saveAccountSettings(form) {
  const v = payload(form);
  await mutate(
    "profile",
    {
      profile: {
        theme: v.theme,
        language: v.language,
        speech_rate: Number(v.speech_rate),
        notifications: form.elements.notifications.checked,
      },
    },
    v.language === "en" ? "Settings saved" : "Настройки сохранены",
  );
}
function previewAccountVoice() {
  if (!audioSupported)
    return notice(
      tr("Браузер не поддерживает озвучку", "Speech is unavailable"),
    );
  speechSynthesis.cancel();
  const sample = new SpeechSynthesisUtterance(
    "Hello! I would like to check in, please.",
  );
  sample.lang = "en-US";
  sample.rate = Number(document.querySelector('[name="speech_rate"]').value);
  speechSynthesis.speak(sample);
}
async function exportAccount() {
  await action(async () => {
    const content = await api("export-account");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(content, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lingway-my-data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
function applyPreferences() {
  const root = document.documentElement;
  if (!root) return;
  const p = profile();
  const dark =
    p.theme === "dark" ||
    !p.theme ||
    (p.theme === "system" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.lang = ["profile", "profile-edit", "account", "settings"].includes(
    route().page,
  )
    ? p.language || "ru"
    : "ru";
  if (
    data.user &&
    p.notifications !== false &&
    ["profile", "dashboard"].includes(route().page) &&
    data.reviews.some((r) => Number(r.due) <= Date.now() / 1000)
  ) {
    const page = document.querySelector(".account-topbar");
    if (page)
      page.insertAdjacentHTML(
        "afterend",
        razorTemplate("Shared._ApplyPreferences.1", {
          value_0: tr(
            "Пора повторить сохранённые фразы",
            "Your saved phrases are ready to review",
          ),
        }),
      );
  }
}
window
  .matchMedia?.("(prefers-color-scheme: dark)")
  .addEventListener("change", applyPreferences);
function notificationItems() {
  return (data.siteNotifications || []).map(n => ({
    id: n.id, icon: "bell", title: n.title, text: n.body,
    href: n.href, read: !!n.readAt,
  }));
}
function notificationCenter() {
  const items = notificationItems(),
    list = items.length
      ? items
          .map((n) =>
            razorTemplate("Shared._Notifications.1", {
              n_href_0: n.href,
              value_1: accountIcon(n.icon),
              n_title_2: esc(n.title),
              n_text_3: esc(n.text),
              id: esc(n.id),
              state: n.read ? "is-read" : "is-unread",
            }),
          )
          .join("")
      : razorTemplate("Shared._Notifications.2", {
          value_0: accountIcon("bell"),
          value_1: tr("Нет новых уведомлений", "No new notifications"),
          value_2: tr(
            "Здесь появятся важные напоминания.",
            "Important reminders will appear here.",
          ),
        });
  return razorTemplate("Shared._Notifications.5", {
    value_0: tr("Уведомления", "Notifications"),
    value_1: accountIcon("bell"),
    value_2: items.filter(n => !n.read).length
      ? razorTemplate("Shared._Notifications.3", {
          value_0: items.filter(n => !n.read).length > 9 ? "9+" : items.filter(n => !n.read).length,
        })
      : "",
    value_3: tr("Уведомления", "Notifications"),
    value_4: items.length
      ? razorTemplate("Shared._Notifications.4", {
          items_length_0: items.length,
        })
      : "",
    list_5: list,
  });
}
function installNotificationCenter() {
  const top = document.querySelector(".account-topbar"),
    identity = top?.querySelector(".role-identity");
  if (!top || !identity || top.querySelector(".notification-center")) return;
  identity.insertAdjacentHTML("beforebegin", notificationCenter());
  loadSiteNotifications().catch(() => {});
}
let inboxLoading = false;
async function loadSiteNotifications() {
  if (!data.user || inboxLoading || !navigator.onLine) return;
  const owner = data.user.id;
  inboxLoading = true;
  try {
    const items = await api("notifications");
    if (data.user?.id !== owner) return;
    data.siteNotifications = items;
    const current = document.querySelector(".notification-center");
    const open = current?.querySelector(".notification-panel")?.hidden === false;
    if (current) {
      current.outerHTML = notificationCenter();
      if (open) {
        document.querySelector(".notification-panel").hidden = false;
        document.querySelector(".notification-button").setAttribute("aria-expanded", "true");
      }
    }
  } finally { inboxLoading = false; }
}
async function readSiteNotification(id) {
  closeNotifications();
  await action(async () => {
    await api("notifications/read", { id });
    await loadSiteNotifications();
  });
}
setInterval(() => loadSiteNotifications().catch(() => {}), 30000);
window.addEventListener("online", () => loadSiteNotifications().catch(() => {}));
function installAccountAvatar() {
  const identity = document.querySelector(".account-topbar .role-identity"),
    avatar = profile().avatar,
    icon = identity?.querySelector(".account-icon");
  if (!identity || !avatar || !icon) return;
  icon.outerHTML = razorTemplate("Shared._InstallAccountAvatar.1", {
    avatar_0: esc(avatar),
    value_1: tr("Аватар профиля", "Profile avatar"),
  });
}
function toggleNotifications(event) {
  event.stopPropagation();
  const center = event.currentTarget.closest(".notification-center"),
    panel = center.querySelector(".notification-panel"),
    open = panel.hidden;
  document
    .querySelectorAll(".notification-panel")
    .forEach((p) => (p.hidden = true));
  panel.hidden = !open;
  event.currentTarget.setAttribute("aria-expanded", String(open));
  if (open) loadSiteNotifications().catch(() => {});
}
function closeNotifications() {
  document
    .querySelectorAll(".notification-panel")
    .forEach((p) => (p.hidden = true));
}
window.addEventListener("click", (event) => {
  if (!event.target.closest?.(".notification-center")) closeNotifications();
});
const baseApplyPreferences = applyPreferences;
applyPreferences = function () {
  baseApplyPreferences();
  document.querySelector(".review-reminder")?.remove();
  installNotificationCenter();
  installAccountAvatar();
};
const baseTravelProfile = travelProfile;
travelProfile = function () {
  const p = profile();
  return baseTravelProfile().replace(
    /<div class="profile-avatar">[\s\S]*?<\/div>\s*<div class="profile-identity">/,
    razorTemplate("Account.Profile.9", {
      value_0: avatarMarkup(p),
    }),
  );
};
profileEditor = function () {
  const p = profile(),
    parts = String(data.user.name || "")
      .trim()
      .split(/\s+/),
    first = p.first_name || parts.shift() || "",
    last = p.last_name || parts.join(" ");
  return shell(
    razorTemplate("Account.EditProfile.6", {
      value_0: accountHeading(
        tr("Редактирование профиля", "Edit profile"),
        tr(
          "Личные данные и информация для вашего учебного маршрута.",
          "Personal details and information for your learning journey.",
        ),
      ),
      value_1: accountCard(
        tr("Фото профиля", "Profile photo"),
        avatarMarkup(p, true),
        "user",
      ),
      value_2: accountCard(
        tr("Основная информация", "Basic information"),
        razorTemplate("Account.EditProfile.4", {
          value_0: input("first_name", tr("Имя", "First name"), first),
          value_1: input("last_name", tr("Фамилия", "Last name"), last),
          data_user_email_2: esc(data.user.email),
          value_3: tr(
            "Почта используется для входа.",
            "Email is used to sign in.",
          ),
        }),
        "user",
      ),
      value_3: accountCard(
        tr("Поездка и обучение", "Travel & learning"),
        input(
          "destination",
          tr("Страна или город", "Country or city"),
          p.destination || "",
          "text",
          false,
        ) +
          input(
            "trip_date",
            tr("Дата поездки", "Travel date"),
            p.trip_date || "",
            "date",
            false,
          ) +
          input(
            "goal",
            tr("Зачем мне английский", "Why I learn English"),
            p.goal || "",
            "text",
            false,
          ) +
          select(
            "level",
            tr("Мой уровень", "My level"),
            [
              ["", tr("Не определён", "Not set")],
              ["A1", "A1 — Beginner"],
              ["A2", "A2 — Elementary"],
              ["B1", "B1 — Intermediate"],
              ["B2", "B2 — Upper intermediate"],
              ["C1", "C1 — Advanced"],
              ["C2", "C2 — Proficient"],
            ],
            p.level || "",
          ) +
          select(
            "minutes",
            tr("Ежедневная цель", "Daily goal"),
            [5, 10, 15, 20, 30, 45, 60].map((n) => [
              n,
              `${n} ${tr("минут", "minutes")}`,
            ]),
            p.minutes || 15,
          ),
      ),
      value_4: accountCard(
        tr("О себе", "About me"),
        razorTemplate("Account.EditProfile.5", {
          value_0: tr("Мои планы и интересы", "My plans & interests"),
          value_1: esc(p.about || ""),
        }),
        "user",
      ),
      value_5: tr("Сохранить изменения", "Save changes"),
      value_6: button(tr("Отмена", "Cancel"), "go('profile')", true),
    }),
  );
};
function readAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) return resolve(null);
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    )
      return reject(
        new Error(
          tr(
            "Выберите PNG, JPEG или WebP до 1 МБ",
            "Choose a PNG, JPEG or WebP file up to 1 MB",
          ),
        ),
      );
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(
        new Error(tr("Не удалось прочитать файл", "Could not read the file")),
      );
    reader.readAsDataURL(file);
  });
}
saveTravelProfile = async function (form) {
  await action(async () => {
    const v = payload(form),
      file = form.elements.avatar_file.files?.[0],
      loaded = await readAvatar(file),
      avatar = v.remove_avatar === "1" ? "" : loaded;
    const profileData = {
      first_name: v.first_name,
      last_name: v.last_name,
      destination: v.destination,
      trip_date: v.trip_date,
      goal: v.goal,
      level: v.level,
      minutes: Number(v.minutes),
      about: v.about,
    };
    if (avatar !== null) profileData.avatar = avatar;
    await api("profile", {
      name: `${v.first_name} ${v.last_name}`.trim(),
      profile: profileData,
    });
    await refresh();
    go("profile");
    notice(tr("Профиль сохранён", "Profile saved"));
  });
};
Object.assign(views, {
  "profile-edit": profileEditor,
  account: accountSecurity,
  settings: accountSettings,
});
screenNames.push(
  ["profile-edit", "Редактирование профиля"],
  ["account", "Аккаунт и безопасность"],
  ["settings", "Настройки"],
);
// Boot runs after the learning extension registers its screens.
