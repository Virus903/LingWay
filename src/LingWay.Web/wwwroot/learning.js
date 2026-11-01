"use strict";

// Shared extension: learning screens, editor, offline packages and progress.
const stepLabels = {
  vocabulary: "Карточка слова",
  choice: "Выбор ответа",
  listening: "Аудирование",
  text: "Письменный ответ",
  dialogue: "Диалог",
  dictation: "Диктант",
  order: "Сборка фразы",
  gap: "Пропуск",
  repeat: "Повтор за диктором",
  situation: "Мини-ситуация",
};
const learningState = {
  recent: false,
  words: [],
  import: null,
  checked: null,
  report: {},
  notificationAsked: false,
};
const guest = () => !!profile().guest;
const lessonPassed = (l, uid = data.user?.id) =>
  data.attempts.some(
    (a) =>
      a.user_id === uid &&
      a.lesson_id === l.id &&
      (a.passed ?? (a.score >= (l.meta?.criteria?.pass_score || 80))),
  );
moduleProgress = function (mid, uid = data.user?.id) {
  const lessons = data.lessons.filter(
    (l) => l.published && l.module_id === mid,
  );
  return lessons.length
    ? Math.round(
        (100 * lessons.filter((l) => lessonPassed(l, uid)).length) /
          lessons.length,
      )
    : 0;
};
function moduleUnlocked(mid) {
  const m = data.modules.find((x) => x.id === mid);
  if (!m) return false;
  if (staff() || m.emergency) return true;
  const previous = data.modules
    .filter((x) => !x.emergency && x.position < m.position)
    .sort((a, b) => b.position - a.position)[0];
  return !previous || moduleProgress(previous.id) === 100;
}
function learningHeading(title, sub = "", action = "") {
  return razorTemplate("Shared._LearningHeading.1", {
    title_0: esc(title),
    sub_1: esc(sub),
    action_2: action,
  });
}
function learningShell(body) {
  return shell(
    razorTemplate("Shared._LearningShell.1", {
      body_0: body,
    }),
  );
}
function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function learningMetrics() {
  const attempts = ownAttempts(),
    days = new Set(attempts.map((a) => localDay(new Date(a.created))));
  let date = new Date(),
    streak = 0;
  if (!days.has(localDay(date))) date.setDate(date.getDate() - 1);
  while (days.has(localDay(date))) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  const minutes = Math.round(
    attempts
      .filter((a) => localDay(new Date(a.created)) === localDay())
      .reduce((n, a) => n + (data.durations?.[a.id] || 0), 0) / 60,
  );
  return {
    streak,
    minutes,
    completed: data.lessons.filter((l) => lessonPassed(l)).length,
  };
}
function metricsMarkup() {
  const m = learningMetrics();
  return razorTemplate("Shared._MetricsMarkup.2", {
    value_0: [
      [m.completed, "Уроков пройдено"],
      [m.streak, "Дней подряд"],
      [`${m.minutes} / ${profile().minutes || 15}`, "Минут сегодня"],
      [(data.vocabulary || []).length, "Слов изучено"],
    ]
      .map(([v, label]) =>
        razorTemplate("Shared._MetricsMarkup.1", {
          v_0: v,
          label_1: label,
        }),
      )
      .join(""),
  });
}
function sceneMarkup(icon = "plane", image = "") {
  if (image && /^data:image\/(png|jpeg|webp);base64,/.test(image))
    return razorTemplate("Shared._SceneMarkup.1", {
      image_0: esc(image),
    });
  return razorTemplate("Shared._SceneMarkup.2", {
    value_0: iconPaths[icon] || iconPaths.book,
  });
}
function passportMarkup() {
  const awards = data.awards || [];
  return razorTemplate("Learning._Passport.3", {
    value_0: data.modules
      .map((m) => {
        const a = awards.find(
          (a) => a.kind === "stamp" && a.key === String(m.id),
        );
        return razorTemplate("Learning._Passport.1", {
          value_0: a ? "earned" : "",
          value_1: accountIcon(a ? "passport" : "lock"),
          m_title_2: esc(m.title),
          value_3: a
            ? "Получен " + new Date(a.earned).toLocaleDateString("ru")
            : moduleProgress(m.id) + "% · завершите все уроки",
        });
      })
      .join(""),
    value_1: [
      ["first-lesson", "Первый шаг", "Завершите первый урок"],
      ["perfect", "Без ошибок", "Получите 100% за урок"],
      ["ten-lessons", "В пути", "Завершите 10 тренировок"],
    ]
      .map(([id, title, sub]) =>
        razorTemplate("Learning._Passport.2", {
          value_0: awards.some((a) => a.kind === "achievement" && a.key === id)
            ? "earned"
            : "",
          value_1: accountIcon("target"),
          title_2: title,
          sub_3: sub,
        }),
      )
      .join(""),
  });
}
dashboard = function () {
  const saved = typeof pendingLesson === "function" ? pendingLesson() : null;
  const next = (saved && data.lessons.find(l => l.id === saved.lesson_id)) || data.lessons.find(
    (l) => l.published && moduleUnlocked(l.module_id) && !lessonPassed(l),
  );
  const trip = profile().trip_date,
    days = trip
      ? Math.ceil((new Date(trip + "T23:59:59") - Date.now()) / 86400000)
      : null;
  const due =
    (data.vocabulary || []).filter((w) => w.due * 1000 <= Date.now()).length +
    data.reviews.filter((w) => w.due * 1000 <= Date.now()).length;
  const pkg = data.packages?.[0];
  return learningShell(
    razorTemplate("Learning.Dashboard.3", {
      value_0: learningHeading(
        "Мой день",
        days !== null && days >= 0
          ? `До поездки ${days} дн. · ваш план на сегодня`
          : "Небольшой шаг сегодня — уверенный разговор в поездке",
      ),
      value_1: metricsMarkup(),
      value_2: profile().minutes || 15,
      value_3: esc(next?.title || "Маршрут пройден"),
      progress_13: saved ? `В процессе · выполнено ${saved.answers.length} заданий · продолжить с шага ${saved.index + 1}` : "",
      pending_14: JSON.parse(localStorage.getItem('tt-queue-' + data.user.id) || '[]').length
        ? "Завершённые уроки сохранены на устройстве и ожидают отправки. Они появятся в статистике после синхронизации." : "",
      due_4: due,
      value_5: button(
        saved ? "Продолжить с сохранённого шага" : next ? "Продолжить обучение" : "Открыть маршрут",
        saved ? `startLesson(${next.id})` : next ? `go('lesson?id=${next.id}')` : "go('map')",
      ),
      value_6: button("Повторить слова", "go('mistakes')", true),
      value_7: accountIcon("download"),
      value_8: pkg
        ? `Версия ${pkg.id} · ${(pkg.bytes / 1024 / 1024).toFixed(2)} МБ`
        : "Пакет ещё не опубликован",
      value_9: button("Загрузить пакет", "downloadOffline()", true),
      value_10: localStorage.getItem("lw-package")
        ? "Сохранена версия " +
          JSON.parse(localStorage.getItem("lw-package")).id
        : "После загрузки обучение доступно без сети",
      value_11: button("Открыть", "openEmergency()", true),
      value_12: data.assignments.length
        ? razorTemplate("Learning.Dashboard.2", {
            value_0: table(
              ["Модуль", "Срок", "Прогресс"],
              data.assignments.map((a) => [
                esc(data.modules.find((m) => m.id === a.module_id)?.title),
                esc(a.due || "Без срока"),
                moduleProgress(a.module_id) + "%",
              ]),
            ),
          })
        : "",
    }),
  );
};
function openEmergency() {
  ui.category = "Экстренные ситуации";
  location.hash = "phrasebook";
  render();
}
mapScreen = function () {
  return learningShell(
    razorTemplate("Learning.Map.5", {
      value_0: learningHeading(
        "Ваш маршрут",
        "Семь ситуаций путешествия. Завершайте модуль, чтобы открыть следующий.",
      ),
      value_1: metricsMarkup(),
      value_2: data.modules
        .map((m, i) => {
          const unlocked = moduleUnlocked(m.id),
            p = moduleProgress(m.id);
          return razorTemplate("Learning.Map.4", {
            value_0: unlocked ? "" : "locked",
            value_1: accountIcon(
              m.emergency ? "shield" : unlocked ? "route" : "lock",
            ),
            value_2: m.emergency ? "Доступно всегда" : "Этап " + (i + 1),
            value_3: data.lessons.filter(
              (l) => l.module_id === m.id && l.published,
            ).length,
            m_title_4: esc(m.title),
            m_description_5: esc(m.description),
            value_6: progress(p),
            value_7: p === 100 ? "✓ Модуль пройден" : p + "% завершено",
            value_8: unlocked
              ? button("Открыть", `go('module?id=${m.id}')`, true)
              : razorTemplate("Learning.Map.3", {}),
          });
        })
        .join(""),
    }),
  );
};
const previousModuleScreen = moduleScreen;
moduleScreen = function () {
  const m = data.modules.find((m) => m.id === idParam()) || data.modules[0];
  if (!m) return learningShell(empty("Модуль не найден"));
  if (!moduleUnlocked(m.id))
    return learningShell(
      `${learningHeading(m.title, "Этот этап откроется после предыдущего модуля.")}${button("К маршруту", "go('map')")}`,
    );
  return learningShell(
    razorTemplate("Learning.Module.4", {
      value_0: learningHeading(m.title, m.description),
      value_1: progress(moduleProgress(m.id)),
      value_2: data.lessons
        .filter((l) => l.module_id === m.id && l.published)
        .map((l, i) =>
          razorTemplate("Learning.Module.3", {
            value_0: i + 1,
            l_level_1: esc(l.level),
            l_title_2: esc(l.title),
            value_3: lessonPathLength(l),
            value_4: l.meta?.minutes || 12,
            value_5: pendingLesson(l.id) ? `В процессе · ${pendingLesson(l.id).answers.length} заданий выполнено` : lessonPassed(l) ? "✓ Пройден" : "Слова, практика и диалог",
            value_6: button("Открыть урок", `go('lesson?id=${l.id}')`, true),
          }),
        )
        .join(""),
    }),
  );
};
lessonScreen = function () {
  const l =
    data.lessons.find((l) => l.id === idParam()) ||
    data.lessons.find((l) => l.published);
  if (!l) return learningShell(empty("Урок не найден"));
  if (!moduleUnlocked(l.module_id))
    return learningShell(
      `${learningHeading("Этот этап пока закрыт", "Завершите предыдущий модуль.")}${button("К маршруту", "go('map')")}`,
    );
  return learningShell(
    razorTemplate("Learning.Lesson.4", {
      value_0: learningHeading(l.title, l.description),
      value_1: sceneMarkup(l.meta?.icon),
      l_level_2: esc(l.level),
      value_3: lessonPathLength(l),
      value_4: button(pendingLesson(l.id) ? "Продолжить с сохранённого шага" : "Начать урок", `startLesson(${l.id})`),
      value_5: Object.entries(stepLabels)
        .filter(([k]) => l.steps.some((s) => s.type === k))
        .map(([k, label]) =>
          razorTemplate("Learning.Lesson.3", {
            label_0: label,
            value_1: l.steps.filter((s) => s.type === k).length,
          }),
        )
        .join(""),
      value_6: l.meta?.criteria?.pass_score || 80,
    }),
  );
};
startLesson = function (id) {
  const l = data.lessons.find((l) => l.id === id);
  if (!l?.published) return notice("Урок не опубликован");
  if (!moduleUnlocked(l.module_id))
    return notice("Сначала завершите предыдущий модуль");
  training = {
    id: crypto.randomUUID(),
    lesson_id: id,
    version: l.version,
    lesson: structuredClone(l),
    index: 0,
    answers: [],
    hint: false,
    hintLevel: 0,
    feedback: null,
    started: Date.now(),
    duration: 0,
    lastActive: Date.now(),
    tokens: [],
  };
  persistTraining();
  go("exercise");
};
currentLesson = function () {
  return (
    training?.lesson ||
    data.lessons.find((l) => l.id === (training?.lesson_id || idParam())) ||
    data.lessons.find((l) => l.published)
  );
};
persistTraining = function () {
  if (training && data.user) {
    const now = Date.now();
    if (training.lastActive)
      training.duration =
        (training.duration || 0) +
        Math.min(60, (now - training.lastActive) / 1000);
    training.lastActive = now;
    localStorage.setItem(
      "tt-training-" + data.user.id,
      JSON.stringify(training),
    );
    sessionStorage.setItem(
      "tt-training-" + data.user.id,
      JSON.stringify(training),
    );
  }
};
function dialoguePrompt(s) {
  const prev = training.answers[training.answers.length - 1]?.value;
  return (
    s.branches?.find((b) => normalize(b.previous) === normalize(prev))
      ?.prompt || s.prompt
  );
}
function currentAnswer() {
  return $("#f-value")?.value || training.draft || "";
}
exerciseScreen = function () {
  if (!training && data.user) {
    try {
      training = JSON.parse(
        localStorage.getItem("tt-training-" + data.user.id) ||
          sessionStorage.getItem("tt-training-" + data.user.id),
      );
    } catch {}
  }
  if (!training)
    return learningShell(
      `${learningHeading("Выберите урок", "Весь маршрут доступен на карте путешествия.")}${button("Открыть маршрут", "go('map')")}`,
    );
  const l = currentLesson(),
    s = l.steps[training.index];
  if (!s) return lessonResult();
  const feedback = training.feedback,
    choice = ["choice", "listening", "situation"].includes(s.type),
    word = s.type === "vocabulary";
  const expected = s.options ? s.options[s.answer] : s.accepted?.[0];
  const hints = s.hints || [
    s.translation || s.hint || "Попробуйте вспомнить смысл фразы.",
    "Начало: " + (expected || "").split(" ").slice(0, 2).join(" "),
    expected,
  ];
  let controls = "";
  if (word)
    controls = razorTemplate("Learning.Exercise.6", {
      value_0: esc(s.ipa || ""),
      s_translation_1: esc(s.translation),
      value_2: button("Прослушать слово", "speakStep(false)", true),
    });
  else if (choice)
    controls = s.options
      .map((v, i) =>
        razorTemplate("Learning.Exercise.7", {
          i_0: i,
          value_1: String(training.draft) === String(i) ? "checked" : "",
          v_2: esc(v),
        }),
      )
      .join("");
  else if (s.type === "order") {
    const tokens = s.tokens || s.accepted[0].split(" "),
      selected = training.tokens || [];
    controls = razorTemplate("Learning.Exercise.11", {
      value_0: esc(s.translation || ""),
      value_1:
        selected
          .map((index, i) =>
            razorTemplate("Learning.Exercise.8", {
              i_0: i,
              value_1: esc(tokens[index]),
            }),
          )
          .join("") || razorTemplate("Learning.Exercise.9", {}),
      value_2: tokens
        .map((v, i) => ({
          v,
          i,
        }))
        .sort((a, b) => a.v.localeCompare(b.v))
        .map(({ v, i }) =>
          razorTemplate("Learning.Exercise.10", {
            value_0: selected.includes(i) ? "disabled" : "",
            i_1: i,
            v_2: esc(v),
          }),
        )
        .join(""),
      value_3: esc(selected.map((i) => tokens[i]).join(" ")),
    });
  } else
    controls = `${input("value", s.type === "gap" ? "Пропущенное слово" : "Ваш ответ на английском", training.draft || "")} ${
      ["dialogue", "repeat"].includes(s.type)
        ? razorTemplate("Learning.Exercise.14", {
            value_0: button(
              accountIcon("volume") + " Ответить голосом",
              "recognize()",
              true,
            ),
            value_1: button(
              "Выбрать готовый ответ",
              "training.alternatives=!training.alternatives;render()",
              true,
            ),
            value_2: training.alternatives
              ? razorTemplate("Learning.Exercise.13", {
                  value_0: [...s.accepted, "Sorry, I do not understand."]
                    .map((v, i) =>
                      razorTemplate("Learning.Exercise.12", {
                        i_0: i,
                        v_1: esc(v),
                      }),
                    )
                    .join(""),
                })
              : "",
          })
        : ""
    }`;
  const conversation =
    s.type === "dialogue"
      ? training.answers
          .map((a, i) => ({
            a,
            s: l.steps[a.step_index ?? i],
          }))
          .filter((x) => x.s.type === "dialogue")
          .map((x) =>
            razorTemplate("Learning.Exercise.15", {
              x_s_prompt_0: esc(x.s.prompt),
              x_a_value_1: esc(x.a.value),
            }),
          )
          .join("")
      : "";
  return shell(
    razorTemplate("Learning.Exercise.23", {
      value_0: learningHeading(
        l.title,
        `Шаг ${training.answers.length + (training.feedback ? 0 : 1)} из ${lessonPathLength(l)} · ${stepLabels[s.type]}${l.meta?.dialogue_paths ? " · один из двух маршрутов" : ""}`,
      ),
      value_1: progress((training.answers.length / lessonPathLength(l)) * 100),
      value_2:
        s.type === "vocabulary" && typeof wordIllustration === "function"
          ? wordIllustration(s)
          : ["vocabulary", "situation"].includes(s.type)
            ? sceneMarkup(s.scene || l.meta?.icon, s.image)
            : s.image
              ? sceneMarkup("", s.image)
              : "",
      value_3:
        s.type === "dialogue"
          ? esc(s.character || "Alex") + " · собеседник"
          : stepLabels[s.type],
      value_4: conversation
        ? razorTemplate("Learning.Exercise.16", {
            conversation_0: conversation,
          })
        : "",
      value_5: s.type === "dialogue" ? "learning-dialogue" : "",
      value_6: word ? "learning-word" : "",
      value_7: esc(s.type === "dialogue" ? dialoguePrompt(s) : s.prompt),
      value_8: ["listening", "dictation", "dialogue", "repeat"].includes(s.type)
        ? razorTemplate("Learning.Exercise.17", {
            value_0: button("Прослушать", "speakStep(false)", true),
            value_1: button("Медленнее", "speakStep(true)", true),
          })
        : "",
      value_9: feedback
        ? razorTemplate("Learning.Exercise.19", {
            feedback_status_0: esc(feedback.status),
            value_1: {
              correct: "Верно",
              near: "Почти верно",
              incorrect: "Попробуем ещё раз",
              unrecognized: "Ответ не распознан",
              studied: "Слово изучено",
            }[feedback.status],
            value_2:
              feedback.status === "near"
                ? "Ответ близок к образцу по написанию. Проверьте слова и грамматику."
                : feedback.correct
                  ? "Отлично, продолжим."
                  : "Сравните с образцом и повторите фразу.",
            feedback_expected_3: esc(feedback.expected),
            value_4: s.outcome
              ? razorTemplate("Learning.Exercise.18", {
                  s_outcome_0: esc(s.outcome),
                })
              : "",
          })
        : controls,
      value_10:
        s.type === "repeat"
          ? razorTemplate("Learning.Exercise.20", {
              value_0: button("Записать себя", "recordPractice()", true),
              value_1: button(
                "Оценить произношение",
                "assessRecordedPronunciation()",
                true,
              ),
            })
          : "",
      value_11: training.hintLevel
        ? razorTemplate("Learning.Exercise.21", {
            training_hintlevel_0: training.hintLevel,
            value_1: esc(hints[training.hintLevel - 1] || expected),
            value_2:
              training.hintLevel === 3
                ? button("Прослушать образец", "speakExpected()", true)
                : "",
          })
        : "",
      value_12: feedback
        ? `${!feedback.correct && (training.tries || 1) < 3 ? button("Попробовать снова", "retryStep()", true) : ""}${button(nextLearningStep() >= l.steps.length ? "Завершить урок" : "Продолжить", "nextStep()")}`
        : razorTemplate("Learning.Exercise.22", {
            value_0: word ? "Запомнил, дальше" : "Проверить",
            value_1: !word
              ? button(
                  training.hintLevel >= 3
                    ? "Все подсказки открыты"
                    : "Подсказка",
                  "showHint()",
                  true,
                )
              : "",
          }),
      value_13: !navigator.onLine
        ? "Нет сети · ответы сохраняются на устройстве."
        : "Прогресс этого урока сохраняется автоматически.",
    }),
  );
};
function addToken(i) {
  training.tokens = training.tokens || [];
  if (!training.tokens.includes(i)) training.tokens.push(i);
  training.draft = training.tokens
    .map(
      (i) =>
        (currentLesson().steps[training.index].tokens ||
          currentLesson().steps[training.index].accepted[0].split(" "))[i],
    )
    .join(" ");
  persistTraining();
  render();
}
function lessonPathLength(l) {
  let i = 0,
    count = 0;
  while (i < l.steps.length && count <= l.steps.length) {
    const s = l.steps[i],
      answer =
        training?.lesson_id === l.id
          ? training.answers.find((a) => a.step_index === i)?.value
          : undefined;
    i =
      s.routes?.find((r) => assessmentPolicy.normalize(r.answer) === assessmentPolicy.normalize(answer))
        ?.target ??
      s.next ??
      i + 1;
    count++;
  }
  return count;
}
function nextLearningStep() {
  const s = currentLesson().steps[training.index],
    value = training.answers.at(-1)?.value;
  return (
    s.routes?.find((r) => assessmentPolicy.normalize(r.answer) === assessmentPolicy.normalize(value))?.target ??
    s.next ??
    training.index + 1
  );
}
const moveLinearStep = moveStep,
  deleteLinearStep = deleteStep;
