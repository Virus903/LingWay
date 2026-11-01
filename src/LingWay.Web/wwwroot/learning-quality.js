"use strict";

async function chooseLibraryMedia(index, key) {
  await action(async () => {
    const files = (await api("media")).filter(f => f.type.startsWith(key === "image" ? "image/" : "audio/"));
    const host = document.createElement("div");
    host.innerHTML = razorTemplate("Management.MediaLibrary", {});
    const dialog = host.firstElementChild;
    document.body.append(dialog);
    const list = dialog.querySelector("#media-items"), search = dialog.querySelector("#media-search");
    function show() {
      list.replaceChildren();
      const matches = files.filter(f => f.name.toLowerCase().includes(search.value.toLowerCase()));
      if (!matches.length) list.textContent = "Файлы не найдены. Загрузите файл в редакторе задания.";
      for (const file of matches) {
        const row = document.createElement("button");
        row.type = "button"; row.className = "btn secondary";
        row.style.cssText = "display:block;margin:12px 0;max-width:100%;overflow-wrap:anywhere";
        row.textContent = `${file.name} · ${Math.ceil(file.bytes / 1024)} КБ`;
        row.onclick = () => action(async () => {
          const content = await api("media/" + file.id);
          ui.editor.steps[index][key] = content.data_uri;
          dialog.close(); render(); notice("Файл выбран. Сохраните урок.");
        });
        list.append(row);
      }
    }
    search.oninput = show;
    dialog.addEventListener("close", () => dialog.remove());
    show(); dialog.showModal();
  });
}

function assignmentsFor(uid, mid) {
  const groups = data.members.filter(m => m.user_id === uid).map(m => m.group_id);
  return data.assignments.filter(a => a.module_id === mid && groups.includes(a.group_id)
    && (!a.student_id || a.student_id === uid));
}

statusFor = function (uid, mid) {
  if (moduleProgress(mid, uid) === 100) return "Пройден";
  const lessons = data.lessons.filter(l => l.module_id === mid && l.published);
  const unresolved = lessons.some(l => {
    if (lessonPassed(l, uid)) return false;
    const latest = data.attempts.filter(a => a.user_id === uid && a.lesson_id === l.id)
      .sort((a,b) => new Date(b.created) - new Date(a.created))[0];
    return !!latest && !(latest.passed ?? (latest.score >= (l.meta?.criteria?.pass_score || 80)));
  });
  if (unresolved) return "Нужно повторить";
  if ((data.lesson_progress || []).some(p => p.user_id === uid && lessons.some(l => l.id === p.lesson_id))
    || data.attempts.some(a => a.user_id === uid && lessons.some(l => l.id === a.lesson_id))) return "В процессе";
  return assignmentsFor(uid, mid).length ? "Назначен" : "Не назначен";
};

function assignmentOverdue(uid, mid) {
  return moduleProgress(mid, uid) !== 100 && assignmentsFor(uid, mid).some(a => a.due && a.due < localDay());
}

function tripPreparationPlan() {
  const remaining = data.lessons.filter(l => l.published && !lessonPassed(l));
  const daily = Number(profile().minutes) || 15;
  let minutes = 0;
  for (const lesson of remaining) {
    const draft = pendingLesson(lesson.id);
    const fraction = draft ? Math.min(.95, draft.answers.length / Math.max(1, lesson.steps.length)) : 0;
    minutes += (Number(lesson.meta?.minutes) || 12) * (1 - fraction);
  }
  minutes = Math.ceil(minutes);
  const trip = profile().trip_date;
  const today = new Date(localDay() + "T00:00:00");
  const days = trip ? Math.max(0, Math.round((new Date(trip + "T00:00:00") - today) / 86400000)) : null;
  const studyDaily = Math.max(1, daily - Math.min(5, Math.floor(daily / 3)));
  const required = Math.ceil(minutes / studyDaily);
  return {minutes, days, required, remaining: remaining.length, daily, studyDaily};
}

const dashboardWithoutPlan = dashboard;
dashboard = function () {
  const plan = tripPreparationPlan();
  const card = razorTemplate("Learning.TripPlan", {
    summary: `Осталось ${plan.remaining} уроков · ориентировочно ${plan.minutes} минут, с учётом незавершённых заданий.`,
    capacity: plan.days === null ? `При ${plan.daily} минутах в день потребуется примерно ${plan.required} учебных дней.`
      : plan.required <= plan.days ? `До поездки ${plan.days} дней. План укладывается в ${plan.daily} минут в день, включая повторение.`
      : `До поездки ${plan.days} дней; для всего маршрута нужно около ${plan.required} учебных дней. Сначала завершите начатый урок и изучите экстренные фразы.`,
    note: "Это оценка нагрузки, не измеренная длительность. Время повторения зарезервировано отдельно. Урок можно продолжить завтра с сохранённого шага.",
  });
  return dashboardWithoutPlan().replace('<div class="learning-hero">', card + '<div class="learning-hero">');
};
views.dashboard = dashboard;

const modulesWithoutQuality = views.modules;
views.modules = function () {
  const html = modulesWithoutQuality();
  return admin() ? html.replace("</main>", razorTemplate("Management.QualityReport", {}) + "</main>") : html;
};
async function loadQualityReport() {
  await action(async () => {
    const report = await api("learning-quality");
    document.querySelector("#quality-results").innerHTML = table(
      ["Урок", "Проверка", "Замеров", "Медиана, мин", "В пределах 10–15 мин"],
      report.lessons.map(l => [esc(l.title),esc(l.validation),l.samples,l.median_minutes == null ? "Нет данных" : l.median_minutes.toFixed(1),l.within_target]),
    );
  });
}

// Count visible, recently active study time; never count a background tab or a long break.
let activityAt = Date.now();
for (const event of ["pointerdown", "keydown", "input"]) document.addEventListener(event, () => { activityAt = Date.now(); }, {passive:true});
setInterval(() => {
  if (!training) return;
  if (!/^#(exercise|dialogue)([?]|$)/.test(location.hash) || document.visibilityState !== "visible" || Date.now() - activityAt > 60000) {
    training.lastActive = Date.now();
    return;
  }
  persistTraining();
}, 10000);
document.addEventListener("visibilitychange", () => {
  if (training) training.lastActive = Date.now();
});
