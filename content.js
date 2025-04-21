// content.js - 優化版本

if (typeof browser === 'undefined' || !browser) {
  var browser = chrome;
}

// 配置管理模塊
const Config = {
  defaults: {
    translationEnabled: false,
    debugMode: false,
    language: 'zh_tw',
    disableAlert: false,
    fuzzyMatchThreshold: 0.95
  },

  current: {},

  async load() {
    return new Promise(resolve => {
      browser.storage.sync.get(Object.keys(this.defaults), result => {
        this.current = { ...this.defaults, ...result };
        resolve(this.current);
      });
    });
  },

  async save(key, value) {
    return new Promise(resolve => {
      const data = {};
      data[key] = value;
      this.current[key] = value;
      browser.storage.sync.set(data, resolve);
    });
  }
};

// 字典與翻譯管理模塊
const Dictionary = {
  data: {},
  sortedEntries: [],
  compiledPatterns: [],

  async loadLanguage(language) {
    const cacheKey = `translationDict_${language}`;

    try {
      // 嘗試從 IndexedDB 讀取
      const cached = await this.getFromDB(cacheKey);
      if (cached) {
        this.data = cached;
      } else {
        await this.fetchDictionaryFiles(language);
        await this.saveToDB(cacheKey, this.data);
      }

      this.sortedEntries = Object.entries(this.data).sort(([a], [b]) => b.length - a.length);
      this.compileDictionary();
      return true;
    } catch (error) {
      console.error('Dictionary loading error:', error);
      return false;
    }
  },

  // 使用 IndexedDB 替代 localStorage
  async getFromDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('translation_cache', 1);
      request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('dictionaries')) {
          db.createObjectStore('dictionaries');
        }
      };

      request.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('dictionaries', 'readonly');
        const store = tx.objectStore('dictionaries');
        const getReq = store.get(key);

        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async saveToDB(key, value) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('translation_cache', 1);

      request.onsuccess = e => {
        const db = e.target.result;
        const tx = db.transaction('dictionaries', 'readwrite');
        const store = tx.objectStore('dictionaries');
        const putReq = store.put(value, key);

        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async fetchDictionaryFiles(language) {
    let folderPath = language === 'zh_tw' ? 'zh_TW-json/' :
      language === 'jpn' ? 'JPN-json/' : '';

    const files = [
      'dictionary.json', 'students_mapping.json', 'Event.json', 'Club.json', 'School.json',
      'CharacterSSRNew.json', 'FamilyName_mapping.json', 'Hobby_mapping.json', 'skill_name_mapping.json',
      'skill_Desc_mapping.json', 'furniture_name_mapping.json', 'furniture_Desc_mapping.json',
      'item_name_mapping.json', 'item_Desc_mapping.json', 'equipment_Desc_mapping.json',
      'equipment_name_mapping.json', 'stages_name_mapping.json', 'stages_Event_mapping.json',
      'ArmorType.json', 'TacticRole.json', 'ProfileIntroduction.json', 'WeaponNameMapping.json',
      'crafting.json'
    ];

    this.data = {};
    const results = await Promise.allSettled(files.map(file =>
      fetch(browser.runtime.getURL(folderPath + file))
        .then(r => r.ok ? r.json() : Promise.reject(`Failed to load ${file}`))
    ));

    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        Object.assign(this.data, res.value);
      } else if (Config.current.debugMode) {
        console.warn(`Failed to load ${files[i]}: ${res.reason}`);
      }
    });
  },

  compileDictionary() {
    this.compiledPatterns = this.sortedEntries.map(([koreanWord, chineseWord]) => {
      const pattern = new RegExp(this.escapeRegExp(koreanWord), 'gi');
      return { pattern, replacement: chineseWord };
    });
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  getFuzzyTranslation(text, threshold = Config.current.fuzzyMatchThreshold) {
    if (!text || text.length === 0) return null;

    let bestScore = 0, bestTrans = null;
    // 對長文本進行優化，僅與類似長度的條目比較
    const lengthThreshold = text.length * 0.3;

    for (const [key, val] of this.sortedEntries) {
      // 長度過濾，避免不必要的比較
      if (Math.abs(key.length - text.length) > lengthThreshold) continue;

      const score = this.similarity(text, key);
      if (score > bestScore) {
        bestScore = score;
        bestTrans = val;

        // 如果找到很好的匹配，提前退出
        if (score >= 0.98) break;
      }
    }

    return bestScore >= threshold ? bestTrans : null;
  },

  similarity(a, b) {
    if (!a.length && !b.length) return 1;
    const dist = this.levenshteinDistance(a, b);
    return 1 - dist / Math.max(a.length, b.length);
  },

  levenshteinDistance(a, b) {
    // 優化：使用較小的內存佔用
    const m = a.length, n = b.length;

    // 僅使用兩行來節省內存
    let previousRow = Array(n + 1).fill(0);
    let currentRow = Array(n + 1).fill(0);

    // 初始化第一行
    for (let j = 0; j <= n; j++) previousRow[j] = j;

    for (let i = 1; i <= m; i++) {
      currentRow[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        currentRow[j] = Math.min(
          previousRow[j] + 1,
          currentRow[j - 1] + 1,
          previousRow[j - 1] + cost
        );
      }
      // 交換行
      [previousRow, currentRow] = [currentRow, previousRow];
    }

    return previousRow[n];
  }
};