function hasDialogueRoutes() {
  return ui.editor.steps.some((s) => s.routes?.length || s.next !== undefined);
}
moveStep = function (i, delta) {
  if (hasDialogueRoutes())
    return notice(
      "Сначала удалите переходы диалога: перестановка изменит номера связанных шагов.",
    );
  moveLinearStep(i, delta);
};
deleteStep = function (i) {
  if (hasDialogueRoutes())
    return notice(
      "Сначала удалите переходы диалога: удаление изменит номера связанных шагов.",
    );
  deleteLinearStep(i);
};
function removeToken(i) {
  training.tokens.splice(i, 1);
  training.draft = training.tokens
    .map(
      (i) =>
        (currentLesson().steps[training.index].tokens ||
          currentLesson().steps[training.index].accepted[0].split(" "))[i],
    )
    .join(" ");
  persistTraining();
  render();
}
function chooseAlternative(i) {
  const s = currentLesson().steps[training.index];
  training.draft = [...s.accepted, "Sorry, I do not understand."][i];
  persistTraining();
  render();
}
showHint = function () {
  training.draft = currentAnswer();
  training.hint = true;
  training.hintLevel = Math.min(3, (training.hintLevel || 0) + 1);
  persistTraining();
  render();
};
function retryStep() {
  if ((training.tries || 1) >= 3) return notice("Три попытки использованы. Изучите образец и перейдите дальше.");
  training.answers.pop();
  training.feedback = null;
  training.tries = (training.tries || 1) + 1;
  persistTraining();
  render();
}
function localAssess(s, value, threshold = 0.82) {
  return assessmentPolicy.check(s, value, threshold);
}
answerStep = async function (form) {
  await action(async () => {
    const l = currentLesson(),
      s = l.steps[training.index],
      value =
        payload(form).value || (s.type === "vocabulary" ? s.accepted[0] : "");
    let feedback = localAssess(s, value, l.meta?.criteria?.near_threshold);
    if (navigator.onLine) {
      try {
        feedback = await api("assess", {
          lesson_id: l.id,
          version: l.version,
          index: training.index,
          value,
        });
      } catch (e) {
        if (e.status) throw e;
      }
    }
    training.answers.push({
      step_index: training.index,
      value,
      hint: training.hint,
      hint_level: training.hintLevel || 0,
      tries: training.tries || 1,
    });
    training.feedback = {
      ...feedback,
      expected: s.options ? s.options[s.answer] : s.accepted[0],
    };
    training.draft = value;
    persistTraining();
    render();
  });
};
nextStep = async function () {
  if (typeof stopLearningAudio === "function") stopLearningAudio();
  const target = nextLearningStep();
  if (target < currentLesson().steps.length) {
    training.index = target;
    Object.assign(training, {
      draft: "",
      hint: false,
      hintLevel: 0,
      feedback: null,
      tokens: [],
      alternatives: false,
      tries: 1,
    });
    persistTraining();
    render();
    return;
  }
  await action(async () => {
    persistTraining();
    const uid = data.user.id,
      attempt = {
        id: training.id,
        lesson_id: training.lesson_id,
        version: training.version,
        answers: training.answers,
        duration: Math.round(training.duration || 0),
      };
    try {
      const result = await api("attempt", attempt);
      sessionStorage.setItem("tt-result-" + uid, JSON.stringify(result));
      await refresh();
    } catch (e) {
      if (e.status) throw e;
      const key = "tt-queue-" + uid,
        q = JSON.parse(localStorage.getItem(key) || "[]");
      if (!q.some((x) => x.id === attempt.id)) q.push(attempt);
      localStorage.setItem(key, JSON.stringify(q));
      sessionStorage.setItem(
        "tt-result-" + uid,
        JSON.stringify({
          pending: true,
        }),
      );
    }
    sessionStorage.removeItem("tt-training-" + uid);
    localStorage.removeItem("tt-training-" + uid);
    training = null;
    go("lesson-result");
    offerNotifications();
  });
};
speakStep = function (slow) {
  const s = currentLesson().steps[training.index];
  if (s.audio_file && /^data:audio\//.test(s.audio_file)) {
    const audio = new Audio(s.audio_file);
    audio.playbackRate = slow ? 0.65 : 1;
    audio.play().catch(() => notice("Не удалось воспроизвести запись"));
    return;
  }
  speak(
    s.audio || (s.type === "dialogue" ? dialoguePrompt(s) : s.prompt),
    slow,
  );
};
function speakExpected() {
  const s = currentLesson().steps[training.index];
  speak(s.accepted?.[0] || s.options?.[s.answer], true);
}
recognize = function () {
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!navigator.onLine)
    return notice(
      "Голосовой сервис браузера может требовать сеть. Используйте текст или готовый ответ.",
    );
  if (!Recognition)
    return notice("В этом браузере доступен текстовый ввод и выбор ответа.");
  if (!localStorage.getItem("lw-speech-consent")) {
    if (
      !confirm(
        "Браузер может отправлять речь своему провайдеру для распознавания. Продолжить?",
      )
    )
      return;
    localStorage.setItem("lw-speech-consent", "yes");
  }
  const rec = new Recognition();
  rec.lang = "en-US";
  rec.onresult = (e) => {
    if (!training) return;
    training.draft = e.results[0][0].transcript;
    persistTraining();
    render();
    notice("Речь распознана. Проверьте текст перед отправкой.");
  };
  rec.onerror = () =>
    notice("Речь не распознана. Повторите или введите ответ текстом.");
  rec.onend = () => {
    if ($("#speech-status"))
      $("#speech-status").textContent = "Запись завершена";
  };
  rec.start();
  if ($("#speech-status")) $("#speech-status").textContent = "Слушаю…";
};
const originalLessonResult = lessonResult;
lessonResult = function () {
  let result;
  try {
    result = JSON.parse(sessionStorage.getItem("tt-result-" + data.user.id));
  } catch {}
  result = result || ownAttempts().at(-1);
  if (!result) return learningShell(empty("Сначала пройдите урок"));
  if (result.pending)
    return learningShell(
      `${learningHeading("Урок сохранён", "Результат будет отправлен, когда появится сеть.")}${button("К маршруту", "go('map')")}`,
    );
  const l = data.lessons.find((l) => l.id === result.lesson_id),
    answers = JSON.parse(result.answers || "[]");
  return learningShell(
    razorTemplate("Learning.LessonResult.2", {
      value_0: learningHeading(
        "Ещё один шаг пройден",
        (result.passed ?? (result.score >= (l?.meta?.criteria?.pass_score || 80)))
          ? "Урок зачтён. Новые слова добавлены в ваш словарь."
          : "Повторите сложные фразы и попробуйте ещё раз.",
      ),
      value_1: "★".repeat(result.stars),
      value_2: "☆".repeat(3 - result.stars),
      result_score_3: result.score,
      value_4: button("Продолжить маршрут", "go('map')"),
      value_5: button(
        "Повторить урок",
        `startLesson(${result.lesson_id})`,
        true,
      ),
      value_6: table(
        ["Фраза", "Ваш ответ", "Результат"],
        answers
          .filter((a) => a.type !== "vocabulary")
          .map((a) => [
            esc(a.expected),
            esc(a.value),
            a.correct
              ? "✓ Верно"
              : a.status === "near"
                ? "≈ Почти верно"
                : "Повторить",
          ]),
      ),
      value_7: passportMarkup(),
    }),
  );
};
const originalShell = shell;
shell = function (body) {
  let out = originalShell(body);
  out = out.replace(
    '<header class="account-topbar">',
    razorTemplate("Shared._Shell.1", {}),
  );
  if (guest())
    out = out.replace(
      "</header>",
      razorTemplate("Shared.GuestBanner"),
    );
  return out;
};
const originalProfile = travelProfile;
travelProfile = function () {
  return originalProfile().replace(
    /<section class="account-card">(?:(?!<section)[\s\S])*?class="passport-list"(?:(?!<\/section>)[\s\S])*?<\/section>/,
    razorTemplate("Account.Profile.10", {
      value_0: metricsMarkup(),
      value_1: passportMarkup(),
    }),
  );
};
const originalLogin = login;
login = function () {
  return originalLogin().replace(
    "</form>",
    razorTemplate("Account.Login.2", {
      value_0: button("Попробовать без регистрации", "startGuest()", true),
    }),
  );
};
async function startGuest() {
  await action(async () => {
    await api("guest", {});
    await refresh();
    go("dashboard");
  });
}
const originalAPI = api;
api = async function (path, body) {
  if (["login", "register"].includes(path) && guest()) {
    await syncQueue();
    if (
      JSON.parse(localStorage.getItem("tt-queue-" + data.user.id) || "[]")
        .length
    )
      throw new Error("Сначала синхронизируйте гостевые результаты");
    body = {
      ...body,
      transfer_guest: true,
    };
  }
  return originalAPI(path, body);
};
function recentPhrases() {
  try {
    return JSON.parse(
      localStorage.getItem("lw-recent-" + (data.user?.id || "public")) || "[]",
    );
  } catch {
    return [];
  }
}
function rememberPhrase(id) {
  localStorage.setItem(
    "lw-recent-" + (data.user?.id || "public"),
    JSON.stringify(
      [id, ...recentPhrases().filter((x) => x !== id)].slice(0, 30),
    ),
  );
}
phrasebook = function () {
  let phrases = data.phrases.filter(
    (p) =>
      (!ui.category || p.category === ui.category) &&
      (!ui.favoriteOnly || data.favorites.includes(p.id)) &&
      (!learningState.recent || recentPhrases().includes(p.id)) &&
      `${p.en} ${p.ru}`.toLowerCase().includes(ui.search.toLowerCase()),
  );
  if (learningState.recent)
    phrases.sort(
      (a, b) => recentPhrases().indexOf(a.id) - recentPhrases().indexOf(b.id),
    );
  const body = razorTemplate("Phrasebook.Index.9", {
    value_0: learningHeading("Разговорник", "Нужные слова всегда под рукой"),
    ui_search_1: esc(ui.search),
    value_2: [...new Set(data.phrases.map((p) => p.category))]
      .map((c) =>
        razorTemplate("Phrasebook.Index.4", {
          value_0: ui.category === c ? "selected" : "",
          c_1: esc(c),
        }),
      )
      .join(""),
    value_3: !ui.favoriteOnly && !learningState.recent ? "active" : "",
    value_4: data.user
      ? razorTemplate("Phrasebook.Index.5", {
          value_0: ui.favoriteOnly ? "active" : "",
        })
      : "",
    value_5: learningState.recent ? "active" : "",
    value_6:
      phrases
        .map((p) =>
          razorTemplate("Phrasebook.Index.7", {
            p_category_0: esc(p.category),
            p_en_1: esc(p.en),
            value_2: p.ipa
              ? razorTemplate("Phrasebook.Index.6", {
                  p_ipa_0: esc(p.ipa),
                })
              : "",
            p_ru_3: esc(p.ru),
            value_4: button("Открыть", `go('phrase?id=${p.id}')`, true),
            value_5: data.user
              ? button(
                  data.favorites.includes(p.id) ? "★ Сохранено" : "☆ Сохранить",
                  `favorite(${p.id})`,
                  true,
                )
              : "",
          }),
        )
        .join("") || razorTemplate("Phrasebook.Index.8", {}),
  });
  return data.user ? shell(body) : publicShell(body);
};
phraseScreen = function () {
  const p = data.phrases.find((p) => p.id === idParam()) || data.phrases[0];
  if (!p) return learningShell(empty("Фраза не найдена"));
  rememberPhrase(p.id);
  const body = razorTemplate("Phrasebook.Phrase.3", {
    value_0: button("Разговорник", "go('phrasebook')", true),
    p_en_1: esc(p.en),
    value_2: p.ipa
      ? razorTemplate("Phrasebook.Phrase.2", {
          p_ipa_0: esc(p.ipa),
        })
      : "",
    p_ru_3: esc(p.ru),
    value_4: button("Озвучить", `speakPhrase(${p.id},false)`),
    value_5: button("Медленнее", `speakPhrase(${p.id},true)`, true),
    value_6: button("Показать собеседнику", "fullscreenPhrase()", true),
  });
  return data.user ? shell(body) : publicShell(body);
};
function reviewErrorsMarkup() {
  const errors = ownAttempts().flatMap((a) =>
    JSON.parse(a.answers || "[]")
      .filter((x) => !x.correct)
      .map((x) => ({
        ...x,
        lid: a.lesson_id,
      })),
  );
  if (!errors.length) return razorTemplate("Learning._Errors.1", {});
  return razorTemplate("Learning._Errors.3", {
    value_0: errors
      .map((e) =>
        razorTemplate("Learning._Errors.2", {
          value_0: esc(
            data.lessons.find((l) => l.id === e.lid)?.title || "Урок",
          ),
          e_prompt_1: esc(e.prompt),
          e_expected_2: esc(e.expected),
          value_3: button("Повторить урок", `startLesson(${e.lid})`, true),
        }),
      )
      .join(""),
  });
}
mistakes = function () {
  const words = data.vocabulary || [],
    due = words.filter((w) => w.due * 1000 <= Date.now()),
    favorites = data.reviews.filter((w) => w.due * 1000 <= Date.now());
  return learningShell(
    razorTemplate("Learning.Review.11", {
      value_0: learningHeading(
        "Слова и повторение",
        "Изученные слова повторяются через 2, 4, 8 дней и далее. Сложные — через 10 минут.",
      ),
      value_1: [
        ["", "Повторить"],
        ["allwords", "Мой словарь"],
        ["errors", "Работа над ошибками"],
      ]
        .map(([key, label]) =>
          razorTemplate("Learning.Review.3", {
            value_0: ui.tab === key ? "active" : "",
            key_1: key,
            label_2: label,
          }),
        )
        .join(""),
      value_2:
        ui.tab === "errors"
          ? reviewErrorsMarkup()
          : ui.tab === "allwords"
            ? razorTemplate("Learning.Review.6", {
                value_0: input("en", "Слово или фраза на английском"),
                value_1: input("ru", "Перевод"),
                value_2: input(
                  "ipa",
                  "Транскрипция (необязательно)",
                  "",
                  "text",
                  false,
                ),
                value_3:
                  words
                    .map((w) =>
                      razorTemplate("Learning.Review.5", {
                        w_en_0: esc(w.en),
                        w_ru_1: esc(w.ru),
                        value_2: w.ipa
                          ? razorTemplate("Learning.Review.4", {
                              w_ipa_0: esc(w.ipa),
                            })
                          : "",
                        value_3: w.due
                          ? new Date(w.due * 1000).toLocaleDateString("ru")
                          : "сегодня",
                        value_4: button(
                          "Озвучить",
                          `speakOwnWord(${w.id})`,
                          true,
                        ),
                        value_5: button(
                          "Удалить",
                          `removeOwnWord(${w.id})`,
                          true,
                        ),
                      }),
                    )
                    .join("") || empty("Пройдите урок или добавьте свою фразу"),
              })
            : razorTemplate("Learning.Review.10", {
                value_0: due.length + favorites.length,
                value_1: due
                  .map((w) =>
                    razorTemplate("Learning.Review.7", {
                      w_en_0: esc(w.en),
                      w_ru_1: esc(w.ru),
                      value_2: button("Помню", `reviewOwnWord(${w.id},true)`),
                      value_3: button(
                        "Повторить",
                        `reviewOwnWord(${w.id},false)`,
                        true,
                      ),
                    }),
                  )
                  .join(""),
                value_2: favorites
                  .map((r) => {
                    const p = data.phrases.find((p) => p.id === r.phrase_id);
                    if (!p) return "";
                    return razorTemplate("Learning.Review.8", {
                      p_en_0: esc(p.en),
                      p_ru_1: esc(p.ru),
                      value_2: button("Помню", `reviewPhrase(${p.id},true)`),
                      value_3: button(
                        "Повторить",
                        `reviewPhrase(${p.id},false)`,
                        true,
                      ),
                    });
                  })
                  .join(""),
                value_3:
                  !due.length && !favorites.length
                    ? razorTemplate("Learning.Review.9", {})
                    : "",
              }),
    }),
  );
};
async function saveOwnWord(form) {
  await mutate("vocabulary", payload(form), "Фраза добавлена в личный словарь");
}
async function removeOwnWord(id) {
  await mutate(
    "vocabulary",
    {
      id,
      remove: true,
    },
    "Фраза удалена из вашего словаря",
  );
}
async function reviewOwnWord(id, known) {
  await mutate(
    "vocabulary-review",
    {
      id,
      known,
    },
    known
      ? "Интервал повторения увеличен"
      : "Вернёмся к этой фразе через 10 минут",
  );
}
function speakOwnWord(id) {
  const w = data.vocabulary.find((w) => w.id === id);
  if (w) speak(w.en);
}

