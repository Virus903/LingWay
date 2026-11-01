const { chromium } = require("./playwright-runtime.cjs");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const shots = path.join(__dirname, "TestResults");
fs.mkdirSync(shots, { recursive: true });
(async () => {
  const base = process.env.LINGWAY_TEST_URL || "http://localhost:5181";
  const credentials = fs.readFileSync(
    path.resolve(
      __dirname,
      process.env.LINGWAY_TEST_ACCOUNTS || "../tests/accounts.local.txt",
    ),
    "utf8",
  );
  const adminPassword = credentials.match(
    /Email: admin@lingway\.local\s+Пароль: ([^\r\n]+)/,
  )[1];
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base + "/#login");
    await page
      .getByRole("button", { name: "Попробовать без регистрации" })
      .click();
    await page.waitForURL("**/#dashboard");
    await page
      .getByRole("heading", { name: "Мой день", exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(shots, "learning-dashboard-desktop.png"),
      fullPage: true,
    });
    await page.evaluate(() => go("map"));
    await page.getByRole("heading", { name: "Ваш маршрут" }).waitFor();
    assert.equal(await page.locator(".learning-card.locked").count(), 5);
    await page.evaluate(() =>
      startLesson(
        data.lessons.find((l) => l.module_id === data.modules[0].id).id,
      ),
    );
    let count = 0;
    while (await page.evaluate(() => !!training)) {
      const step = await page.evaluate(
        () => currentLesson().steps[training.index],
      );
      if (step.type === "order") {
        for (const token of step.tokens)
          await page
            .getByRole("button", { name: token, exact: true })
            .last()
            .click();
      } else if (step.options) {
        await page.locator(`input[name=value][value="${step.answer}"]`).check();
      } else if (step.type !== "vocabulary") {
        await page.locator("#f-value").fill(step.accepted[0]);
      }
      if (step.type === "dialogue" && count < 30) {
        await page
          .getByRole("button", { name: "Подсказка", exact: true })
          .click();
        await page.screenshot({
          path: path.join(shots, "learning-dialogue-desktop.png"),
          fullPage: true,
        });
      }
      await page
        .getByRole("button", {
          name: step.type === "vocabulary" ? "Запомнил, дальше" : "Проверить",
          exact: true,
        })
        .click();
      await page.locator(".learning-feedback").waitFor();
      const previousIndex = await page.evaluate(() => training.index);
      await page
        .getByRole("button", { name: /^(Продолжить|Завершить урок)$/ })
        .click();
      await page.waitForFunction(
        (i) => !training || training.index !== i,
        previousIndex,
      );
      count++;
      if (count > 60) throw new Error("Lesson did not finish");
    }
    await page.getByRole("heading", { name: "Ещё один шаг пройден" }).waitFor();
    assert.equal(await page.evaluate(() => ownAttempts().at(-1).score), 100);
    await page.evaluate(() => go("dashboard"));
    await page
      .getByRole("button", { name: "Загрузить пакет", exact: true })
      .click();
    await page.waitForFunction(() => !!localStorage.getItem("lw-package"));
    await context.setOffline(true);
    await page.reload();
    await page
      .getByRole("heading", { name: "Мой день", exact: true })
      .waitFor();
    await page.evaluate(() =>
      startLesson(
        data.lessons.find((l) => l.module_id === data.modules[0].id).id,
      ),
    );
    // Verify offline draft persistence with actual navigation and service worker.
    await page.getByRole("button", { name: "Запомнил, дальше" }).click();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    const index = await page.evaluate(() => training.index);
    await page.reload();
    await page.waitForFunction(() => training?.index === 1);
    assert.equal(await page.evaluate(() => training.index), index);
    const offlineId = await page.evaluate(() => training.id);
    while (await page.evaluate(() => !!training)) {
      const step = await page.evaluate(
        () => currentLesson().steps[training.index],
      );
      if (step.type === "order") {
        for (const token of step.tokens)
          await page
            .getByRole("button", { name: token, exact: true })
            .last()
            .click();
      } else if (step.options)
        await page.locator(`input[name=value][value="${step.answer}"]`).check();
      else if (step.type !== "vocabulary")
        await page
          .locator("#f-value")
          .fill(step.routes?.[1]?.answer || step.accepted[0]);
      await page
        .getByRole("button", {
          name: step.type === "vocabulary" ? "Запомнил, дальше" : "Проверить",
          exact: true,
        })
        .click();
      await page.locator(".learning-feedback").waitFor();
      const i = await page.evaluate(() => training.index);
      await page
        .getByRole("button", { name: /^(Продолжить|Завершить урок)$/ })
        .click();
      await page.waitForFunction((i) => !training || training.index !== i, i);
    }
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("tt-queue-" + data.user.id)).length,
      ),
      1,
    );
    await context.setOffline(false);
    await page.evaluate(async () => {
      await refresh();
      await syncQueue();
      go("map");
    });
    await page.waitForFunction(
      (id) => data.attempts.filter((a) => a.id === id).length === 1,
      offlineId,
    );
    for (const theme of ["dark", "light"]) {
      await page.evaluate((theme) => {
        data.user.profile = JSON.stringify({ ...profile(), theme });
        render();
      }, theme);
      await page.screenshot({
        path: path.join(shots, `learning-map-${theme}.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      for (const route of [
        "dashboard",
        "map",
        "phrasebook",
        "mistakes",
        "profile",
        "settings",
      ]) {
        await page.evaluate((route) => go(route), route);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Mobile overflow: ${theme} ${route}`,
        );
      }
      await page.screenshot({
        path: path.join(shots, `learning-settings-mobile-${theme}.png`),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await context.setOffline(false);
    await page.evaluate(async (password) => {
      await api("login", { email: "admin@lingway.local", password });
      await refresh();
      go("modules");
    }, adminPassword);
    for (const tab of [
      "general",
      "steps",
      "dialogue",
      "vocabulary",
      "criteria",
      "preview",
      "stats",
    ]) {
      await page.evaluate((tab) => {
        editLesson(data.lessons[0].id);
        ui.tab = tab;
        render();
      }, tab);
      assert.equal(
        await page
          .getByText("Не удалось открыть экран", { exact: true })
          .count(),
        0,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Editor mobile overflow: ${tab}`,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await page.evaluate(() => {
      go("reports");
    });
    await page.getByRole("heading", { name: "Учебные отчёты" }).waitFor();
    await page.screenshot({
      path: path.join(shots, "learning-reports-desktop.png"),
      fullPage: true,
    });
    await page.evaluate(() => {
      go("import");
      ui.tab = "import";
      render();
    });
    const importPhrase = "Browser import phrase " + Date.now();
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "phrases.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "en,ru,category\n" + importPhrase + ",Тест,Кафе\n,,\n",
        ),
      });
    await page.getByRole("button", { name: "Проверить строки" }).click();
    await page.getByText("Готово к импорту: 1 · ошибок: 1").waitFor();
    await page.getByRole("button", { name: "Импортировать 1 строк" }).click();
    await page.waitForFunction(
      (en) => data.phrases.some((p) => p.en === en),
      importPhrase,
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS: full ${count}-step lesson; guest; offline reload/draft; two themes; 390px layouts; seven editor tabs; validated CSV import; reports; no browser errors.`,
    );
  } finally {
    if (browser) await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
