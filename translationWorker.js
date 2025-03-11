// translationWorker.js
self.onmessage = function (e) {
    const { texts, patterns } = e.data;
    const translatedTexts = texts.map(text => {
      let result = text;
      for (const { pattern, replacement } of patterns) {
        result = result.replace(new RegExp(pattern, 'gi'), replacement);
      }
      return result;
    });
    self.postMessage(translatedTexts);
  };