// Package downloads are committed only after the service worker acknowledges
// that the complete shell has been cached. No success message on partial failure.
downloadOffline = async function () {
  await action(async () => {
    const pkg = await api("package");
    if (!("serviceWorker" in navigator))
      throw new Error("Браузер не поддерживает автономное обучение");
    if (!("serviceWorker" in navigator) || !window.isSecureContext)
      throw new Error("Push требует HTTPS или localhost и поддержки Service Worker.");
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Сервис уведомлений не запустился. Обновите страницу и повторите.")), 15000)),
    ]);
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel(),
        timeout = setTimeout(
          () => reject(new Error("Не удалось сохранить оболочку сайта")),
          20000,
        );
      channel.port1.onmessage = (e) => {
        clearTimeout(timeout);
        e.data.ok
          ? resolve()
          : reject(new Error(e.data.error || "Ошибка сохранения"));
      };
      (reg.active || navigator.serviceWorker.controller).postMessage(
        {
          type: "CACHE",
        },
        [channel.port2],
      );
    });
    const snapshot = {
      ...data,
      ...pkg.content,
      package_id: pkg.id,
      csrf: "",
      users: [],
      audit: [],
    };
    try {
      localStorage.setItem(
        "tt-snapshot-" + data.user.id,
        JSON.stringify(snapshot),
      );
      localStorage.setItem(
        "lw-package",
        JSON.stringify({
          id: pkg.id,
          created: pkg.created,
        }),
      );
      localStorage.setItem("tt-offline", new Date().toISOString());
    } catch {
      throw new Error(
        "Не хватает места в браузере. Освободите хранилище и попробуйте снова.",
      );
    }
    render();
    notice(
      "Пакет версии " +
        pkg.id +
        " сохранён. Уроки и разговорник доступны без сети.",
    );
  });
};
const originalRefresh = refresh;
refresh = async function () {
  data = await api("bootstrap");
  if (data.user) {
    const key = "tt-snapshot-" + data.user.id;
    let previous;
    try {
      previous = JSON.parse(localStorage.getItem(key));
    } catch {}
    const snapshot = {
      ...data,
      csrf: "",
      users: [],
      audit: [],
    };
    if (previous?.package_id)
      Object.assign(snapshot, {
        package_id: previous.package_id,
        modules: previous.modules,
        lessons: previous.lessons,
        phrases: previous.phrases,
      });
    try {
      localStorage.setItem("tt-last-user", String(data.user.id));
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      notice(
        "Хранилище браузера заполнено. Онлайн-режим работает; офлайн-пакет не обновлён.",
      );
    }
  }
};
const originalSettings = accountSettings;
accountSettings = function () {
  return originalSettings()
    .replace(
      "Письма и push не отправляются.",
      "Уведомления сохраняются в колокольчике на сайте.",
    )
    .replace(
      "No emails or push notifications are sent.",
      "Notifications appear in the site's notification center.",
    )
    .replace(
      "</main>",
      razorTemplate("Account.Settings.5", {
        value_0: input(
          "reminder_time",
          "Напоминать в",
          profile().reminder_time || "19:00",
          "time",
        ),
        value_1: input(
          "quiet_start",
          "Тихие часы с",
          profile().quiet_start || "22:00",
          "time",
        ),
        value_2: input(
          "quiet_end",
          "Тихие часы до",
          profile().quiet_end || "08:00",
          "time",
        ),
        value_3: "",
        value_4:
          typeof speechSettingsMarkup === "function"
            ? speechSettingsMarkup()
            : "",
        value_5: button(
          "Добавить тест в колокольчик",
          "testBackgroundPush()",
          true,
        ),
      }),
    );
};
async function saveReminder(form) {
  await mutate(
    "profile",
    {
      profile: payload(form),
    },
    "Расписание сохранено",
  );
}
async function requestLearningNotifications() {
  await action(async () => {
    await api("profile", { profile: { notifications: true } });
    await refresh(); render();
    notice("Напоминания включены в колокольчике на сайте.");
  });
}
function offerNotifications() {}
function quietNow() {
  const t = new Date().toTimeString().slice(0, 5),
    start = profile().quiet_start || "22:00",
    end = profile().quiet_end || "08:00";
  return start < end ? t >= start && t < end : t >= start || t < end;
}
async function sendLearningReminder() {
  return; // Reminders are persisted by the inbox API.
  if (
    !data.user ||
    localStorage.getItem("lw-push-user") === String(data.user.id) ||
    profile().notifications === false ||
    quietNow() ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;
  const time = new Date().toTimeString().slice(0, 5),
    key = "lw-reminded-" + data.user.id;
  if (
    time < (profile().reminder_time || "19:00") ||
    localStorage.getItem(key) === localDay()
  )
    return;
  const reg = await navigator.serviceWorker?.ready;
  if (reg) {
    await reg.showNotification("LingWay · время для английского", {
      body: "Один короткий урок и повторение слов — ваш план на сегодня.",
      icon: "/icon.svg",
      tag: "learning-reminder",
      data: {
        url: "/#dashboard",
      },
    });
    localStorage.setItem(key, localDay());
  }
}
const originalNotificationItems = notificationItems;
notificationItems = function () {
  let items = originalNotificationItems();
  const due = (data.vocabulary || []).filter(
    (w) => w.due * 1000 <= Date.now(),
  ).length;
  if (due)
    items.unshift({
      icon: "book",
      title: "Повторите изученные слова",
      text: `${due} слов готовы к повторению`,
      href: "#mistakes",
    });
  const latest = data.packages?.[0];
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem("lw-package"));
  } catch {}
  if (saved && latest?.id > saved.id)
    items.push({
      icon: "download",
      title: "Доступно обновление курса",
      text: `Пакет версии ${latest.id}`,
      href: "#dashboard",
    });
  return items;
};
editorScreen = function () {
  if (!ui.editor) {
    const l = data.lessons.find((l) => l.id === idParam());
    if (l) ui.editor = structuredClone(l);
  }
  const l = ui.editor;
  if (!l)
    return learningShell(
      `${learningHeading("Редактор урока")}${button("Создать урок", "newLesson()")}`,
    );
  l.meta = l.meta || {};
  l.meta.vocabulary = l.meta.vocabulary || [];
  l.meta.criteria = l.meta.criteria || {
    pass_score: 80,
    near_threshold: 0.82,
  };
  const tab = ui.tab || "general";
  const editorTabs = [
    ["general", "Общие сведения"],
    ["steps", "Упражнения"],
    ["dialogue", "Диалог"],
    ["vocabulary", "Словарь"],
    ["criteria", "Критерии оценки"],
    ["preview", "Предпросмотр"],
    ["stats", "Статистика"],
  ];
  let body = "";
  if (tab === "general")
    body = razorTemplate("Management.Editor.15", {
      l_title_0: esc(l.title),
      l_description_1: esc(l.description),
      value_2: data.modules
        .map((m) =>
          razorTemplate("Management.Editor.13", {
            m_id_0: m.id,
            value_1: m.id === l.module_id ? "selected" : "",
            m_title_2: esc(m.title),
          }),
        )
        .join(""),
      value_3: ["A1", "A2", "B1"]
        .map((k) =>
          razorTemplate("Management.Editor.14", {
            value_0: l.level === k ? "selected" : "",
            k_1: k,
          }),
        )
        .join(""),
      value_4: l.published ? "checked" : "",
    });
  else if (["steps", "dialogue"].includes(tab))
    body =
      l.steps
        .map((s, i) => ({
          s,
          i,
        }))
        .filter(({ s }) => (s.type === "dialogue") === (tab === "dialogue"))
        .map(({ s, i }) =>
          razorTemplate("Management.Editor.22", {
            value_0: i + 1,
            value_1: i ? button("Выше", `moveStep(${i},-1)`, true) : "",
            value_2:
              i < l.steps.length - 1
                ? button("Ниже", `moveStep(${i},1)`, true)
                : "",
            value_3: button("Удалить", `deleteStep(${i})`, true),
            i_4: i,
            value_5: Object.entries(stepLabels)
              .map(([k, label]) =>
                razorTemplate("Management.Editor.16", {
                  k_0: k,
                  value_1: s.type === k ? "selected" : "",
                  label_2: label,
                }),
              )
              .join(""),
            i_6: i,
            s_prompt_7: esc(s.prompt),
            value_8: esc(s.translation || ""),
            i_9: i,
            value_10: esc(s.ipa || ""),
            i_11: i,
            value_12: ["choice", "listening", "situation"].includes(s.type)
              ? razorTemplate("Management.Editor.17", {
                  i_0: i,
                  value_1: esc((s.options || []).join("\n")),
                  value_2: (s.answer || 0) + 1,
                  i_3: i,
                })
              : razorTemplate("Management.Editor.18", {
                  i_0: i,
                  value_1: esc((s.accepted || []).join("\n")),
                }),
            value_13: esc(s.audio || ""),
            i_14: i,
            i_15: i,
            value_16: esc(
              (
                s.hints || [
                  s.translation || "",
                  s.hint || "",
                  s.accepted?.[0] || s.options?.[s.answer] || "",
                ]
              ).join("\n"),
            ),
            value_17:
              s.type === "dialogue"
                ? razorTemplate("Management.Editor.19", {
                    value_0: l.steps.length + 1,
                    i_1: i,
                    value_2: esc(
                      (s.routes || [])
                        .map((r) => r.answer + " | " + (r.target + 1))
                        .join("\n"),
                    ),
                    value_3: i + 2,
                    value_4: l.steps.length + 1,
                    value_5: (s.next ?? i + 1) + 1,
                    i_6: i,
                    i_7: i,
                    value_8: esc(
                      (s.branches || [])
                        .map((b) => b.previous + " | " + b.prompt)
                        .join("\n"),
                    ),
                  })
                : "",
            i_18: i,
            keywords: esc((s.keywords || []).join(", ")),
            value_19: s.image
              ? razorTemplate("Management.Editor.20", {
                  value_0: button(
                    "Убрать",
                    `changeStep(${i},'image','');render()`,
                    true,
                  ),
                })
              : "",
            i_20: i,
            value_21: s.audio_file
              ? razorTemplate("Management.Editor.21", {
                  value_0: button(
                    "Убрать",
                    `changeStep(${i},'audio_file','');render()`,
                    true,
                  ),
                })
              : "",
          }),
        )
        .join("") +
      button(
        tab === "dialogue" ? "Добавить реплику" : "Добавить упражнение",
        `addLearningStep('${tab === "dialogue" ? "dialogue" : "choice"}')`,
      );
  else if (tab === "vocabulary")
    body = razorTemplate("Management.Editor.24", {
      value_0: l.meta.vocabulary
        .map((w, i) =>
          razorTemplate("Management.Editor.23", {
            w_en_0: esc(w.en),
            i_1: i,
            w_ru_2: esc(w.ru),
            i_3: i,
            value_4: esc(w.ipa || ""),
            i_5: i,
            value_6: button(
              "Удалить слово",
              `ui.editor.meta.vocabulary.splice(${i},1);render()`,
              true,
            ),
          }),
        )
        .join(""),
      value_1: button(
        "Добавить слово",
        "ui.editor.meta.vocabulary.push({en:'',ru:'',ipa:''});render()",
        true,
      ),
    });
  else if (tab === "criteria")
    body = razorTemplate("Management.Editor.25", {
      l_meta_criteria_pass_score_0: l.meta.criteria.pass_score,
      l_meta_criteria_near_threshold_1: l.meta.criteria.near_threshold,
    });
  else if (tab === "preview")
    body = razorTemplate("Management.Editor.27", {
      value_0: l.steps
        .map((s, i) =>
          razorTemplate("Management.Editor.26", {
            value_0: i + 1,
            value_1: stepLabels[s.type],
            value_2: s.image ? sceneMarkup("", s.image) : "",
            s_prompt_3: esc(s.prompt),
            value_4: esc(s.translation || ""),
            value_5: esc(
              s.options?.[s.answer] || s.accepted?.join(" / ") || "",
            ),
          }),
        )
        .join(""),
    });
  else
    body = razorTemplate("Management.Editor.28", {
      value_0: table(
        ["Ученик", "Результат", "Дата"],
        data.attempts
          .filter((a) => a.lesson_id === l.id)
          .map((a) => [
            esc(data.users.find((u) => u.id === a.user_id)?.name || "Ученик"),
            a.score + "%",
            new Date(a.created).toLocaleString("ru"),
          ]),
      ),
    });
  return learningShell(
    razorTemplate("Management.Editor.29", {
      value_0: learningHeading(
        "Редактор урока",
        l.title,
        button("Сохранить урок", "saveLesson()"),
      ),
      value_1: tabs(editorTabs),
      body_2: body,
    }),
  );
};
function editDialogueRoutes(i, value) {
  ui.editor.steps[i].routes = value
    .split("\n")
    .filter((x) => x.trim())
    .map((line) => {
      const split = line.lastIndexOf("|");
      return {
        answer: line.slice(0, split).trim(),
        target: Number(line.slice(split + 1).trim()) - 1,
      };
    });
}
changeStepType = function (i, type) {
  const s = ui.editor.steps[i];
  s.type = type;
  if (["choice", "listening", "situation"].includes(type)) {
    s.options = s.options || ["Первый вариант", "Второй вариант"];
    s.answer = 0;
  } else {
    s.accepted = s.accepted || ["Example answer."];
    delete s.options;
    delete s.answer;
  }
  if (type === "order") delete s.tokens;
  render();
};
function addLearningStep(type) {
  ui.editor.steps.push(
    type === "dialogue"
      ? {
          type,
          prompt: "Your question?",
          accepted: ["My answer."],
          hints: ["", "", ""],
        }
      : defaultStep(),
  );
  render();
}
function editBranches(i, value) {
  ui.editor.steps[i].branches = value
    .split("\n")
    .filter((x) => x.includes("|"))
    .map((x) => {
      const [previous, ...rest] = x.split("|");
      return {
        previous: previous.trim(),
        prompt: rest.join("|").trim(),
      };
    });
}
async function loadStepMedia(index, key, input) {
  const file = input.files?.[0];
  if (!file) return;
  const allowed =
    key === "image"
      ? ["image/png", "image/jpeg", "image/webp"]
      : ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"];
  if (!allowed.includes(file.type) || file.size > 1200000) {
    input.value = "";
    return notice("Выберите поддерживаемый файл до 1.2 МБ");
  }
  await action(async () => {
    const value = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Не удалось прочитать файл"));
      r.readAsDataURL(file);
    });
    ui.editor.steps[index][key] = value;
    await api("media", {name:file.name,data_uri:value});
    render();
    notice("Файл сохранён в медиатеке и прикреплён. Сохраните урок.");
  });
}
const originalModulesScreen = modulesScreen;
modulesScreen = function () {
  let html = originalModulesScreen();
  const packs = data.packages || [];
  const content = razorTemplate("Management.Modules.3", {
    value_0: button("Опубликовать новый пакет", "publishPackage()"),
    value_1: table(
      ["Версия", "Дата", "Размер"],
      packs.map((p) => [
        p.id,
        new Date(p.created).toLocaleString("ru"),
        (p.bytes / 1024 / 1024).toFixed(2) + " МБ",
      ]),
    ),
  });
  return html.replace("</main>", content + "</main>");
};
async function publishPackage() {
  await mutate(
    "package-publish",
    {},
    "Новая версия учебного пакета опубликована",
  );
}
function importWizard(kind, groupId = null) {
  const state = learningState.import,
    checked = learningState.checked;
  return razorTemplate("Management._ImportWizard.4", {
    value_0: kind === "students" ? "Импорт учеников в группу" : "Импорт фраз",
    value_1:
      kind === "students"
        ? " Для существующих учеников достаточно почты. Для новых нужны имя, фамилия и пароль (от 10 символов). Передайте пароль ученику лично; после входа он сможет сменить его в настройках безопасности."
        : "",
    kind_2: kind,
    groupid_3: groupId,
    value_4:
      state && state.kind === kind
        ? razorTemplate("Management._ImportWizard.1", {
            value_0: (kind === "students"
              ? ["email", "first_name", "last_name", "password"]
              : ["en", "ru", "category", "ipa"]
            )
              .map((k) =>
                select(
                  k,
                  {
                    email: "Почта",
                    first_name: "Имя нового ученика",
                    last_name: "Фамилия нового ученика",
                    password: "Пароль нового ученика",
                    en: "Английская фраза",
                    ru: "Перевод",
                    category: "Категория",
                    ipa: "Транскрипция (необязательно)",
                  }[k],
                  [["", "Не выбран"], ...state.columns.map((c) => [c, c])],
                  state.columns.includes(k) ? k : "",
                ),
              )
              .join(""),
            value_1: table(
              state.columns.map(esc),
              state.rows
                .slice(0, 5)
                .map((r) =>
                  state.columns.map((c) =>
                    /password|пароль/i.test(c) ? "••••••••" : esc(r[c]),
                  ),
                ),
            ),
          })
        : "",
    value_5: checked
      ? razorTemplate("Management._ImportWizard.3", {
          checked_valid_0: checked.valid,
          checked_errors_length_1: checked.errors.length,
          value_2: checked.errors.length
            ? razorTemplate("Management._ImportWizard.2", {
                value_0: table(
                  ["Строка", "Причина"],
                  checked.errors.map((e) => [e.row, esc(e.error)]),
                ),
              })
            : "",
          value_3: checked.valid
            ? button(
                "Импортировать " + checked.valid + " строк",
                "commitLearningImport()",
              )
            : "",
        })
      : "",
  });
}
async function readLearningImport(input, kind, groupId) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5000000) return notice("Максимум 5 МБ");
  await action(async () => {
    const encoded = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(",")[1]);
      r.onerror = () => reject(new Error("Не удалось прочитать файл"));
      r.readAsDataURL(file);
    });
    const result = await api("table-preview", {
      name: file.name,
      file: encoded,
    });
    learningState.import = {
      ...result,
      kind,
      groupId,
    };
    learningState.checked = null;
    render();
  });
}
async function checkLearningImport(form) {
  await action(async () => {
    const state = learningState.import,
      mapping = payload(form),
      required =
        state.kind === "students" ? ["email"] : ["en", "ru", "category"];
    if (required.some((k) => !mapping[k]))
      throw new Error("Выберите обязательные столбцы");
    const selected = Object.values(mapping).filter(Boolean);
    if (new Set(selected).size !== selected.length)
      throw new Error("Для полей нужны разные столбцы");
    state.request = {
      kind: state.kind,
      group_id: state.groupId,
      rows: state.rows.map((r) =>
        Object.fromEntries(
          Object.entries(mapping).map(([k, c]) => [k, c ? r[c] : ""]),
        ),
      ),
    };
    learningState.checked = await api("import-check", state.request);
    render();
  });
}
async function commitLearningImport() {
  await action(async () => {
    const r = await api("import-commit", learningState.import.request);
    learningState.import = null;
    learningState.checked = null;
    await refresh();
    render();
    notice(`Добавлено: ${r.added}. Пропущено: ${r.errors.length}.`);
  });
}
const originalImportScreen = importScreen;
importScreen = function () {
  if (ui.tab !== "import") return originalImportScreen();
  return learningShell(
    `${learningHeading("Разговорник и импорт")}${tabs([
      ["phrases", "Фразы"],
      ["import", "Импорт"],
    ])}${importWizard("phrases")}`,
  );
};
const originalGroupScreen = groupScreen;
groupScreen = function () {
  const g = data.groups.find((g) => g.id === idParam()) || data.groups[0];
  let html = originalGroupScreen();
  if (g && ui.tab !== "assignments")
    html = html.replace(
      "</main>",
      razorTemplate("Management.Group.3", {
        value_0: importWizard("students", g.id),
      }),
    );
  return html;
};
editPhrase = function (id) {
  const p = data.phrases.find((p) => p.id === id);
  const dialog = document.createElement("dialog");
  dialog.className = "edit-dialog";
  dialog.innerHTML = razorTemplate("Phrasebook._EditDialog.2", {
    value_0: input("en", "Английский", p.en),
    value_1: input("ru", "Перевод", p.ru),
    value_2: input("ipa", "Транскрипция", p.ipa || "", "text", false),
    value_3: input("category", "Категория", p.category),
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
};
function reportRecords() {
  const f = learningState.report;
  return data.attempts.filter((a) => {
    const l = data.lessons.find((l) => l.id === a.lesson_id);
    return (
      l &&
      (admin() || data.members.some(m=>m.user_id===a.user_id && data.groups.some(g=>g.id===m.group_id))) &&
      (!f.group ||
        data.members.some(
          (m) => m.user_id === a.user_id && String(m.group_id) === f.group,
        )) &&
      (!f.student || String(a.user_id) === f.student) &&
      (!f.module || String(l.module_id) === f.module) &&
      (!f.level || l.level === f.level) &&
      (!f.from || a.created.slice(0, 10) >= f.from) &&
      (!f.to || a.created.slice(0, 10) <= f.to) &&
      (!f.due ||
        data.assignments.some(
          (x) =>
            x.module_id === l.module_id &&
            (!x.student_id || x.student_id === a.user_id) &&
            x.due &&
            x.due <= f.due &&
            data.members.some(
              (m) => m.user_id === a.user_id && m.group_id === x.group_id,
            ) &&
            (!f.group || String(x.group_id) === f.group),
        ))
    );
  });
}
const originalReportsScreen = reportsScreen;
reportsScreen = function () {
  const tab = route().params.get("tab") || ui.tab || "reports";
  if (tab !== "reports") return originalReportsScreen();
  const f = learningState.report,
    records = reportRecords(),
    hard = new Map();
  for (const a of records)
    for (const r of JSON.parse(a.answers || "[]"))
      if (r.type !== "vocabulary" && (!r.correct || (r.tries || 1) > 1 || r.hint)) {
        const key = r.expected;
        hard.set(key, (hard.get(key) || 0) + 1);
      }
  const control = (key, label, options) =>
    razorTemplate("Management.Reports.8", {
      label_0: label,
      key_1: key,
      value_2: options
        .map(([id, title]) =>
          razorTemplate("Management.Reports.7", {
            id_0: esc(id),
            value_1: String(id) === f[key] ? "selected" : "",
            title_2: esc(title),
          }),
        )
        .join(""),
    });
  return learningShell(
    razorTemplate("Management.Reports.11", {
      value_0: learningHeading(
        "Учебные отчёты",
        "Результаты, трудные фразы и выгрузка по выбранным условиям",
      ),
      value_1: admin() ? razorTemplate("Management.Reports.9", {}) : "",
      value_2: control(
        "group",
        "Группа",
        data.groups.map((g) => [g.id, g.name]),
      ),
      value_3: control(
        "student",
        "Ученик",
        data.users
          .filter((u) => u.role === "student")
          .map((u) => [u.id, u.name]),
      ),
      value_4: control(
        "module",
        "Модуль",
        data.modules.map((m) => [m.id, m.title]),
      ),
      value_5: control(
        "level",
        "Уровень",
        ["A1", "A2", "B1"].map((x) => [x, x]),
      ),
      value_6: [
        ["from", "Попытки с"],
        ["to", "Попытки до"],
        ["due", "Срок назначения до"],
      ]
        .map(([k, label]) =>
          razorTemplate("Management.Reports.10", {
            label_0: label,
            value_1: esc(f[k] || ""),
            k_2: k,
          }),
        )
        .join(""),
      value_7: button("Скачать XLSX", "exportReport('xlsx')"),
      value_8: button("Скачать CSV", "exportReport('csv')", true),
      value_9: button(
        "Сбросить фильтры",
        "learningState.report={};render()",
        true,
      ),
      records_length_10: records.length,
      value_11: records.length
        ? Math.round(records.reduce((n, a) => n + a.score, 0) / records.length)
        : 0,
      value_12: new Set(records.map((a) => a.user_id)).size,
      hard_size_13: hard.size,
      value_14: table(
        ["Фраза", "Ошибок"],
        [...hard]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([phrase, count]) => [esc(phrase), count]),
      ),
      value_15: table(
        ["Ученик", "Урок", "Результат", "Дата"],
        records.map((a) => [
          esc(data.users.find((u) => u.id === a.user_id)?.name || "Ученик"),
          esc(data.lessons.find((l) => l.id === a.lesson_id)?.title),
          a.score + "%",
          new Date(a.created).toLocaleDateString("ru"),
        ]),
      ),
    }),
  );
};
exportReport = async function (format) {
  await action(async () => {
    const q = new URLSearchParams({
      ...learningState.report,
      format,
    });
    const res = await fetch("/api/report?" + q, {
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error((await res.json()).error);
    downloadBlob(await res.blob(), "lingway-report." + format);
    notice("Отчёт скачан с выбранными фильтрами");
  });
};
Object.assign(views, {
  dashboard,
  map: mapScreen,
  module: moduleScreen,
  lesson: lessonScreen,
  exercise: exerciseScreen,
  dialogue: exerciseScreen,
  "lesson-result": lessonResult,
  phrasebook,
  phrase: phraseScreen,
  mistakes,
  profile: travelProfile,
  login,
  settings: accountSettings,
  editor: editorScreen,
  modules: modulesScreen,
  import: importScreen,
  group: groupScreen,
  reports: reportsScreen,
});
const learningRegistry = registry;
views.registry = function () {
  const level = ui.registryLevel || "",
    due = ui.registryDue || "",
    savedUsers = data.users,
    savedModules = data.modules;
  let html;
  try {
    if (level)
      data.modules = data.modules.filter((m) =>
        data.lessons.some((l) => l.module_id === m.id && l.level === level),
      );
    if (due)
      data.users = data.users.filter((u) =>
        data.assignments.some(
          (a) =>
            a.due &&
            (!a.student_id || a.student_id === u.id) &&
            a.due <= due &&
            data.modules.some((m) => m.id === a.module_id) &&
            data.members.some(
              (m) => m.user_id === u.id && m.group_id === a.group_id,
            ),
        ),
      );
    html = learningRegistry();
  } finally {
    data.users = savedUsers;
    data.modules = savedModules;
  }
  return html.replace(
    '<div class="filters">',
    razorTemplate("Shared._Helpers.2", {
      value_0: ["A1", "A2", "B1"]
        .map((l) =>
          razorTemplate("Shared._Helpers.1", {
            value_0: level === l ? "selected" : "",
            l_1: l,
          }),
        )
        .join(""),
      due_1: esc(due),
    }),
  );
};
const learningCourse = course;
views.course = () =>
  learningCourse()
    .replace(
      "Три модуля: аэропорт, отель и кафе.",
      "Семь модулей: от аэропорта до экстренных ситуаций.",
    )
    .replace(
      "Значение слова → аудирование → письменный ответ → диалог.",
      "Карточки слов, аудирование, диктант, сборка фраз, пропуски, голосовая практика и диалог из пяти реплик.",
    );
const learningLogout = logout;
logout = async function () {
  if (localStorage.getItem("lw-push-user") === String(data.user?.id)) {
    try {
      const reg = await navigator.serviceWorker.ready,
        sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("push-unsubscribe", {
          endpoint: sub.endpoint,
        });
        await sub.unsubscribe();
      }
    } catch {}
    localStorage.removeItem("lw-push-user");
  }
  await learningLogout();
};
window.addEventListener("pagehide", persistTraining);
document.addEventListener?.("visibilitychange", () => {
  if (training) {
    persistTraining();
    training.lastActive = Date.now();
  }
});
if (typeof setInterval === "function")
  setInterval(() => {
    sendLearningReminder().catch(() => {});
  }, 60000);
// Startup is performed by offline.js after IndexedDB storage is initialized.
