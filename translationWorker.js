// 建立快取機制：儲存已翻譯的文字（原文 → 翻譯結果）
let translationCache = new Map();

self.onmessage = function (e) {
  const { texts, patterns } = e.data;
  
  const translatedTexts = texts.map(text => {
    // 如果快取中已有翻譯結果，直接回傳
    if (translationCache.has(text)) {
      return translationCache.get(text);
    }
    
    // 否則依序使用每個正則進行替換
    let result = text;
    for (const { pattern, replacement } of patterns) {
      result = result.replace(new RegExp(pattern, 'gi'), replacement);
    }
    
    // 快取翻譯結果
    translationCache.set(text, result);
    return result;
  });
  
  self.postMessage(translatedTexts);
};