// 翻譯工作器管理
const WorkerManager = {
  worker: null,
  isReady: false,
  pendingRequests: new Map(),
  nextRequestId: 1,

  async init() {
    if (typeof Worker === 'undefined') return false;

    try {
      const workerUrl = browser.runtime.getURL('translationWorker.js');
      const response = await fetch(workerUrl);
      const blob = await response.blob();
      const blobURL = URL.createObjectURL(blob);

      this.worker = new Worker(blobURL);

      this.worker.onmessage = e => {
        if (e.data.ready) {
          this.isReady = true;
          return;
        }

        if (e.data.requestId && this.pendingRequests.has(e.data.requestId)) {
          const { resolve } = this.pendingRequests.get(e.data.requestId);
          this.pendingRequests.delete(e.data.requestId);
          resolve(e.data.result);
        }
      };

      this.worker.onerror = err => {
        console.error('Worker error:', err);
        // 嘗試重新初始化
        setTimeout(() => this.init(), 5000);
      };

      // 初始化 worker
      this.worker.postMessage({ action: "init" });

      // 等待 worker 準備就緒
      return new Promise(resolve => {
        const checkReady = setInterval(() => {
          if (this.isReady) {
            clearInterval(checkReady);
            resolve(true);
          }
        }, 100);
      });
    } catch (err) {
      console.error('Failed to load Worker:', err);
      return false;
    }
  },

  async sendTranslationRequest(texts) {
    if (!this.worker || !this.isReady) {
      return texts; // 如果 worker 不可用，返回原文
    }

    const requestId = this.nextRequestId++;

    return new Promise(resolve => {
      this.pendingRequests.set(requestId, { resolve });

      this.worker.postMessage({
        action: "translate",
        requestId,
        texts,
        patterns: Dictionary.compiledPatterns.map(p => ({
          pattern: p.pattern.source,
          replacement: p.replacement
        }))
      });
    });
  }
};

