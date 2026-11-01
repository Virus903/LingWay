"use strict";
let progressTimer;
let progressSync = null;
function savedLessons() {
  if (!data.user) return {};
  try {
    const drafts = JSON.parse(localStorage.getItem('lw-progress-' + data.user.id) || '{}');
    const legacy = JSON.parse(localStorage.getItem('tt-training-' + data.user.id) || 'null');
    if (legacy && !drafts[legacy.lesson_id] && !data.attempts.some(a => a.id === legacy.id))
      drafts[legacy.lesson_id] = { ...legacy, savedAt: legacy.savedAt || legacy.lastActive || legacy.started || Date.now() };
    return drafts;
  }
  catch { return {}; }
}
function pendingLesson(id) {
  const drafts = Object.values(savedLessons()).filter(s =>
    (!id || s.lesson_id === id) && !data.attempts.some(a => a.id === s.id));
  return drafts.sort((a,b) => b.savedAt-a.savedAt)[0];
}
const saveTrainingLocally = persistTraining;
persistTraining = function () {
  saveTrainingLocally();
  if (!training || !data.user) return;
  training.savedAt = Date.now();
  const drafts = savedLessons();
  drafts[training.lesson_id] = structuredClone(training);
  localStorage.setItem('lw-progress-' + data.user.id, JSON.stringify(drafts));
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => syncLessonProgress().catch(() => {}), 400);
};
async function syncLessonProgress() {
  if (!data.user || !navigator.onLine) return;
  if (progressSync) return progressSync;
  const owner = data.user.id;
  progressSync = (async () => {
    const remote = await api('lesson-progress');
    if (data.user?.id !== owner) return;
    const drafts = savedLessons();
    for (const item of remote) {
      if (!drafts[item.lesson_id] || drafts[item.lesson_id].savedAt < item.savedAt)
        drafts[item.lesson_id] = item;
    }
    for (const key of Object.keys(drafts)) {
      if (data.attempts.some(a => a.id === drafts[key].id)) delete drafts[key];
    }
    localStorage.setItem('lw-progress-' + owner, JSON.stringify(drafts));
    for (const state of Object.values(drafts)) {
      if (data.user?.id !== owner) return;
      const { lesson, ...checkpoint } = state;
      const result = await api('lesson-progress', { owner_id: owner, state: checkpoint });
      if (result.completed) {
        const latest = savedLessons();
        if (latest[state.lesson_id]?.id === state.id) delete latest[state.lesson_id];
        localStorage.setItem('lw-progress-' + owner, JSON.stringify(latest));
      }
    }
  })().finally(() => { progressSync = null; });
  return progressSync;
}
const startNewLesson = startLesson;
startLesson = function (id) {
  const saved = pendingLesson(id);
  const lesson = data.lessons.find(l => l.id === id);
  if (saved && lesson && (saved.lesson || saved.version === lesson.version)) {
    training = structuredClone(saved);
    training.lesson ||= structuredClone(lesson);
    training.lastActive = Date.now();
    persistTraining();
    go('exercise');
    return;
  }
  startNewLesson(id);
};
function completeLessonDraft(lessonId, attemptId) {
  const drafts = savedLessons();
  if (drafts[lessonId]?.id === attemptId) delete drafts[lessonId];
  localStorage.setItem('lw-progress-' + data.user.id, JSON.stringify(drafts));
}
window.addEventListener('online', () => syncLessonProgress().catch(() => {}));
setInterval(() => syncLessonProgress().catch(() => {}), 15000);
