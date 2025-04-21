// translationWorker.js - 優化版本

// 使用 LRU 快取來限制內存使用
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
    this.queue = [];
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined;
    
    // 更新使用頻率，將項移到隊列末尾
    this.queue = this.queue.filter(k => k !== key);
    this.queue.push(key);
    
    return this.cache.get(key);
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      // 更新現有項
      this.queue = this.queue.filter(k => k !== key);
    } else if (this.queue.length >= this.capacity) {
      // 移除最不常用項
      const oldestKey = this.queue.shift();
      this.cache.delete(oldestKey);
    }
    
    // 添加新項
    this.cache.set(key, value);
    this.queue.push(key);
  }
  
  clear() {
    this.cache.clear();
    this.queue = [];
  }
  
  size() {
    return this.cache.size;
  }
}

// 使用 LRU 快取替代無限增長的 Map
const translationCache = new LRUCache(10000); // 保存最多 10000 個條目

// 翻譯字符串時使用的正則表達式緩存
const patternCache = new Map();

// 批量處理文本的翻譯
function batchTranslate(texts, patterns) {
  return texts.map(text => translateText(text, patterns));
}

// 翻譯單個文本
function translateText(text, patterns) {
  // 檢查快取
  const cacheKey = text;
  const cached = translationCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  
  let result = text;
  
  // 應用所有模式
  for (const { pattern, replacement } of patterns || []) {
    // 從緩存獲取編譯後的正則表達式
    let compiledPattern = patternCache.get(pattern);
    if (!compiledPattern) {
      compiledPattern = new RegExp(pattern, 'gi');
      patternCache.set(pattern, compiledPattern);
    }
    
    // 替換文本
    result = result.replace(compiledPattern, replacement);
  }
  
  // 更新快取
  translationCache.set(cacheKey, result);
  return result;
}

// 工作器內存監控 - 避免內存洩漏
function monitorMemory() {
  try {
    // 檢查快取大小
    if (translationCache.size() > 8000) { // 如果接近容量上限
      console.log(`[Memory] Cache near capacity: ${translationCache.size()} items`);
    }
    
    // 定期監控
    setTimeout(monitorMemory, 60000); // 每分鐘檢查
  } catch (e) {
    console.error('Memory monitoring error:', e);
  }
}

// 初始化並啟動記憶體監控
monitorMemory();

// 設置消息處理器
self.onmessage = function(e) {
  try {
    const { action, texts, patterns, requestId } = e.data;
    
    if (action === "init") {
      self.postMessage({ ready: true });
    }
    else if (action === "translate") {
      // 批量處理翻譯
      const result = batchTranslate(texts, patterns);
      
      // 返回結果並包含請求 ID
      self.postMessage({ requestId, result });
    }
    else if (action === "clearCache") {
      translationCache.clear();
      patternCache.clear();
      self.postMessage({ requestId, result: "Cache cleared" });
    }
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ 
      requestId: e.data.requestId, 
      error: error.message || "Unknown error"
    });
  }
};

// 通知已準備就緒
self.postMessage({ ready: true });