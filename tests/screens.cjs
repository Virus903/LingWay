const { chromium } = require("./playwright-runtime.cjs");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const credentials = fs.readFileSync(
  path.resolve(
    __dirname,
    process.env.LINGWAY_TEST_ACCOUNTS || "../tests/accounts.local.txt",
  ),
  "utf8",
);
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  let count = 0;
  const errors = [];
  try {
    for (const role of ["student", "teacher", "admin"]) {
      const context = await browser.newContext(),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto("http://localhost:5181/#login");
      await page.waitForFunction(() => !!data.csrf);
      const email = role + "@lingway.local",
        password = credentials.match(
          new RegExp(
            "Email: " +
              email.replaceAll(".", "\\.") +
              "\\s+Пароль: ([^\\r\\n]+)",
          ),
        )[1];
      await page.evaluate(
        async ({ email, password }) => {
          await api("login", { email, password });
          await refresh();
        },
        { email, password },
      );
      const routes = [
        "dashboard",
        "map",
        "phrasebook",
        "mistakes",
        "profile",
        "profile-edit",
        "account",
        "settings",
        ...(role === "student" ? [] : ["groups", "reports", "registry"]),
        ...(role === "admin" ? ["modules", "import"] : []),
      ];
      for (const theme of ["dark", "light"])
        for (const width of [360, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate((theme) => {
            data.user.profile = JSON.stringify({ ...profile(), theme });
          }, theme);
          for (const route of routes) {
            await page.evaluate((route) => {
              if (!views[route]) throw Error("Unknown route " + route);
              go(route);
              render();
            }, route);
            await page.waitForTimeout(30);
            assert.equal(
              await page
                .getByText("Не удалось открыть экран", { exact: true })
                .count(),
              0,
              role + " " + route,
            );
            assert.ok(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
              `${role} ${theme} ${width} ${route} overflow`,
            );
            count++;
          }
          if (width === 390 && role === "student") {
            await page.evaluate(() => go("profile"));
            await page.screenshot({
              path: path.join(
                __dirname,
                "TestResults",
                "profile-mobile-" + theme + ".png",
              ),
              fullPage: true,
            });
          }
        }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS: ${count} route/theme/viewport combinations; three roles; no overflow or JS errors.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