// DOM 翻譯模塊
const DOMTranslator = {
  isTranslating: false,
  observer: null,
  skipSelector: [
    'script', 'style', 'input', 'select', 'textarea', '.no-translate',
    '.MuiSlider-markLabel', '.MuiSlider-thumb', '.MuiSlider-track', '.MuiSlider-rail'
  ],

  init() {
    // 初始化 MutationObserver
    const observerConfig = { childList: true, subtree: true, characterData: true };
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.observer.observe(document.body, observerConfig);
  },

  handleMutations(mutations) {
    if (!Config.current.translationEnabled) return;

    // 分析變化，僅翻譯變化的部分而不是整個頁面
    const changedNodes = new Set();

    for (const mutation of mutations) {
      // 文本內容變化
      if (mutation.type === 'characterData') {
        changedNodes.add(mutation.target.parentNode || mutation.target);
      }
      // 節點添加或移除
      else if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            changedNodes.add(node);
          }
        });
      }
    }

    if (changedNodes.size > 0) {
      this.observer.disconnect();
      this.debouncedTranslate(Array.from(changedNodes));
    }
  },

  debouncedTranslate: debounce(async function (nodes) {

    await this.mergeAdjacentNodes();

    await this.translateNodes(nodes);
    this.observer.observe(
      document.body,
      { childList: true, subtree: true, characterData: true }
    );
  }, 100),

  async translatePage() {
    if (!Config.current.translationEnabled || this.isTranslating) return;

    this.isTranslating = true;
    this.observer.disconnect();

    try {
      // 智能節點合併
      await this.mergeAdjacentNodes();

      await new Promise(resolve => setTimeout(resolve, 0));

      // 翻譯整個文檔
      await this.translateNodes([document.body]);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      this.isTranslating = false;
      this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  },

  async translateNodes(nodes) {
    if (!Config.current.translationEnabled || !nodes.length) return;

    for (const node of nodes) {
      const textNodes = [];
      this.collectTextNodes(node, textNodes);

      if (!textNodes.length) continue;

      // 批量翻譯優化：分組處理，避免過大的消息
      const BATCH_SIZE = 100;
      for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
        const batch = textNodes.slice(i, i + BATCH_SIZE);
        const textsToTranslate = batch.map(n => n.textContent);

        try {
          const translatedTexts = await WorkerManager.sendTranslationRequest(textsToTranslate);

          batch.forEach((node, idx) => {
            const orig = node.textContent;
            let newText = translatedTexts[idx];

            // 處理特殊模式，如百分比之間的空格
            const percentGapRe = /(\d+(?:\.\d+)?%)\s*(?=\d+(?:\.\d+)?%)/g;
            newText = newText.replace(percentGapRe, '$1/');

            // 嘗試模糊匹配
            if (newText === orig) {
              const fuzzyMatch = Dictionary.getFuzzyTranslation(orig);
              if (fuzzyMatch) newText = fuzzyMatch;
            }

            if (newText !== orig) {
              if (Config.current.debugMode) {
                console.log(`[翻譯差異] 原文: ${orig}, 翻譯: ${newText}`);
              }
              node.textContent = newText;
            }
          });
        } catch (error) {
          console.error('Batch translation error:', error);
        }
      }
    }
  },

  collectTextNodes(node, textNodes) {
    const numericSlashRe = /^[0-9.%\/]+$/;

    // 收集文本節點
    if (node.nodeType === Node.TEXT_NODE) {
      const trimmed = node.textContent.trim();
      if (trimmed.length > 0 && !numericSlashRe.test(trimmed)) {
        textNodes.push(node);
      }
      return;
    }

    // 遞歸收集子節點
    if (node.nodeType === Node.ELEMENT_NODE &&
      !this.skipSelector.some(selector => node.matches && node.matches(selector))) {
      node.childNodes.forEach(child => this.collectTextNodes(child, textNodes));
    }
  },

  async mergeAdjacentNodes() {
    await Promise.all([
      this.mergeAdjacentRubyNodes(),
      this.mergeAdjacentSpanNodes()
    ]);
  },

  async mergeAdjacentRubyNodes() {
    const rubyNodes = Array.from(document.querySelectorAll('ruby'));
    const processed = new Set();

    for (const ruby of rubyNodes) {
      if (processed.has(ruby) || !ruby.isConnected) continue;

      const group = [ruby];
      let next = ruby.nextSibling;

      // 跳過空白文本節點
      while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") {
        next = next.nextSibling;
      }

      // 合併連續的 ruby 節點
      while (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === 'RUBY') {
        if (!next.isConnected) break;
        group.push(next);
        processed.add(next);
        next = next.nextSibling;

        // 再次跳過空白文本節點
        while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") {
          next = next.nextSibling;
        }
      }

      if (group.length > 1) {
        const combined = group.map(n => n.textContent.trim()).join(' ');
        const exact = Dictionary.sortedEntries.find(([k]) => k === combined);
        const translated = exact ? exact[1] : Dictionary.getFuzzyTranslation(combined);

        if (translated) {
          const newNode = document.createElement('ruby');
          newNode.textContent = translated;
          const first = group[0];

          if (first.parentNode && first.isConnected) {
            first.parentNode.insertBefore(newNode, first);
            group.forEach(n => {
              if (n.isConnected) {
                n.remove();
                processed.add(n);
              }
            });
          }
        }
      }
    }
  },

  async mergeAdjacentSpanNodes() {
    const spanNodes = Array.from(document.querySelectorAll('span'));
    const processed = new Set();
    const numericSlashRe = /^[0-9.%\/]+$/;

    for (const span of spanNodes) {
      if (processed.has(span) || !span.isConnected) continue;

      const group = [];
      let curr = span;

      while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName === "SPAN") {
        const txt = curr.textContent.trim();
        if (txt) group.push(curr);
        processed.add(curr);
        curr = curr.nextSibling;

        // 跳過空白文本節點
        while (curr && curr.nodeType === Node.TEXT_NODE && curr.textContent.trim() === "") {
          curr = curr.nextSibling;
        }
      }

      // 跳過僅有數字的 span 組
      if (group.length < 2 || group.every(n => numericSlashRe.test(n.textContent.trim()))) continue;

      const merged = group.map(n => n.textContent).join("").replace(/\s+/g, " ").trim();
      const exact = Dictionary.sortedEntries.find(([k]) => k === merged);
      const translated = exact ? exact[1] : Dictionary.getFuzzyTranslation(merged);

      if (translated) {
        const newSpan = document.createElement("span");
        newSpan.textContent = translated;
        const first = group[0];

        if (first.parentNode && first.isConnected) {
          first.parentNode.insertBefore(newSpan, first);
          group.forEach(n => {
            if (n.isConnected) {
              n.remove();
              processed.add(n);
            }
          });
        }
      }
    }
  }
};

