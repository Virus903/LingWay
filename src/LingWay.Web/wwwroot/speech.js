/* On-device recognition is opt-in; never silently sends audio to a provider. */
let learningRecognition = null,
  practiceRecorder = null,
  practiceStream = null,
  practiceUrl = null,
  practiceBlob = null,
  recordingPending = false,
  speechEpoch = 0;
function speechMessage(text) {
  const el = document.querySelector("#speech-status");
  if (el) el.textContent = text;
  else notice(text);
}
function recognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}
async function prepareOfflineSpeech() {
  const R = recognitionClass();
  if (!R?.available || !R?.install)
    return notice(
      "Этот браузер не поддерживает установку автономного распознавания. Текстовый ввод и запись для самопроверки доступны.",
    );
  try {
    const status = await R.available({
      langs: ["en-US"],
      processLocally: true,
    });
    if (status === "available")
      return notice(
        "Английский языковой пакет установлен. Голосовой ввод работает локально.",
      );
    if (status === "unavailable")
      return notice(
        "Локальное распознавание английского недоступно в этом браузере.",
      );
    if (!navigator.onLine)
      return notice("Для первой загрузки языкового пакета нужен интернет.");
    if (
      !confirm(
        "Загрузить английскую модель распознавания средствами браузера? Загрузка может быть большой. После установки речь обрабатывается на устройстве.",
      )
    )
      return;
    notice("Браузер загружает языковой пакет…");
    const ok = await R.install({
      langs: ["en-US"],
    });
    notice(
      ok
        ? "Языковой пакет установлен."
        : "Браузер не смог установить языковой пакет.",
    );
  } catch {
    notice(
      "Установка недоступна. Проверьте настройки и поддержку локального распознавания браузером.",
    );
  }
}
recognize = async function () {
  if (learningRecognition) {
    learningRecognition.stop();
    return;
  }
  const R = recognitionClass();
  if (!R)
    return notice(
      "Голосовой ввод не поддерживается. Можно ввести текст или записать себя для сравнения.",
    );
  const session = training,
    index = training?.index,
    epoch = speechEpoch;
  let local = false;
  try {
    if (R.available)
      local =
        (await R.available({
          langs: ["en-US"],
          processLocally: true,
        })) === "available";
  } catch {}
  if (!local && !navigator.onLine)
    return speechMessage(
      "Для автономного голосового ввода сначала установите языковой пакет в настройках. Ответ можно ввести текстом.",
    );
  if (
    !local &&
    !confirm(
      "Локальная модель недоступна. Разрешить браузеру обработать речь через сервис распознавания? Аудио может передаваться поставщику браузера.",
    )
  )
    return;
  if (
    training !== session ||
    training?.index !== index ||
    speechEpoch !== epoch
  )
    return;
  const rec = new R();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  if (local) rec.processLocally = true;
  learningRecognition = rec;
  rec.onresult = (e) => {
    if (training !== session || training?.index !== index) return;
    const value = e.results[0][0].transcript;
    const field = document.querySelector("#f-value");
    if (field) field.value = value;
    training.draft = value;
    persistTraining();
    speechMessage(
      "Распознано: " +
        value +
        ". Проверьте текст перед отправкой. Это не оценка произношения.",
    );
  };
  rec.onerror = (e) =>
    speechMessage(
      {
        "not-allowed":
          "Доступ к микрофону запрещён. Разрешите его в настройках браузера.",
        "no-speech": "Речь не обнаружена. Попробуйте ещё раз.",
        network: "Сервис распознавания недоступен. Можно ввести текст.",
        "audio-capture": "Микрофон не найден.",
        "language-not-supported": "Английская локальная модель не установлена.",
      }[e.error] || "Не удалось распознать речь. Можно ввести текст.",
    );
  rec.onend = () => {
    if (learningRecognition === rec) learningRecognition = null;
  };
  try {
    rec.start();
    speechMessage(
      local
        ? "Слушаю · обработка на устройстве. Нажмите «Ответить голосом», чтобы остановить."
        : "Слушаю · сервис браузера. Нажмите ещё раз, чтобы остановить.",
    );
  } catch {
    learningRecognition = null;
    speechMessage("Не удалось включить микрофон.");
  }
};
function clearPracticeAudio() {
  practiceBlob = null;
  if (practiceUrl) {
    URL.revokeObjectURL(practiceUrl);
    practiceUrl = null;
  }
  practiceStream?.getTracks().forEach((t) => t.stop());
  practiceStream = null;
}
async function recordPractice() {
  if (recordingPending) return;
  if (practiceRecorder?.state === "recording") {
    practiceRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
    return speechMessage("Запись недоступна в этом браузере.");
  const session = training,
    index = training?.index,
    epoch = speechEpoch;
  recordingPending = true;
  try {
    clearPracticeAudio();
    practiceStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    if (
      training !== session ||
      training?.index !== index ||
      speechEpoch !== epoch
    ) {
      clearPracticeAudio();
      return;
    }
    const recorder = new MediaRecorder(practiceStream),
      chunks = [];
    practiceRecorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      practiceStream?.getTracks().forEach((t) => t.stop());
      practiceStream = null;
      if (
        training !== session ||
        training?.index !== index ||
        speechEpoch !== epoch
      )
        return;
      practiceBlob = new Blob(chunks, {
        type: recorder.mimeType,
      });
      practiceUrl = URL.createObjectURL(practiceBlob);
      const panel = document.querySelector("#practice-playback");
      if (panel) {
        panel.replaceChildren();
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = practiceUrl;
        audio.setAttribute("aria-label", "Ваша запись");
        panel.append(audio);
      }
      speechMessage(
        "Прослушайте запись и сравните с образцом: звуки, ударение и ритм. Запись хранится только в памяти этой вкладки, на сервер не отправляется.",
      );
    };
    recorder.start();
    speechMessage(
      "Запись · нажмите «Записать себя» ещё раз для остановки (до 30 секунд).",
    );
    setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 30000);
  } catch {
    clearPracticeAudio();
    speechMessage("Нет доступа к микрофону. Проверьте разрешения браузера.");
  } finally {
    recordingPending = false;
  }
}
function stopLearningAudio() {
  speechEpoch++;
  learningRecognition?.abort();
  learningRecognition = null;
  if (practiceRecorder?.state === "recording") practiceRecorder.stop();
  clearPracticeAudio();
}
window.addEventListener("hashchange", stopLearningAudio);
window.addEventListener("pagehide", stopLearningAudio);
async function testBackgroundPush() {
  await action(async () => {
    await api("notifications/test", {});
    await loadSiteNotifications();
    const el = document.querySelector("#push-test-status");
    if (el) el.textContent = "Уведомление добавлено в колокольчик справа вверху.";
    const panel = document.querySelector(".notification-panel");
    if (panel) panel.hidden = false;
    document.querySelector(".notification-button")?.setAttribute("aria-expanded", "true");
  });
}
function speechSettingsMarkup() {
  return razorTemplate("Account._SpeechSettings.1", {
    value_0: button(
      "Подготовить голосовой ввод без сети",
      "prepareOfflineSpeech()",
      true,
    ),
  });
}
async function wavForAssessment(blob) {
  const ctx = new AudioContext();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await ctx.close();
  }
  if (decoded.duration > 30.1)
    throw new Error("Для оценки запишите не более 30 секунд.");
  const length = Math.min(480000, Math.ceil(decoded.duration * 16000)),
    offline = new OfflineAudioContext(1, length, 16000),
    source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0),
    buffer = new ArrayBuffer(44 + length * 2),
    view = new DataView(buffer);
  const str = (o, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const n = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, n < 0 ? n * 32768 : n * 32767, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
async function assessRecordedPronunciation() {
  if (!practiceBlob)
    return speechMessage("Сначала запишите и остановите свою речь.");
  if (!navigator.onLine)
    return speechMessage(
      "Акустическая оценка требует подключения к сервису. Самопроверка записи работает без сети.",
    );
  const blob = practiceBlob,
    session = training,
    index = training.index;
  await action(async () => {
    const capabilities = await api("speech-capabilities");
    if (!capabilities.assessment)
      return speechMessage(
        "Акустическая оценка ещё не подключена: администратору нужен ключ Microsoft Azure Speech. Можно сравнить запись с образцом самостоятельно.",
      );
    if (
      !confirm(
        "Отправить эту запись в Microsoft Azure Speech для оценки произношения? Обработка выполняется внешним сервисом. LingWay не сохраняет аудио.",
      )
    )
      return;
    const audio = await wavForAssessment(blob);
    if (training !== session || training.index !== index) return;
    speechMessage("Оцениваем произношение…");
    const result = await api("pronunciation", {
      lesson_id: training.lesson_id,
      version: training.version,
      index,
      audio,
      consent: true,
    });
    if (training !== session || training.index !== index) return;
    const el = document.querySelector("#pronunciation-result");
    if (el)
      el.innerHTML = razorTemplate("Shared._AssessRecordedPronunciation.2", {
        result_provider_0: esc(result.provider),
        value_1: [
          ["AccuracyScore", "Точность звуков"],
          ["FluencyScore", "Плавность"],
          ["CompletenessScore", "Полнота"],
          ["PronScore", "Общий балл"],
        ]
          .map(([k, label]) =>
            razorTemplate("Shared._AssessRecordedPronunciation.1", {
              value_0: result.scores[k] ?? "—",
              label_1: label,
            }),
          )
          .join(""),
        value_2: result.words
          .map((w) => `${esc(w.word)}: ${w.accuracy ?? "—"}`)
          .join(" · "),
      });
    speechMessage("Оценка готова.");
  });
}
