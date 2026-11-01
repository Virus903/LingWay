// Markup lives in Views/Screens/*.cshtml. These inert templates are included
// by Razor once and cached with the application for offline navigation.
const screenTemplateCache = new Map();

function razorTemplate(id, bindings = {}) {
  if (!screenTemplateCache.has(id)) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Не найден шаблон страницы: ${id}`);
    screenTemplateCache.set(id, element.textContent.trim());
  }

  // Values are escaped by the existing view-model functions where needed.
  // Replace in one pass: user content is never evaluated as template code.
  return screenTemplateCache
    .get(id)
    .replace(/\{\{([a-z0-9_]+)\}\}/g, (_, name) => {
      if (!Object.prototype.hasOwnProperty.call(bindings, name)) {
        throw new Error(`Не передано значение ${name} для ${id}`);
      }
      return String(bindings[name] ?? "");
    });
}