// 網站特定處理
function handleAronaSite() {
  if (window.location.hostname === "arona.ai") {
    const meta = document.createElement("meta");
    meta.name = "google";
    meta.content = "notranslate";
    document.head.appendChild(meta);

    browser.storage.sync.get(["disableAlert"], function (result) {
      if (!result.disableAlert) {
        alert(browser.i18n.getMessage("alertMessage"));
      }
    });
  }
}

// 輔助函數
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

// 初始化和消息處理
async function initialize() {
  // 處理 arona.ai 站點特定邏輯
  handleAronaSite();

  // 載入配置
  await Config.load();

  // 初始化翻譯工作器
  await WorkerManager.init();

  // 載入字典
  await Dictionary.loadLanguage(Config.current.language);

  // 初始化 DOM 翻譯器
  DOMTranslator.init();

  // 如果啟用了翻譯，立即開始翻譯
  if (Config.current.translationEnabled) {
    DOMTranslator.translatePage();
  }

  // 註冊消息監聽器
  browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'enableTranslation') {
      await Config.save('translationEnabled', true);
      DOMTranslator.translatePage();
    }
    else if (request.action === 'disableTranslation') {
      await Config.save('translationEnabled', false);
      location.reload();
    }
    else if (request.action === 'toggleDebugMode') {
      await Config.save('debugMode', request.debugMode);
      console.log(Config.current.debugMode ? "Debug Mode is ON." : "Debug Mode is OFF.");
    }
    else if (request.action === 'setLanguage') {
      await Config.save('language', request.language);
      location.reload();
    }
  });

  // DOM 加載完成後檢查並翻譯
  document.addEventListener('DOMContentLoaded', () => {
    if (Config.current.translationEnabled) {
      DOMTranslator.translatePage();
    }
  });
}

// 啟動初始化
initialize();