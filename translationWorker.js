// translationWorker.js

let translationCache = new Map();

self.onmessage = function (e) {
  const { action, texts, patterns, payload } = e.data;

  if (action === "init") {
    self.postMessage({ ready: true });
  }

  else if (action === "translate") {
    const translatedTexts = texts.map(text => {
      if (translationCache.has(text)) {
        return translationCache.get(text);
      }

      let result = text;
      for (const { pattern, replacement } of patterns || []) {
        result = result.replace(new RegExp(pattern, 'gi'), replacement);
      }

      translationCache.set(text, result);
      return result;
    });

    self.postMessage(translatedTexts);
  }
};
