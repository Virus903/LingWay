"use strict";

const screenNames = [
  ["home", "Главная"],
  ["course", "Курс"],
  ["login", "Вход"],
  ["register", "Регистрация"],
  ["verify", "Подтверждение почты"],
  ["reset", "Восстановление пароля"],
  ["privacy", "Политика конфиденциальности"],
  ["terms", "Соглашение"],
  ["welcome", "Добро пожаловать"],
  ["goal", "Цель"],
  ["trip-date", "План поездки"],
  ["level-test", "Тест уровня"],
  ["test-result", "Результат теста"],
  ["dashboard", "Мой день"],
  ["map", "Маршрут"],
  ["module", "Модуль"],
  ["lesson", "Урок"],
  ["exercise", "Упражнения"],
  ["dialogue", "Диалог"],
  ["lesson-result", "Результат урока"],
  ["mistakes", "Повторение"],
  ["phrasebook", "Разговорник"],
  ["phrase", "Фраза"],
  ["profile", "Профиль"],
  ["admin", "Обзор"],
  ["groups", "Группы"],
  ["group", "Группа"],
  ["registry", "Прогресс"],
  ["modules", "Контент"],
  ["editor", "Редактор урока"],
  ["import", "Фразы и импорт"],
  ["reports", "Отчёты"],
];
let data = {
  user: null,
  modules: [],
  lessons: [],
  phrases: [],
  attempts: [],
  favorites: [],
  reviews: [],
  groups: [],
  members: [],
  assignments: [],
  users: [],
  audit: [],
};
let ui = {
  tab: "",
  search: "",
  category: "",
  favoriteOnly: false,
  filterGroup: "",
  filterModule: "",
  filterStatus: "",
  showTranslation: false,
  importData: null,
  editor: null,
  notice: "",
  busy: false,
};
let training = null;
let placement = {
  index: 0,
  answers: [],
  done: false,
};
let audioSupported = "speechSynthesis" in window;
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const staff = () => ["admin", "teacher"].includes(data.user?.role);
const admin = () => data.user?.role === "admin";
const profile = () => {
  try {
    return JSON.parse(data.user?.profile || "{}");
  } catch {
    return {};
  }
};
const route = () => {
  let [page, q = ""] = location.hash.slice(1).split("?");
  return {
    page: page || "home",
    params: new URLSearchParams(q),
  };
};
const idParam = () => Number(route().params.get("id"));
function go(page) {
  ui.tab = "";
  ui.search = "";
  ui.category = "";
  ui.showTranslation = false;
  location.hash = page;
  render();
  scrollTo(0, 0);
}
function notice(message) {
  ui.notice = message;
  const old = $("#notice");
  if (old) old.remove();
  let el = document.createElement("div");
  el.id = "notice";
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 5000);
}
async function api(path, body) {
  let res = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": data.csrf || "",
          },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok) {
    const e = new Error(result.error || "Ошибка запроса");
    e.status = res.status;
    throw e;
  }
  return result;
}
async function refresh() {
  data = await api("bootstrap");
  if (data.user) {
    localStorage.setItem("tt-last-user", String(data.user.id));
    localStorage.setItem(
      "tt-snapshot-" + data.user.id,
      JSON.stringify({
        ...data,
        csrf: "",
        users: [],
        audit: [],
      }),
    );
  }
}
async function action(fn) {
  if (ui.busy) return;
  ui.busy = true;
  try {
    await fn();
  } catch (e) {
    notice(e.message);
  } finally {
    ui.busy = false;
  }
}
async function mutate(path, body, message = "Сохранено") {
  return action(async () => {
    await api(path, body);
    await refresh();
    render();
    notice(message);
  });
}
function payload(form) {
  return Object.fromEntries(new FormData(form));
}
function button(label, handler, secondary = false) {
  return razorTemplate("Shared._Button.1", {
    value_0: secondary ? "secondary" : "",
    handler_1: handler,
    label_2: label,
  });
}
function input(name, label, value = "", type = "text", required = true) {
  return razorTemplate("Shared._Input.1", {
    name_0: name,
    label_1: label,
    name_2: name,
    name_3: name,
    type_4: type,
    value_5: esc(value),
    value_6: required ? "required" : "",
    value_7:
      type === "password" ? 'minlength="8" autocomplete="new-password"' : "",
  });
}
function select(name, label, options, value = "") {
  return razorTemplate("Shared._Select.2", {
    name_0: name,
    label_1: label,
    name_2: name,
    name_3: name,
    value_4: options
      .map(([v, t]) =>
        razorTemplate("Shared._Select.1", {
          v_0: esc(v),
          value_1: String(v) === String(value) ? "selected" : "",
          t_2: esc(t),
        }),
      )
      .join(""),
  });
}
function logo() {
  return razorTemplate("Shared._Logo.1", {});
}
const roleHome = () => (data.user ? "profile" : "login");
function publicShell(body) {
  return razorTemplate("Shared._PublicLayout.3", {
    value_0: logo(),
    value_1: razorTemplate("Shared._PublicLayout.2", {}),
    body_2: body,
  });
}
const userNav = [
  ["dashboard", "⌂", "Мой день"],
  ["map", "⌁", "Маршрут"],
  ["phrasebook", "◈", "Разговорник"],
  ["mistakes", "↻", "Повторение"],
  ["profile", "◎", "Профиль"],
];
const staffNav = [
  ["admin", "⌂", "Обзор"],
  ["groups", "◉", "Группы"],
  ["registry", "▦", "Прогресс"],
  ["modules", "▤", "Контент"],
  ["reports", "◫", "Отчёты"],
];
function shell(body) {
  return accountShell(body);
}
function heading(title, sub = "", actions = "") {
  return razorTemplate("Shared._Heading.1", {
    title_0: esc(title),
    sub_1: esc(sub),
    actions_2: actions,
  });
}
function stats(items) {
  return razorTemplate("Shared._Stats.2", {
    value_0: items
      .map(([n, t]) =>
        razorTemplate("Shared._Stats.1", {
          n_0: esc(n),
          t_1: esc(t),
        }),
      )
      .join(""),
  });
}
function progress(n) {
  return razorTemplate("Shared._Progress.1", {
    n_0: n,
    n_1: n,
  });
}
function empty(t) {
  return razorTemplate("Shared._Empty.1", {
    t_0: esc(t),
  });
}
function tabs(items) {
  const current = ui.tab || items[0][0];
  return razorTemplate("Shared._Tabs.2", {
    value_0: items
      .map(([k, t]) =>
        razorTemplate("Shared._Tabs.1", {
          value_0: current === k ? "active" : "",
          k_1: k,
          t_2: t,
        }),
      )
      .join(""),
  });
}
function table(headers, rows) {
  return rows.length
    ? razorTemplate("Shared._Table.4", {
        value_0: headers
          .map((h) =>
            razorTemplate("Shared._Table.1", {
              h_0: h,
            }),
          )
          .join(""),
        value_1: rows
          .map((r) =>
            razorTemplate("Shared._Table.3", {
              value_0: r
                .map((c) =>
                  razorTemplate("Shared._Table.2", {
                    c_0: c,
                  }),
                )
                .join(""),
            }),
          )
          .join(""),
      })
    : empty("Пока нет данных");
}
function ownAttempts() {
  return data.attempts.filter((a) => a.user_id === data.user?.id);
}
function moduleProgress(mid, uid = data.user?.id) {
  let lessons = data.lessons.filter((l) => l.module_id === mid && l.published);
  let completed = lessons.filter((l) =>
    data.attempts.some(
      (a) => a.user_id === uid && a.lesson_id === l.id && a.score >= 80,
    ),
  ).length;
  return lessons.length ? Math.round((100 * completed) / lessons.length) : 0;
}
function cardModules() {
  return data.modules
    .map((m) =>
      razorTemplate("Shared._CardModules.1", {
        value_0: data.lessons.filter((l) => l.module_id === m.id && l.published)
          .length,
        m_title_1: esc(m.title),
        m_description_2: esc(m.description),
        value_3: button("Открыть", `go('module?id=${m.id}')`),
      }),
    )
    .join("");
}
function home() {
  return publicShell(
    razorTemplate("Public.Home.2", {
      value_0: button(
        "Начать путешествие",
        `go('${data.user ? "dashboard" : "register"}')`,
      ),
      value_1: button("Посмотреть курс", "go('course')", true),
      value_2: cardModules(),
      value_3: [
        ["01", "Узнайте", "Выучите слова и полезные выражения."],
        ["02", "Попробуйте", "Ответьте на вопросы и реплики персонажа."],
        ["03", "Повторите", "Вернитесь к трудным фразам в личном словаре."],
      ]
        .map((x) =>
          razorTemplate("Public.Home.1", {
            value_0: x[0],
            value_1: x[1],
            value_2: x[2],
          }),
        )
        .join(""),
    }),
  );
}
function course() {
  return publicShell(
    razorTemplate("Public.Course.1", {
      value_0: heading(
        "Курс под вашу поездку",
        "Три модуля: аэропорт, отель и кафе. Уроки подходят для тренировки базовых фраз A1–A2.",
      ),
      value_1: cardModules(),
      value_2: button(
        "Перейти к обучению",
        `go('${data.user ? "dashboard" : "register"}')`,
      ),
    }),
  );
}
function login() {
  return publicShell(
    razorTemplate("Account.Login.1", {
      value_0: input("email", "Электронная почта", "", "email"),
      value_1: input("password", "Пароль", "", "password"),
    }),
  );
}
async function loginSubmit(form) {
  let values = payload(form);
  await action(async () => {
    await api("login", values);
    await refresh();
    go(
      staff()
        ? "profile"
        : !data.user.verified
          ? "verify"
          : profile().onboarded
            ? "dashboard"
            : "goal",
    );
    await syncQueue();
  });
}
async function logout() {
  await action(async () => {
    const uid = data.user?.id;
    await api("logout", {});
    localStorage.removeItem("tt-snapshot-" + uid);
    localStorage.removeItem("tt-last-user");
    training = null;
    await refresh();
    go("login");
  });
}
function register() {
  return publicShell(
    razorTemplate("Account.Register.1", {
      value_0: input("first_name", "Имя"),
      value_1: input("last_name", "Фамилия"),
      value_2: input("email", "Электронная почта", "", "email"),
      value_3: input("password", "Пароль", "", "password"),
      value_4: input("confirm", "Повторите пароль", "", "password"),
      value_5: input(
        "group_code",
        "Код учебной группы (необязательно)",
        "",
        "text",
        false,
      ),
    }),
  );
}
async function registerSubmit(form) {
  let v = payload(form);
  if (v.password !== v.confirm) return notice("Пароли не совпадают");
  v.name = `${v.first_name} ${v.last_name}`.trim();
  await action(async () => {
    await api("register", v);
    await refresh();
    go("verify");
  });
}
function verify() {
  return publicShell(
    razorTemplate("Account.Verify.1", {
      data_user__email_0: esc(data.user?.email),
    }),
  );
}
async function verifySubmit(form) {
  await action(async () => {
    await api("verify", payload(form));
    await refresh();
    go("goal");
  });
}
async function sendCode(purpose) {
  await action(async () => {
    let email = data.user?.email || $("#f-email").value;
    await api("code", {
      email,
      purpose,
    });
    notice("Код записан в data/mailbox.txt, если аккаунт существует");
  });
}
function reset() {
  return publicShell(
    razorTemplate("Account.Reset.1", {
      value_0: input("email", "Электронная почта", "", "email"),
      value_1: button("Получить код", "sendCode('reset')", true),
      value_2: input("code", "Код из письма"),
      value_3: input("password", "Новый пароль", "", "password"),
    }),
  );
}
async function resetSubmit(form) {
  await action(async () => {
    await api("reset", payload(form));
    await refresh();
    go("login");
    notice("Пароль изменён. Войдите снова");
  });
}
function privacyDocument() {
  return razorTemplate("Public.Privacy.1", {
    value_0: heading(
      "Политика конфиденциальности",
      "Дата последнего обновления: 31 октября 2026 года",
    ),
  });
}
function termsDocument() {
  return razorTemplate("Public.Terms.1", {
    value_0: heading(
      "Условия использования",
      "Дата последнего обновления: 31 октября 2026 года",
    ),
  });
}
function legal(page) {
  return publicShell(page === "privacy" ? privacyDocument() : termsDocument());
}
function welcome() {
  setTimeout(() => go("goal"), 0);
  return goal();
}
function goal() {
  return publicShell(
    razorTemplate("Onboarding.Goal.2", {
      value_0: heading("Зачем вы учите английский?", "Шаг 1 из 3"),
      value_1: [
        "Подготовиться к поездке",
        "Общаться в аэропорту",
        "Улучшить разговорный английский",
        "Пройти учебный курс",
      ]
        .map((v, i) =>
          razorTemplate("Onboarding.Goal.1", {
            v_0: v,
            value_1: i === 0 ? "checked" : "",
            v_2: v,
          }),
        )
        .join(""),
    }),
  );
}
function tripDate() {
  return publicShell(
    razorTemplate("Onboarding.TripDate.1", {
      value_0: heading("Когда отправляемся?", "Шаг 2 из 3"),
      value_1: input(
        "trip_date",
        "Дата поездки",
        profile().trip_date || "",
        "date",
        false,
      ),
      value_2: select(
        "minutes",
        "Время в день",
        [
          [10, "10 минут"],
          [15, "15 минут"],
          [20, "20 минут"],
        ],
        profile().minutes || 15,
      ),
    }),
  );
}
async function saveOnboarding(form, next) {
  await action(async () => {
    const values = payload(form);
    if ("minutes" in values) values.minutes = Number(values.minutes);
    await api("profile", {
      profile: values,
    });
    await refresh();
    go(next);
  });
}
const placementQuestions = [
  ["Что означает passport?", ["Билет", "Паспорт", "Багаж"], 1],
  ["Как попросить счёт?", ["The bill, please.", "I am bill.", "Go away."], 0],
  [
    "Ответьте на How are you?",
    ["I am fine, thank you.", "Here is my passport.", "At five."],
    0,
  ],
  [
    "Выберите правильную фразу",
    ["I has a reservation.", "I have a reservation.", "I reservation."],
    1,
  ],
  [
    "Что означает aisle seat?",
    ["Место у окна", "Место у прохода", "Место у выхода"],
    1,
  ],
];
function levelTest() {
  const q = placementQuestions[placement.index];
  if (!q) return testResult();
  return publicShell(
    razorTemplate("Onboarding.LevelTest.2", {
      value_0: heading(
        "Короткий тест",
        `Вопрос ${placement.index + 1} из ${placementQuestions.length}`,
      ),
      value_1: progress((100 * placement.index) / placementQuestions.length),
      value_2: q[0],
      value_3: q[1]
        .map((v, i) =>
          razorTemplate("Onboarding.LevelTest.1", {
            i_0: i,
            v_1: esc(v),
          }),
        )
        .join(""),
    }),
  );
}
async function placementAnswer(form) {
  placement.answers.push(Number(payload(form).answer));
  placement.index++;
  if (placement.index === placementQuestions.length) {
    let correct = placementQuestions.filter(
      (q, i) => q[2] === placement.answers[i],
    ).length;
    await action(async () => {
      await api("profile", {
        profile: {
          level: correct >= 4 ? "A2" : "A1",
          onboarded: true,
        },
      });
      await refresh();
      placement.done = true;
      go("map");
    });
  } else render();
}
function testResult() {
  setTimeout(() => go("map"), 0);
  return mapScreen();
}
function dashboard() {
  let attempts = ownAttempts();
  let completed = new Set(
    attempts.filter((a) => a.score >= 80).map((a) => a.lesson_id),
  ).size;
  let next = data.lessons.find(
    (l) =>
      l.published &&
      !attempts.some((a) => a.lesson_id === l.id && a.score >= 80),
  );
  let days = profile().trip_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(profile().trip_date + "T23:59:59") - Date.now()) / 86400000,
        ),
      )
    : null;
  return shell(
    razorTemplate("Learning.Dashboard.1", {
      value_0: heading(
        "Здравствуйте, " + data.user.name,
        days === null
          ? "Выберите урок и начните тренировку."
          : `До поездки: ${days} дней`,
      ),
      value_1: stats([
        [completed, "уроков пройдено"],
        [attempts.length, "попыток"],
        [data.favorites.length, "фраз в словаре"],
        [
          attempts.length
            ? Math.round(
                attempts.reduce((s, a) => s + a.score, 0) / attempts.length,
              ) + "%"
            : "—",
          "средняя точность",
        ],
      ]),
      value_2: esc(next?.title || "Повторите изученное"),
      value_3: button(
        "Продолжить",
        `go('${next ? "lesson?id=" + next.id : "map"}')`,
      ),
      value_4: button("Загрузить пакет", "downloadOffline()", true),
      value_5: localStorage.getItem("tt-offline")
        ? "Пакет сохранён на этом устройстве"
        : "Пакет пока не загружен",
      value_6: table(
        ["Модуль", "Срок", "Прогресс"],
        data.assignments.map((a) => [
          esc(data.modules.find((m) => m.id === a.module_id)?.title),
          esc(a.due || "Без срока"),
          moduleProgress(a.module_id) + "%",
        ]),
      ),
    }),
  );
}
async function downloadOffline() {
  await action(async () => {
    if (!("serviceWorker" in navigator))
      throw new Error("Этот браузер не поддерживает автономный режим");
    const reg = await navigator.serviceWorker.ready;
    reg.active.postMessage({
      type: "CACHE",
    });
    localStorage.setItem("tt-offline", new Date().toISOString());
    await refresh();
    render();
    notice("Учебный пакет сохранён. Проверьте режим без сети в этом браузере");
  });
}
function mapScreen() {
  return shell(
    razorTemplate("Learning.Map.2", {
      value_0: heading(
        "Карта путешествия",
        "Три доступных модуля. Прогресс рассчитывается по результатам уроков.",
      ),
      value_1: data.modules
        .map((m, i) =>
          razorTemplate("Learning.Map.1", {
            value_0: i + 1,
            m_title_1: esc(m.title),
            m_description_2: esc(m.description),
            value_3: progress(moduleProgress(m.id)),
            value_4: button("Открыть", `go('module?id=${m.id}')`),
          }),
        )
        .join(""),
    }),
  );
}
function moduleScreen() {
  let m = data.modules.find((m) => m.id === idParam()) || data.modules[0];
  if (!m) return shell(empty("Нет доступных модулей"));
  let lessons = data.lessons.filter((l) => l.module_id === m.id && l.published);
  return shell(
    razorTemplate("Learning.Module.2", {
      value_0: heading(m.title, m.description),
      value_1: progress(moduleProgress(m.id)),
      value_2:
        lessons
          .map((l) => {
            let a = ownAttempts().filter((a) => a.lesson_id === l.id);
            let best = a.length ? Math.max(...a.map((x) => x.score)) : 0;
            return razorTemplate("Learning.Module.1", {
              value_0: best >= 80 ? "✓" : "▶",
              l_title_1: esc(l.title),
              l_steps_length_2: l.steps.length,
              l_level_3: l.level,
              best_4: best,
              value_5: button("Открыть", `go('lesson?id=${l.id}')`, true),
            });
          })
          .join("") || empty("Уроки ещё не опубликованы"),
    }),
  );
}
function currentLesson() {
  return (
    data.lessons.find((l) => l.id === (training?.lesson_id || idParam())) ||
    data.lessons.find((l) => l.published)
  );
}
function lessonScreen() {
  let l =
    data.lessons.find((l) => l.id === idParam()) ||
    data.lessons.find((l) => l.published);
  if (!l) return shell(empty("Урок не найден"));
  return shell(
    razorTemplate("Learning.Lesson.2", {
      value_0: heading(l.title, l.description),
      l_level_1: esc(l.level),
      l_version_2: l.version,
      l_steps_length_3: l.steps.length,
      value_4: button("Начать урок", `startLesson(${l.id})`),
      value_5: l.steps
        .map((s, i) =>
          razorTemplate("Learning.Lesson.1", {
            value_0: i + 1,
            value_1: esc(
              {
                choice: "Выбор ответа",
                listening: "Аудирование",
                text: "Письменный ответ",
                dialogue: "Диалог",
              }[s.type],
            ),
          }),
        )
        .join(""),
    }),
  );
}
function startLesson(id) {
  const l = data.lessons.find((l) => l.id === id);
  if (!l || !l.published) return notice("Урок не опубликован");
  training = {
    id: crypto.randomUUID(),
    lesson_id: id,
    version: l.version,
    index: 0,
    answers: [],
    hint: false,
    feedback: null,
  };
  persistTraining();
  go(l.steps[0].type === "dialogue" ? "dialogue" : "exercise");
}
function persistTraining() {
  if (training && data.user)
    sessionStorage.setItem(
      "tt-training-" + data.user.id,
      JSON.stringify(training),
    );
}
function restoreDraft() {
  if (
    !training ||
    !["exercise", "dialogue"].includes(route().page) ||
    training.feedback
  )
    return;
  const field = $("#f-value");
  if (field) {
    field.value = training.draft || "";
    field.addEventListener("input", () => {
      training.draft = field.value;
      persistTraining();
    });
  }
  document
    .querySelectorAll?.('input[name="value"][type="radio"]')
    .forEach((r) => {
      r.checked = r.value === training.draft;
      r.addEventListener("change", () => {
        training.draft = r.value;
        persistTraining();
      });
    });
}
function normalize(v) {
  return String(v)
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .replace(/\s+/g, " ");
}
function exerciseScreen() {
  if (!training && data.user) {
    try {
      training = JSON.parse(
        sessionStorage.getItem("tt-training-" + data.user.id),
      );
    } catch {}
  }
  if (!training)
    return shell(
      `${heading("Сначала выберите урок")}${button("Открыть маршрут", "go('map')")}`,
    );
  const l = currentLesson(),
    s = l?.steps[training.index];
  if (!s) return lessonResult();
  const dialogue = s.type === "dialogue";
  const choices = ["choice", "listening"].includes(s.type);
  return shell(
    razorTemplate("Learning.Exercise.5", {
      value_0: heading(
        dialogue ? "Диалог с персонажем" : l.title,
        `Задание ${training.index + 1} из ${l.steps.length}`,
      ),
      value_1: progress((training.index / l.steps.length) * 100),
      value_2: dialogue
        ? "Emma · собеседник"
        : s.type === "listening"
          ? "Аудирование"
          : "Практика",
      s_prompt_3: esc(s.prompt),
      value_4:
        s.type === "listening"
          ? button("▶ Прослушать", `speakStep(false)`)
          : dialogue
            ? button("▶ Озвучить реплику", "speakStep(false)", true)
            : "",
      value_5: training.feedback
        ? razorTemplate("Learning.Exercise.1", {
            value_0: training.feedback.correct ? "correct" : "incorrect",
            value_1: training.feedback.correct
              ? "Верно!"
              : "Попробуйте запомнить",
            training_feedback_expected_2: esc(training.feedback.expected),
          })
        : choices
          ? s.options
              .map((v, i) =>
                razorTemplate("Learning.Exercise.2", {
                  i_0: i,
                  v_1: esc(v),
                }),
              )
              .join("")
          : `${input("value", "Ваш ответ на английском")} ${dialogue ? button("🎙 Ответить голосом", "recognize()", true) : ""}`,
      value_6: !training.feedback
        ? razorTemplate("Learning.Exercise.3", {
            value_0: button("Подсказка", "showHint()", true),
          })
        : button(
            training.index === l.steps.length - 1
              ? "Завершить урок"
              : "Следующее задание",
            "nextStep()",
          ),
      value_7: training.hint
        ? razorTemplate("Learning.Exercise.4", {
            value_0: esc(s.hint || s.accepted?.[0] || s.options[s.answer]),
          })
        : "",
    }),
  );
}
function showHint() {
  training.hint = true;
  persistTraining();
  render();
}
function answerStep(form) {
  const l = currentLesson(),
    s = l.steps[training.index],
    v = payload(form).value;
  let correct = ["choice", "listening"].includes(s.type)
    ? Number(v) === s.answer
    : s.accepted.some((x) => normalize(v) === normalize(x));
  training.answers.push({
    value: v,
    hint: training.hint,
  });
  training.feedback = {
    correct,
    expected: s.options ? s.options[s.answer] : s.accepted[0],
  };
  persistTraining();
  render();
}
async function nextStep() {
  if (training.index === currentLesson().steps.length - 1) {
    await action(async () => {
      const attempt = {
        id: training.id,
        lesson_id: training.lesson_id,
        version: training.version,
        answers: training.answers,
      };
      try {
        const result = await api("attempt", attempt);
        sessionStorage.setItem(
          "tt-result-" + data.user.id,
          JSON.stringify(result),
        );
        await refresh();
      } catch (e) {
        if (e.status) throw e;
        let q = JSON.parse(
          localStorage.getItem("tt-queue-" + data.user.id) || "[]",
        );
        if (!q.some((x) => x.id === attempt.id)) q.push(attempt);
        localStorage.setItem("tt-queue-" + data.user.id, JSON.stringify(q));
        sessionStorage.setItem(
          "tt-result-" + data.user.id,
          JSON.stringify({
            pending: true,
          }),
        );
        notice("Результат сохранён в очередь отправки");
      }
      sessionStorage.removeItem("tt-training-" + data.user.id);
      training = null;
      go("lesson-result");
    });
  } else {
    training.index++;
    training.draft = null;
    training.hint = false;
    training.feedback = null;
    persistTraining();
    go(
      currentLesson().steps[training.index].type === "dialogue"
        ? "dialogue"
        : "exercise",
    );
  }
}
async function syncQueue() {
  if (!data.user || !navigator.onLine) return;
  const key = "tt-queue-" + data.user.id;
  let queue = JSON.parse(localStorage.getItem(key) || "[]"),
    left = [];
  for (const a of queue) {
    try {
      await api("attempt", a);
    } catch (e) {
      left.push(a);
      if (e.status === 409)
        notice(
          "Один урок обновлён. Старая попытка сохранена в очереди; требуется повторное прохождение",
        );
    }
  }
  localStorage.setItem(key, JSON.stringify(left));
  if (queue.length > left.length) {
    await refresh();
    render();
    notice("Результаты синхронизированы");
  }
}
function lessonResult() {
  let result;
  try {
    result = JSON.parse(sessionStorage.getItem("tt-result-" + data.user.id));
  } catch {}
  if (!result) result = ownAttempts().at(-1);
  if (!result) return shell(empty("Сначала пройдите урок"));
  if (result.pending)
    return shell(
      `${heading("Урок завершён", "Результат ожидает отправки на сервер.")} ${button("Повторить синхронизацию", "syncQueue()")}`,
    );
  let answers = JSON.parse(result.answers || "[]");
  return shell(
    razorTemplate("Learning.LessonResult.1", {
      value_0: heading(
        "Урок завершён",
        result.score >= 80
          ? "Урок пройден!"
          : "Для прохождения нужно не менее 80%. Повторите трудные задания.",
      ),
      value_1: "★".repeat(result.stars),
      value_2: "☆".repeat(3 - result.stars),
      result_score_3: result.score,
      value_4: table(
        ["Задание", "Правильный ответ", "Результат"],
        answers.map((a) => [
          esc(a.prompt),
          esc(a.expected),
          a.correct ? "✓ Верно" : "Нужно повторить",
        ]),
      ),
      value_5: button("Повторить", `startLesson(${result.lesson_id})`, true),
      value_6: button("Продолжить маршрут", "go('map')"),
    }),
  );
}
function speak(value, slow = false) {
  if (!audioSupported)
    return notice("Озвучка не поддерживается этим браузером");
  speechSynthesis.cancel();
  let utter = new SpeechSynthesisUtterance(value);
  utter.lang = "en-US";
  utter.rate = slow ? 0.65 : Number(profile().speech_rate || 1);
  let voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) utter.voice = voice;
  utter.onerror = () =>
    notice("Не удалось воспроизвести. Проверьте системные голоса и сеть");
  speechSynthesis.speak(utter);
}
function speakStep(slow) {
  let s = currentLesson().steps[training.index];
  speak(s.audio || s.prompt, slow);
}
function recognize() {
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition)
    return notice(
      "Распознавание недоступно в этом браузере. Введите ответ текстом.",
    );
  if (
    !confirm(
      "Браузер может отправлять голос своему сервису распознавания. Разрешить голосовой ввод?",
    )
  )
    return;
  const rec = new Recognition();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.onresult = (e) => {
    const field = $("#f-value");
    if (field) field.value = e.results[0][0].transcript;
    notice("Речь распознана. Проверьте текст и нажмите «Проверить»");
  };
  rec.onerror = (e) =>
    notice("Распознавание: " + e.error + ". Можно ответить текстом.");
  rec.onend = () => {
    if ($("#speech-status"))
      $("#speech-status").textContent = "Запись завершена";
  };
  try {
    rec.start();
    $("#speech-status").textContent = "Слушаю…";
  } catch (e) {
    notice(e.message);
  }
}
function phrasebook() {
  let phrases = data.phrases.filter(
    (p) =>
      (!ui.category || p.category === ui.category) &&
      (!ui.favoriteOnly || data.favorites.includes(p.id)) &&
      `${p.en} ${p.ru}`.toLowerCase().includes(ui.search.toLowerCase()),
  );
  const body = razorTemplate("Phrasebook.Index.3", {
    value_0: heading(
      "Разговорник",
      "Поиск на русском и английском. Озвучка использует голоса браузера.",
    ),
    ui_search_1: esc(ui.search),
    value_2: [...new Set(data.phrases.map((p) => p.category))]
      .map((v) =>
        razorTemplate("Phrasebook.Index.1", {
          value_0: ui.category === v ? "selected" : "",
          v_1: esc(v),
        }),
      )
      .join(""),
    value_3: data.user
      ? button(
          ui.favoriteOnly ? "★ Только избранное" : "☆ Избранное",
          "ui.favoriteOnly=!ui.favoriteOnly;render()",
          true,
        )
      : "",
    value_4:
      phrases
        .map((p) =>
          razorTemplate("Phrasebook.Index.2", {
            p_category_0: esc(p.category),
            p_en_1: esc(p.en),
            p_ru_2: esc(p.ru),
            value_3: button("Открыть", `go('phrase?id=${p.id}')`, true),
            value_4: data.user
              ? button(
                  data.favorites.includes(p.id) ? "★" : "☆",
                  `favorite(${p.id})`,
                  true,
                )
              : "",
          }),
        )
        .join("") || empty("Фразы не найдены"),
  });
  return data.user ? shell(body) : publicShell(body);
}
function searchPhrases(el) {
  let pos = el.selectionStart;
  ui.search = el.value;
  render();
  let f = $("#search");
  f.focus();
  f.setSelectionRange(pos, pos);
}
async function favorite(id) {
  await mutate(
    "favorite",
    {
      id,
      enabled: !data.favorites.includes(id),
    },
    data.favorites.includes(id)
      ? "Удалено из избранного"
      : "Добавлено в словарь и повторение",
  );
}
function phraseScreen() {
  let p = data.phrases.find((p) => p.id === idParam()) || data.phrases[0];
  if (!p) return shell(empty("Фраз пока нет"));
  let body = razorTemplate("Phrasebook.Phrase.1", {
    value_0: button("← Разговорник", "go('phrasebook')", true),
    p_en_1: esc(p.en),
    p_ru_2: esc(p.ru),
    value_3: button("▶ Озвучить", `speakPhrase(${p.id},false)`),
    value_4: button("½ Медленнее", `speakPhrase(${p.id},true)`, true),
    value_5: button("На весь экран", "fullscreenPhrase()", true),
    value_6: data.user
      ? button(
          data.favorites.includes(p.id) ? "★ В словаре" : "☆ В словарь",
          `favorite(${p.id})`,
          true,
        )
      : "",
  });
  return data.user ? shell(body) : publicShell(body);
}
function speakPhrase(id, slow) {
  speak(data.phrases.find((p) => p.id === id).en, slow);
}
function fullscreenPhrase() {
  let el = $("#phrase-display");
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen)
    el.requestFullscreen().catch(() =>
      notice("Полноэкранный режим недоступен"),
    );
  else notice("Полноэкранный режим недоступен в браузере");
}
function mistakes() {
  let errors = ownAttempts().flatMap((a) =>
    JSON.parse(a.answers)
      .filter((x) => !x.correct)
      .map((x) => ({
        ...x,
        lid: a.lesson_id,
      })),
  );
  let due = data.reviews.filter((r) => r.due * 1000 <= Date.now());
  return shell(
    `${heading("Повторение", "Возвращайтесь к фразам через увеличивающиеся интервалы.")}${tabs(
      [
        ["words", "Личный словарь"],
        ["errors", "Ошибки"],
      ],
    )}${
      ui.tab === "errors"
        ? table(
            ["Задание", "Правильный ответ", "Действие"],
            errors.map((e) => [
              esc(e.prompt),
              esc(e.expected),
              button("Повторить урок", `startLesson(${e.lid})`, true),
            ]),
          )
        : razorTemplate("Learning.Review.2", {
            due_length_0: due.length,
            data_reviews_length_1: data.reviews.length,
            value_2:
              due
                .map((r) => {
                  let p = data.phrases.find((p) => p.id === r.phrase_id);
                  return razorTemplate("Learning.Review.1", {
                    p_en_0: esc(p.en),
                    p_ru_1: esc(p.ru),
                    value_2: button("Помню", `reviewPhrase(${p.id},true)`),
                    value_3: button(
                      "Повторить позже",
                      `reviewPhrase(${p.id},false)`,
                      true,
                    ),
                  });
                })
                .join("") ||
              empty(
                "Сейчас повторений нет. Добавьте фразы из разговорника или вернитесь позже.",
              ),
          })
    }`,
  );
}
async function reviewPhrase(id, known) {
  await mutate(
    "review",
    {
      id,
      known,
    },
    known ? "Следующее повторение запланировано" : "Повторение через 10 минут",
  );
}
function profileScreen() {
  return travelProfile();
}
async function profileSave(form) {
  let v = payload(form);
  await mutate("profile", {
    name: v.name,
    profile: {
      trip_date: v.trip_date,
      minutes: Number(v.minutes),
    },
  });
}
async function joinGroup(form) {
  await mutate("join", payload(form), "Вы вступили в группу");
}
async function changePassword(form) {
  await mutate(
    "password",
    payload(form),
    "Пароль изменён; другие сессии завершены",
  );
  form.reset();
}
async function deleteAccount(form) {
  if (!confirm("Удалить ваш аккаунт и все результаты?")) return;
  await action(async () => {
    const uid = data.user.id;
    await api("delete-account", payload(form));
    await clearAccountCache(uid);
    await refresh();
    go("home");
  });
}
function adminScreen() {
  let learners = data.users.filter((u) => u.role === "student");
  let attempts = data.attempts;
  return shell(
    razorTemplate("Management.Overview.3", {
      value_0: heading(
        "Панель " + (admin() ? "администратора" : "преподавателя"),
        "Показатели из базы данных",
        button("Открыть группы", "go('groups')"),
      ),
      value_1: stats([
        [learners.length, "учеников"],
        [data.groups.length, "групп"],
        [attempts.length, "попыток"],
        [
          attempts.length
            ? Math.round(
                attempts.reduce((s, a) => s + a.score, 0) / attempts.length,
              ) + "%"
            : "—",
          "средняя точность",
        ],
      ]),
      value_2:
        attempts
          .slice(-8)
          .reverse()
          .map((a) =>
            razorTemplate("Management.Overview.1", {
              value_0: esc(
                data.users.find((u) => u.id === a.user_id)?.name || "Ученик",
              ),
              value_1: esc(
                data.lessons.find((l) => l.id === a.lesson_id)?.title,
              ),
              a_score_2: a.score,
            }),
          )
          .join("") || empty("Результаты появятся после прохождения уроков"),
      value_3: data.audit
        .slice(0, 8)
        .map((a) =>
          razorTemplate("Management.Overview.2", {
            value_0: new Date(a.created).toLocaleString("ru"),
            value_1: esc(a.name || "Удалённый аккаунт"),
            a_action_2: esc(a.action),
          }),
        )
        .join(""),
    }),
  );
}
function groupsScreen() {
  return shell(
    razorTemplate("Management.Groups.2", {
      value_0: heading(
        "Учебные группы",
        "Создавайте группы и приглашайте учеников по коду.",
      ),
      value_1: input("name", "Название новой группы"),
      value_2: table(
        ["Группа", "Код приглашения", "Учеников", "Действия"],
        data.groups.map((g) => [
          esc(g.name),
          razorTemplate("Management.Groups.1", {
            g_code_0: esc(g.code),
          }),
          data.members.filter((m) => m.group_id === g.id).length,
          button("Открыть", `go('group?id=${g.id}')`, true),
        ]),
      ),
    }),
  );
}
async function createGroup(form) {
  await action(async () => {
    let r = await api("groups", payload(form));
    await refresh();
    go("group?id=" + r.id);
    notice("Группа создана");
  });
}
function groupScreen() {
  let g = data.groups.find((g) => g.id === idParam()) || data.groups[0];
  if (!g)
    return shell(
      `${heading("Сначала создайте группу")}${button("Группы", "go('groups')")}`,
    );
  return shell(
    `${heading(g.name, "Код приглашения: " + g.code, button("Скопировать код", `copyGroup(${g.id})`, true))}${tabs(
      [
        ["students", "Ученики"],
        ["assignments", "Назначения"],
      ],
    )}${
      ui.tab === "assignments"
        ? razorTemplate("Management.Group.1", {
            g_id_0: g.id,
            value_1: select(
              "module_id",
              "Модуль",
              data.modules.map((m) => [m.id, m.title]),
            ),
            value_2: select("student_id", "Кому назначить", [[0, "Всей группе"], ...data.members.filter(m=>m.group_id===g.id).map(m=>[m.user_id,m.name])]) + input("due", "Срок выполнения", "", "date", false),
            value_3: table(
              ["Модуль", "Получатель", "Срок"],
              data.assignments
                .filter((a) => a.group_id === g.id)
                .map((a) => [
                  esc(data.modules.find((m) => m.id === a.module_id)?.title),
                  esc(a.student_id ? data.users.find(u=>u.id===a.student_id)?.name || "Ученик" : "Вся группа"),
                  esc(a.due || "Без срока"),
                ]),
            ),
          })
        : razorTemplate("Management.Group.2", {
            g_id_0: g.id,
            value_1: input(
              "email",
              "Почта зарегистрированного ученика",
              "",
              "email",
            ),
            value_2: table(
              ["Имя", "Почта", "Действие"],
              data.members
                .filter((m) => m.group_id === g.id)
                .map((m) => [
                  esc(m.name),
                  esc(m.email),
                  button(
                    "Исключить",
                    `removeMember(${g.id},${m.user_id})`,
                    true,
                  ),
                ]),
            ),
          })
    }`,
  );
}
async function copyGroup(id) {
  try {
    await navigator.clipboard.writeText(
      data.groups.find((g) => g.id === id).code,
    );
    notice("Код скопирован");
  } catch {
    notice("Код указан рядом с названием группы");
  }
}
async function assignModule(form, gid) {
  await mutate(
    "assignments",
    {
      ...payload(form),
      group_id: gid,
    },
    "Назначение сохранено",
  );
}
async function addMember(form, gid) {
  await mutate(
    "members",
    {
      ...payload(form),
      group_id: gid,
    },
    "Ученик добавлен",
  );
}
async function removeMember(gid, uid) {
  if (!confirm("Исключить ученика из группы? Учебные результаты сохранятся."))
    return;
  let m = data.members.find((m) => m.group_id === gid && m.user_id === uid);
  await mutate(
    "members",
    {
      group_id: gid,
      email: m.email,
      remove: true,
    },
    "Ученик исключён",
  );
}
function statusFor(uid, mid) {
  let percent = moduleProgress(mid, uid);
  let groupIds = data.members
    .filter((m) => m.user_id === uid)
    .map((m) => m.group_id);
  let assigned = data.assignments.find(
    (a) => groupIds.includes(a.group_id) && a.module_id === mid && (!a.student_id || a.student_id===uid),
  );
  let attempts = data.attempts.filter(
    (a) =>
      a.user_id === uid &&
      data.lessons.find((l) => l.id === a.lesson_id)?.module_id === mid,
  );
  if (percent === 100) return "Пройден";
  if (attempts.length)
    return attempts.at(-1).score < 80 ? "Нужно повторить" : "В процессе";
  return assigned ? "Назначен" : "Не назначен";
}
function registry() {
  let users = data.users.filter(
    (u) =>
      u.role === "student" &&
      (!ui.filterGroup ||
        data.members.some(
          (m) => m.user_id === u.id && String(m.group_id) === ui.filterGroup,
        )),
  );
  let modules = data.modules.filter(
    (m) => !ui.filterModule || String(m.id) === ui.filterModule,
  );
  if (ui.filterStatus)
    users = users.filter((u) =>
      modules.some((m) => statusFor(u.id, m.id) === ui.filterStatus),
    );
  return shell(
    razorTemplate("Management.Progress.5", {
      value_0: heading(
        "Реестр прогресса",
        "Статусы обновляются после отправки результатов учеником.",
        button("Обновить", "reloadData()", true),
      ),
      value_1: data.groups
        .map((g) =>
          razorTemplate("Management.Progress.1", {
            g_id_0: g.id,
            value_1: ui.filterGroup === String(g.id) ? "selected" : "",
            g_name_2: esc(g.name),
          }),
        )
        .join(""),
      value_2: data.modules
        .map((m) =>
          razorTemplate("Management.Progress.2", {
            m_id_0: m.id,
            value_1: ui.filterModule === String(m.id) ? "selected" : "",
            m_title_2: esc(m.title),
          }),
        )
        .join(""),
      value_3: [
        "Не назначен",
        "Назначен",
        "В процессе",
        "Пройден",
        "Нужно повторить",
      ]
        .map((s) =>
          razorTemplate("Management.Progress.3", {
            value_0: ui.filterStatus === s ? "selected" : "",
            s_1: s,
          }),
        )
        .join(""),
      value_4: table(
        ["Ученик", ...modules.map((m) => esc(m.title))],
        users.map((u) => [
          esc(u.name),
          ...modules.map((m) =>
            razorTemplate("Management.Progress.4", {
              value_0: statusFor(u.id, m.id) === "Пройден" ? "done" : "",
              value_1: statusFor(u.id, m.id),
              value_2: moduleProgress(m.id, u.id),
              overdue: typeof assignmentOverdue === "function" && assignmentOverdue(u.id,m.id) ? "Просрочено" : "",
            }),
          ),
        ]),
      ),
    }),
  );
}
async function reloadData() {
  await action(async () => {
    await refresh();
    render();
    notice("Данные обновлены");
  });
}
function modulesScreen() {
  return shell(
    `${heading("Модули и уроки", "Черновики видны только сотрудникам. Опубликованные уроки доступны ученикам.", admin() ? button("Создать урок", "newLesson()") : "")} ${data.modules
      .map((m) =>
        razorTemplate("Management.Modules.2", {
          m_title_0: esc(m.title),
          value_1: table(
            ["Урок", "Версия", "Статус", "Действия"],
            data.lessons
              .filter((l) => l.module_id === m.id)
              .map((l) => [
                esc(l.title),
                l.version,
                l.published ? "Опубликован" : "Черновик",
                admin()
                  ? razorTemplate("Management.Modules.1", {
                      value_0: button(
                        "Редактировать",
                        `editLesson(${l.id})`,
                        true,
                      ),
                      value_1: button(
                        l.published ? "Снять с публикации" : "Опубликовать",
                        `publishLesson(${l.id})`,
                        true,
                      ),
                      value_2: button(
                        "Копировать",
                        `duplicateLesson(${l.id})`,
                        true,
                      ),
                    })
                  : button("Просмотреть", `go('lesson?id=${l.id}')`, true),
              ]),
          ),
        }),
      )
      .join("")}`,
  );
}
function defaultStep() {
  return {
    type: "choice",
    prompt: "Новый вопрос",
    options: ["Правильный ответ", "Другой ответ"],
    answer: 0,
    hint: "",
  };
}
function newLesson() {
  ui.editor = {
    module_id: data.modules[0].id,
    title: "Новый урок",
    description: "",
    level: "A1",
    published: false,
    steps: [defaultStep()],
  };
  go("editor");
  ui.tab = "general";
  render();
}
function editLesson(id) {
  ui.editor = structuredClone(data.lessons.find((l) => l.id === id));
  go("editor?id=" + id);
}
async function publishLesson(id) {
  let l = structuredClone(data.lessons.find((l) => l.id === id));
  l.published = !l.published;
  await mutate(
    "lessons",
    l,
    l.published ? "Урок опубликован" : "Урок снят с публикации",
  );
}
async function duplicateLesson(id) {
  let l = structuredClone(data.lessons.find((l) => l.id === id));
  delete l.id;
  l.title += " — копия";
  l.published = false;
  await mutate("lessons", l, "Копия сохранена как черновик");
}
function updateEditor(key, value) {
  ui.editor[key] = value;
}
function changeStep(i, key, value) {
  ui.editor.steps[i][key] = value;
}
function changeStepType(i, type) {
  let s = ui.editor.steps[i];
  s.type = type;
  if (["choice", "listening"].includes(type)) {
    s.options = s.options || ["Первый ответ", "Второй ответ"];
    s.answer = s.answer || 0;
  } else {
    s.accepted = s.accepted || ["Example answer."];
  }
  render();
}
function editorScreen() {
  if (!ui.editor) {
    let l = data.lessons.find((l) => l.id === idParam());
    if (l) ui.editor = structuredClone(l);
  }
  const l = ui.editor;
  if (!l)
    return shell(
      `${heading("Редактор урока")}${button("Создать урок", "newLesson()")}`,
    );
  const tab = ui.tab || "general";
  return shell(
    `${heading("Редактор урока", l.id ? "Редактирование версии " + l.version : "Новый черновик", button("Сохранить урок", "saveLesson()"))}${tabs(
      [
        ["general", "Общие сведения"],
        ["steps", "Упражнения и диалог"],
        ["preview", "Предпросмотр"],
        ["stats", "Статистика"],
      ],
    )}${
      tab === "general"
        ? razorTemplate("Management.Editor.3", {
            l_title_0: esc(l.title),
            l_description_1: esc(l.description),
            value_2: data.modules
              .map((m) =>
                razorTemplate("Management.Editor.1", {
                  m_id_0: m.id,
                  value_1: m.id === Number(l.module_id) ? "selected" : "",
                  m_title_2: esc(m.title),
                }),
              )
              .join(""),
            value_3: ["A1", "A2", "B1"]
              .map((v) =>
                razorTemplate("Management.Editor.2", {
                  value_0: l.level === v ? "selected" : "",
                  v_1: v,
                }),
              )
              .join(""),
            value_4: l.published ? "checked" : "",
          })
        : tab === "steps"
          ? `${l.steps
              .map((s, i) =>
                razorTemplate("Management.Editor.8", {
                  value_0: i + 1,
                  value_1: i > 0 ? button("↑", `moveStep(${i},-1)`, true) : "",
                  value_2:
                    i < l.steps.length - 1
                      ? button("↓", `moveStep(${i},1)`, true)
                      : "",
                  value_3: button("Удалить", `deleteStep(${i})`, true),
                  i_4: i,
                  value_5: [
                    ["choice", "Выбор ответа"],
                    ["listening", "Аудирование"],
                    ["text", "Письменный ответ"],
                    ["dialogue", "Диалог"],
                  ]
                    .map(([v, t]) =>
                      razorTemplate("Management.Editor.4", {
                        v_0: v,
                        value_1: s.type === v ? "selected" : "",
                        t_2: t,
                      }),
                    )
                    .join(""),
                  i_6: i,
                  s_prompt_7: esc(s.prompt),
                  value_8:
                    s.type === "listening"
                      ? razorTemplate("Management.Editor.5", {
                          value_0: esc(s.audio || ""),
                          i_1: i,
                        })
                      : "",
                  value_9: ["choice", "listening"].includes(s.type)
                    ? razorTemplate("Management.Editor.6", {
                        i_0: i,
                        value_1: esc(s.options.join("\n")),
                        value_2: s.answer + 1,
                        i_3: i,
                      })
                    : razorTemplate("Management.Editor.7", {
                        i_0: i,
                        value_1: esc(s.accepted.join("\n")),
                      }),
                  value_10: esc(s.hint || ""),
                  i_11: i,
                }),
              )
              .join(
                "",
              )}${button("Добавить задание", "ui.editor.steps.push(defaultStep());render()")}`
          : tab === "preview"
            ? razorTemplate("Management.Editor.12", {
                l_title_0: esc(l.title),
                l_description_1: esc(l.description),
                value_2: l.steps
                  .map((s, i) =>
                    razorTemplate("Management.Editor.11", {
                      value_0: i + 1,
                      s_type_1: esc(s.type),
                      s_prompt_2: esc(s.prompt),
                      value_3: s.options
                        ? s.options
                            .map((v, j) =>
                              razorTemplate("Management.Editor.9", {
                                value_0: j === s.answer ? "✓" : "○",
                                v_1: esc(v),
                              }),
                            )
                            .join("")
                        : razorTemplate("Management.Editor.10", {
                            value_0: s.accepted.map(esc).join(" / "),
                          }),
                    }),
                  )
                  .join(""),
              })
            : table(
                ["Ученик", "Оценка", "Дата"],
                data.attempts
                  .filter((a) => a.lesson_id === l.id)
                  .map((a) => [
                    esc(
                      data.users.find((u) => u.id === a.user_id)?.name ||
                        "Ученик",
                    ),
                    a.score + "%",
                    new Date(a.created).toLocaleString("ru"),
                  ]),
              )
    }`,
  );
}
function moveStep(i, delta) {
  let steps = ui.editor.steps;
  [steps[i], steps[i + delta]] = [steps[i + delta], steps[i]];
  render();
}
function deleteStep(i) {
  if (ui.editor.steps.length === 1)
    return notice("В уроке должно остаться хотя бы одно задание");
  ui.editor.steps.splice(i, 1);
  render();
}
async function saveLesson() {
  await action(async () => {
    let result = await api("lessons", ui.editor);
    await refresh();
    ui.editor = structuredClone(data.lessons.find((l) => l.id === result.id));
    notice("Урок сохранён в базе");
    render();
  });
}
function importScreen() {
  const tab = ui.tab || "phrases";
  return shell(
    `${heading("Разговорник и импорт", "Редактируйте фразы и загружайте CSV / XLSX. До 2000 строк и 5 МБ.")}${tabs(
      [
        ["phrases", "Фразы"],
        ["import", "Импорт"],
      ],
    )}${
      tab === "phrases"
        ? razorTemplate("Management.Import.1", {
            value_0: input("en", "Фраза на английском"),
            value_1: input("ru", "Перевод"),
            value_2: input("category", "Категория", "Аэропорт"),
            value_3: table(
              ["Фраза", "Перевод", "Категория", "Действие"],
              data.phrases.map((p) => [
                esc(p.en),
                esc(p.ru),
                esc(p.category),
                button("Править", `editPhrase(${p.id})`, true),
              ]),
            ),
          })
        : razorTemplate("Management.Import.4", {
            value_0: button("Скачать пример CSV", "downloadSample()", true),
            value_1: ui.importData
              ? razorTemplate("Management.Import.2", {
                  value_0: ["en", "ru", "category"]
                    .map((k, i) =>
                      select(
                        k,
                        ["Английская фраза", "Перевод", "Категория"][i],
                        ui.importData.columns.map((c) => [c, c]),
                        ui.importData.columns.includes(k)
                          ? k
                          : ui.importData.columns[i],
                      ),
                    )
                    .join(""),
                  value_1: table(
                    ui.importData.columns.map(esc),
                    ui.importData.rows
                      .slice(0, 10)
                      .map((r) => ui.importData.columns.map((c) => esc(r[c]))),
                  ),
                  ui_importdata_rows_length_2: ui.importData.rows.length,
                })
              : "",
            value_2: ui.importResult
              ? razorTemplate("Management.Import.3", {
                  ui_importresult_added_0: ui.importResult.added,
                  value_1: table(
                    ["Строка", "Ошибка"],
                    ui.importResult.errors.map((e) => [e.row, esc(e.error)]),
                  ),
                })
              : "",
          })
    }`,
  );
}
async function savePhrase(form) {
  await mutate("phrases", payload(form), "Фраза добавлена");
}
function editPhrase(id) {
  const p = data.phrases.find((p) => p.id === id);
  const dialog = document.createElement("dialog");
  dialog.className = "edit-dialog";
  dialog.innerHTML = razorTemplate("Phrasebook._EditDialog.1", {
    value_0: input("en", "Английский", p.en),
    value_1: input("ru", "Перевод", p.ru),
    value_2: input("category", "Категория", p.category),
  });
  document.body.append(dialog);
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "save")
      mutate(
        "phrases",
        {
          ...payload(dialog.querySelector("form")),
          id,
        },
        "Фраза обновлена",
      );
    dialog.remove();
  });
  dialog.showModal();
}
async function readImport(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  if (file.size > 5_000_000) return notice("Файл больше 5 МБ");
  await action(async () => {
    let bytes = new Uint8Array(await file.arrayBuffer());
    let chars = "";
    for (let i = 0; i < bytes.length; i += 8192)
      chars += String.fromCharCode(...bytes.subarray(i, i + 8192));
    ui.importData = await api("import-preview", {
      name: file.name,
      file: btoa(chars),
    });
    ui.importResult = null;
    render();
  });
}
async function performImport(form) {
  const mapping = payload(form);
  if (new Set(Object.values(mapping)).size !== 3)
    return notice("Выберите три разных столбца");
  await action(async () => {
    const rows = ui.importData.rows.map((r) =>
      Object.fromEntries(Object.entries(mapping).map(([k, c]) => [k, r[c]])),
    );
    ui.importResult = await api("import", {
      rows,
    });
    ui.importData = null;
    await refresh();
    render();
    notice("Импорт завершён");
  });
}
function downloadSample() {
  downloadBlob(
    new Blob(
      [
        "\ufeffen,ru,category\nWhere is the bus stop?,Где автобусная остановка?,Город\n",
      ],
      {
        type: "text/csv;charset=utf-8",
      },
    ),
    "phrase-template.csv",
  );
}
function downloadBlob(blob, name) {
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function reportsScreen() {
  const tab = route().params.get("tab") || ui.tab || "reports";
  const items = [
    ["reports", "Отчёты"],
    ["audit", "Журнал"],
    ...(admin() ? [["users", "Пользователи и роли"]] : []),
  ];
  return shell(
    `${heading("Отчёты и управление", "Данные доступны только в пределах ваших полномочий.")}${
      admin()
        ? razorTemplate("Management.Reports.2", {
            value_0: items
              .map(([key, label]) =>
                razorTemplate("Management.Reports.1", {
                  value_0: tab === key ? "active" : "",
                  value_1: key === "reports" ? "" : "?tab=" + key,
                  label_2: label,
                }),
              )
              .join(""),
          })
        : tabs(items)
    }${
      tab === "users" && admin()
        ? table(
            ["Имя", "Почта", "Роль", "Действия"],
            data.users.map((u) => [
              esc(u.name),
              esc(u.email),
              esc(u.role),
              u.id === data.user.id
                ? "Текущий аккаунт"
                : razorTemplate("Management.Reports.4", {
                    u_name_0: esc(u.name),
                    u_id_1: u.id,
                    value_2: ["student", "teacher", "admin"]
                      .map((v) =>
                        razorTemplate("Management.Reports.3", {
                          value_0: v === u.role ? "selected" : "",
                          v_1: v,
                        }),
                      )
                      .join(""),
                  }),
            ]),
          )
        : tab === "audit"
          ? table(
              ["Дата", "Пользователь", "Действие"],
              data.audit.map((a) => [
                new Date(a.created).toLocaleString("ru"),
                esc(a.name || "Удалён"),
                esc(a.action),
              ]),
            )
          : razorTemplate("Management.Reports.6", {
              value_0: data.groups
                .map((g) =>
                  razorTemplate("Management.Reports.5", {
                    g_id_0: g.id,
                    g_name_1: esc(g.name),
                  }),
                )
                .join(""),
              value_1: button("Скачать XLSX", "exportReport('xlsx')"),
              value_2: button("Скачать CSV", "exportReport('csv')", true),
            })
    }`,
  );
}
async function exportReport(format) {
  await action(async () => {
    const group = $("#report-group")?.value || "";
    const res = await fetch(`/api/report?format=${format}&group=${group}`, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      let r = await res.json();
      throw new Error(r.error);
    }
    downloadBlob(await res.blob(), "lingway-report." + format);
    await refresh();
    notice("Отчёт скачан");
  });
}
async function changeRole(id, role) {
  if (
    !confirm(
      "Изменить роль на " +
        role +
        "? Активные сессии пользователя будут завершены.",
    )
  ) {
    render();
    return;
  }
  await mutate(
    "role",
    {
      id,
      role,
    },
    "Роль обновлена",
  );
}
const views = {
  home,
  course,
  login,
  register,
  verify,
  reset,
  privacy: () => legal("privacy"),
  terms: () => legal("terms"),
  welcome,
  goal,
  "trip-date": tripDate,
  "level-test": levelTest,
  "test-result": testResult,
  dashboard,
  map: mapScreen,
  module: moduleScreen,
  lesson: lessonScreen,
  exercise: exerciseScreen,
  dialogue: exerciseScreen,
  "lesson-result": lessonResult,
  mistakes,
  phrasebook,
  phrase: phraseScreen,
  profile: profileScreen,
  teacher: adminScreen,
  admin: adminScreen,
  groups: groupsScreen,
  group: groupScreen,
  registry,
  modules: modulesScreen,
  editor: editorScreen,
  import: importScreen,
  reports: reportsScreen,
};
const publicPages = [
  "home",
  "course",
  "login",
  "register",
  "reset",
  "privacy",
  "terms",
  "phrasebook",
  "phrase",
];
const staffPages = [
  "teacher",
  "admin",
  "groups",
  "group",
  "registry",
  "modules",
  "editor",
  "import",
  "reports",
];
screenNames.push(["teacher", "Кабинет преподавателя"]);
const personalPages = [
  "welcome",
  "goal",
  "trip-date",
  "level-test",
  "test-result",
  "dashboard",
  "map",
  "module",
  "lesson",
  "exercise",
  "dialogue",
  "lesson-result",
  "mistakes",
  "phrasebook",
  "phrase",
  "profile",
  "profile-edit",
  "account",
  "settings",
  "verify",
];
const rolePages = {
  student: new Set(personalPages),
  teacher: new Set([
    ...personalPages,
    "teacher",
    "groups",
    "group",
    "registry",
    "reports",
  ]),
  admin: new Set([
    ...personalPages,
    "admin",
    "groups",
    "group",
    "registry",
    "modules",
    "editor",
    "import",
    "reports",
  ]),
};
function render() {
  const page = route().page;
  try {
    let html;
    const publicPage = publicPages.includes(page);
    const allowed =
      data.user && (publicPage || rolePages[data.user.role]?.has(page));
    if (!data.user && !publicPage) html = login();
    else if (data.user && !allowed)
      html = shell(
        `${heading("Раздел недоступен", "Для каждой роли в этой версии предусмотрен отдельный кабинет.")}${button("Перейти в свой кабинет", `go('${roleHome()}')`)}`,
      );
    else html = (views[page] || home)();
    $("#app").innerHTML = html;
    applyPreferences();
    restoreDraft();
    document.title =
      (screenNames.find(([k]) => k === page)?.[1] || "LingWay") + " · LingWay";
  } catch (e) {
    $("#app").innerHTML = publicShell(
      razorTemplate("Shared._Render.1", {
        e_message_0: esc(e.message),
      }),
    );
    console.error(e);
  }
}
window.addEventListener("hashchange", () => {
  render();
  scrollTo(0, 0);
});
window.addEventListener("online", async () => {
  try {
    await refresh();
    await syncQueue();
    render();
  } catch (e) {
    notice(e.message);
  }
});
window.addEventListener("offline", render);
async function boot() {
  try {
    await refresh();
  } catch (e) {
    let uid = localStorage.getItem("tt-last-user");
    let snapshot = uid && localStorage.getItem("tt-snapshot-" + uid);
    if (snapshot) {
      data = JSON.parse(snapshot);
      notice("Открыта сохранённая версия. Действия управления требуют сети.");
    } else {
      notice("Сервер недоступен. Запустите START.bat в папке проекта.");
    }
  }
  render();
  if ("serviceWorker" in navigator)
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  await syncQueue();
}
// Boot is invoked by account.js after registering account routes.
