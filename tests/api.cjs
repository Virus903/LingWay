const { request } = require("./playwright-runtime.cjs");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const baseURL = process.env.LINGWAY_TEST_URL || "http://localhost:5181";
if (!baseURL.includes(":5181"))
  throw Error("Use the isolated test server on port 5181");
const accounts = fs.readFileSync(
  path.resolve(
    __dirname,
    process.env.LINGWAY_TEST_ACCOUNTS || "../tests/accounts.local.txt",
  ),
  "utf8",
);
const contexts = [];
let count = 0;
async function client(role) {
  const ctx = await request.newContext({ baseURL });
  contexts.push(ctx);
  let state;
  const api = {
    ctx,
    async refresh() {
      const r = await ctx.get("/api/bootstrap");
      assert.equal(r.status(), 200, await r.text());
      state = await r.json();
      return state;
    },
    async post(route, data = {}, status = 200) {
      let r = await ctx.post("/api/" + route, {
        data,
        headers: { "X-CSRF-Token": state.csrf },
      });
      if (r.status() === 429 && status !== 429) {
        console.log('Rate limit respected; waiting for the next test window.');
        await new Promise(resolve => setTimeout(resolve, 61000));
        r = await ctx.post('/api/' + route, { data, headers: { 'X-CSRF-Token': state.csrf } });
      }
      assert.equal(
        r.status(),
        status,
        route + ": " + (r.ok() ? "ok" : await r.text()),
      );
      count++;
      return r.json();
    },
    get state() {
      return state;
    },
  };
  await api.refresh();
  if (role) {
    const email = role + "@lingway.local",
      password = accounts.match(
        new RegExp(
          "Email: " + email.replaceAll(".", "\\.") + "\\s+Пароль: ([^\\r\\n]+)",
        ),
      )[1];
    await api.post("login", { email, password });
    await api.refresh();
  }
  return api;
}
(async () => {
  try {
    const admin = await client("admin"),
      teacher = await client("teacher"),
      student = await client("student");
    assert.equal(admin.state.user.role, "admin");
    assert.equal(teacher.state.user.role, "teacher");
    assert.equal(student.state.user.role, "student");
    assert.equal(admin.state.modules.length, 7);
    assert.equal(admin.state.lessons.length, 21);
    assert.ok(admin.state.phrases.length >= 375);
    const csrf = await student.ctx.post("/api/profile", {
      data: { profile: { about: "should not save" } },
    });
    assert.equal(csrf.status(), 403);
    count++;
    await student.post(
      "role",
      { id: admin.state.user.id, role: "student" },
      403,
    );
    await teacher.post("package-publish", {}, 403);
    const group = await teacher.post("groups", {
      name: "C# integration " + Date.now(),
    });
    await teacher.post("members", {
      group_id: group.id,
      email: student.state.user.email,
    });
    await teacher.post("assignments", {
      group_id: group.id,
      module_id: admin.state.modules[0].id,
      due: "2027-01-15",
    });
    await student.post(
      "members",
      { group_id: group.id, email: admin.state.user.email },
      403,
    );
    await teacher.refresh();
    assert.ok(
      teacher.state.members.some((m) => m.user_id === student.state.user.id),
    );
    const avatar =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4FEAAAAASUVORK5CYII=";
    await student.post("profile", {
      name: "Тест Ученик",
      profile: {
        first_name: "Тест",
        last_name: "Ученик",
        avatar,
        theme: "dark",
        minutes: 20,
      },
    });
    await student.refresh();
    assert.equal(JSON.parse(student.state.user.profile).avatar, avatar);
    await student.post(
      "profile",
      { profile: { avatar: "https://evil.test/a.png" } },
      400,
    );
    await student.post("vocabulary", {
      en: "Integration " + Date.now(),
      ru: "Проверка",
      ipa: "test",
    });
    await student.refresh();
    const word = student.state.vocabulary.at(-1);
    await student.post("vocabulary-review", { id: word.id, known: true });
    const lesson = student.state.lessons[0];
    await student.post(
      "attempt",
      {
        id: crypto.randomUUID(),
        lesson_id: lesson.id,
        version: lesson.version,
        answers: [],
      },
      400,
    );
    const locked = student.state.lessons.find(
      (l) => l.module_id === student.state.modules.at(-2).id,
    );
    await student.post(
      "attempt",
      {
        id: crypto.randomUUID(),
        lesson_id: locked.id,
        version: locked.version,
        answers: [],
      },
      403,
    );
    const rows = [
      {
        en: "Import " + Date.now(),
        ru: "Импорт",
        category: "Тест",
        ipa: "test",
      },
      { en: "", ru: "", category: "" },
    ];
    const check = await admin.post("import-check", { kind: "phrases", rows });
    assert.equal(check.valid, 1);
    assert.equal(check.errors.length, 1);
    const commit = await admin.post("import-commit", { kind: "phrases", rows });
    assert.equal(commit.added, 1);
    const dup = await admin.post("import-check", { kind: "phrases", rows });
    assert.equal(dup.valid, 0);
    const importedEmail = "import-" + Date.now() + "@example.test";
    const studentRows = [
      {
        email: importedEmail,
        first_name: "Импорт",
        last_name: "Ученик",
        password: "ImportTest42!",
      },
      {
        email: importedEmail,
        first_name: "Дубликат",
        last_name: "Ученик",
        password: "ImportTest42!",
      },
    ];
    const studentsCheck = await teacher.post("import-check", {
      kind: "students",
      group_id: group.id,
      rows: studentRows,
    });
    assert.equal(studentsCheck.valid, 1);
    assert.equal(studentsCheck.errors.length, 1);
    assert.ok(!JSON.stringify(studentsCheck).includes("ImportTest42!"));
    const studentsImport = await teacher.post("import-commit", {
      kind: "students",
      group_id: group.id,
      rows: studentRows,
    });
    assert.equal(studentsImport.added, 1);
    for (const format of ["csv", "xlsx"]) {
      const report = await teacher.ctx.get(
        "/api/report?group=" + group.id + "&format=" + format,
      );
      assert.equal(report.status(), 200, await report.text());
      assert.ok((await report.body()).length > 100);
      count++;
    }
    const edit = structuredClone(admin.state.lessons[0]);
    await admin.post("lessons", edit);
    await admin.refresh();
    assert.equal(
      admin.state.lessons.find((l) => l.id === edit.id).version,
      edit.version + 1,
    );
    await admin.post("lessons", edit, 400);
    await admin.post("package-publish");
    const pkg = await admin.ctx.get("/api/package");
    assert.equal(pkg.status(), 200);
    assert.equal((await pkg.json()).content.lessons.length, 21);
    const guest = await client();
    await guest.post("guest");
    await guest.refresh();
    await guest.post("vocabulary", {
      en: "Guest transfer " + Date.now(),
      ru: "Перенос гостя",
    });
    const guestWord = (await guest.refresh()).vocabulary[0].en;
    const fullLesson = guest.state.lessons[0],
      answers = [];
    let index = 0;
    while (index < fullLesson.steps.length) {
      const s = fullLesson.steps[index],
        value = s.options ? String(s.answer) : s.accepted[0];
      answers.push({ step_index: index, value });
      index =
        s.routes?.find((r) => r.answer.toLowerCase() === value.toLowerCase())
          ?.target ??
        s.next ??
        index + 1;
    }
    const attempt = {
      id: crypto.randomUUID(),
      lesson_id: fullLesson.id,
      version: fullLesson.version,
      answers,
      duration: 600,
    };
    const duplicates = await Promise.all([
      guest.post("attempt", attempt),
      guest.post("attempt", attempt),
    ]);
    assert.equal(duplicates[0].id, duplicates[1].id);
    assert.equal(duplicates[0].score, 100);
    await guest.refresh();
    assert.equal(
      guest.state.attempts.filter((a) => a.id === attempt.id).length,
      1,
    );
    const email = "integration-" + Date.now() + "@example.test",
      password = "Integration42!";
    await guest.post("register", {
      email,
      password,
      first_name: "Новый",
      last_name: "Ученик",
      transfer_guest: true,
    });
    await guest.refresh();
    assert.ok(guest.state.vocabulary.some((v) => v.en === guestWord));
    const mailbox = fs.readFileSync(
      path.resolve(__dirname, "../src/LingWay.Web/App_Data/mailbox.txt"),
      "utf8",
    );
    const line = mailbox
      .split("\n")
      .filter((s) => s.includes(email + " | verify | "))
      .at(-1);
    const code = line.trim().split(" | ").at(-1);
    await guest.post("verify", { code });
    await guest.refresh();
    assert.equal(guest.state.user.verified, 1);
    await guest.post("verify", { code }, 400);
    await guest.post("password", { old: password, password: "Changed42!" });
    await guest.refresh();
    const wrong = await client();
    await wrong.post("login", { email, password }, 401);
    await wrong.post("login", { email, password: "Changed42!" });
    await wrong.refresh();
    await guest.post("logout-all");
    await wrong.refresh();
    assert.equal(wrong.state.user, null);
    await wrong.post("login", { email, password: "Changed42!" });
    await wrong.refresh();
    await wrong.post("delete-account", { password: "Changed42!" });
    await wrong.refresh();
    assert.equal(wrong.state.user, null);
    const speech = await student.ctx.get("/api/speech-capabilities");
    assert.equal(speech.status(), 200);
    assert.equal((await speech.json()).assessment, false);
    const push = await student.ctx.get("/api/push-key");
    assert.equal(push.status(), 200);
    assert.ok((await push.json()).publicKey.length > 20);
    await student.post(
      "push-subscribe",
      {
        subscription: {
          endpoint: "https://localhost/private",
          keys: { p256dh: "a".repeat(50), auth: "b".repeat(24) },
        },
      },
      400,
    );
    console.log(
      "PASS: " +
        count +
        " API checks; legacy logins; roles/CSRF; profile/avatar; groups; dictionary; versions; imports; exports; guest transfer; verification; password/session revocation; deletion.",
    );
  } finally {
    await Promise.all(contexts.map((c) => c.dispose()));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
