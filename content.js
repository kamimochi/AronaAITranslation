// content.js

// 定義全域 browser 物件，支援 Chrome 與 Firefox
if (typeof browser === 'undefined' || !browser) {
  var browser = chrome;
}

// 如果目前網站為 arona.ai，則執行下列設定
if (window.location.hostname === "arona.ai") {
  // 插入 meta 標籤來停用 Google Translate
  var meta = document.createElement("meta");
  meta.name = "google";
  meta.content = "notranslate";
  document.head.appendChild(meta);

  // 讀取使用者設定，預設不關閉 alert
  chrome.storage.sync.get(["disableAlert"], function(result) {
    if (!result.disableAlert) {
      // 使用 i18n 取得警告訊息
      alert(chrome.i18n.getMessage("alertMessage"));
    }
  });
}

// 全域變數
let translationWorker = null;
let workerReady = false;
let data = {};
let isTranslating = false;
let translationEnabled = false;
let jsonLoaded = false;
let debugMode = false;
let currentLanguage = 'zh_tw'; // 預設繁體中文
let sortedDictionary = [];
let compiledPatterns = [];

// 初始化 Worker，使用 async/await 與 Blob URL 載入 Worker
async function initWorker() {
  if (typeof Worker === 'undefined') {
    console.error('This browser does not support Web Workers.');
    return;
  }
  try {
    const workerUrl = chrome.runtime.getURL('translationWorker.js');
    const response = await fetch(workerUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    const blobURL = URL.createObjectURL(blob);
    translationWorker = new Worker(blobURL);
    workerReady = true;
    console.log('Worker loaded successfully.');
  } catch (err) {
    console.error('Failed to load Worker script:', err);
  }
}

// Promise 化的 Worker 通訊
function sendTranslationRequest(texts, patterns) {
  return new Promise((resolve) => {
    const handler = function(e) {
      translationWorker.removeEventListener('message', handler);
      resolve(e.data);
    };
    translationWorker.addEventListener('message', handler);
    translationWorker.postMessage({ texts, patterns });
  });
}

function mergeAdjacentRubyNodes() {
  // 取得所有 <ruby> 節點
  const rubyNodes = document.querySelectorAll('ruby');
  const processed = new Set();
  
  rubyNodes.forEach(ruby => {
    if (processed.has(ruby)) return;
    
    // 初始化分組：至少包含目前這個 <ruby>
    let group = [ruby];
    let next = ruby.nextSibling;
    
    // 略過中間只包含空白的 Text Node
    while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") {
      next = next.nextSibling;
    }
    
    // 收集後續連續的 <ruby> 節點
    while (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === "RUBY") {
      group.push(next);
      processed.add(next);
      next = next.nextSibling;
      while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") {
        next = next.nextSibling;
      }
    }
    
    // 如果有兩個以上相鄰的 <ruby> 節點，嘗試合併文字比對字典
    if (group.length > 1) {
      // 合併各個 <ruby> 的文字，並以空白分隔（例："쇼쿠호 미사키"）
      let combinedText = group.map(node => node.textContent.trim()).join(" ");
      
      // 在排序後的字典中找出是否有完全匹配的長字串
      let translationEntry = sortedDictionary.find(([key, value]) => key === combinedText);
      if (translationEntry) {
        let translatedText = translationEntry[1];
        // 建立一個新的 <ruby> 節點以呈現翻譯結果
        let newNode = document.createElement('ruby');
        newNode.textContent = translatedText;
        // 將第一個 <ruby> 節點前插入新的節點，再移除原本的分組節點
        let firstRuby = group[0];
        firstRuby.parentNode.insertBefore(newNode, firstRuby);
        group.forEach(node => {
          if (node.parentNode && node.parentNode.contains(node)) {
            node.parentNode.removeChild(node);
          }
        });
      }
    }
  });
}

async function translateTextNodesInElement(node, callback) {
  const textNodes = [];
  collectTextNodes(node, textNodes);
  if (textNodes.length === 0) return callback();

  if (!workerReady) {
    console.warn('Worker not ready yet!');
    return callback();
  }

  const patterns = compiledPatterns.map(p => ({
    pattern: p.pattern.source,
    replacement: p.replacement
  }));
  
  // 向 Worker 请求翻译
  let translatedTexts;
  try {
    translatedTexts = await sendTranslationRequest(
      textNodes.map(n => n.textContent),
      patterns
    );
  } catch (err) {
    console.error('Translation error:', err);
    return callback();
  }

  // 用来在翻译后给「百分比粘连」补斜线
  const percentGapRe = /(\d+(?:\.\d+)?%)\s*(?=\d+(?:\.\d+)?%)/g;

  // 写回 DOM 时做后处理
  textNodes.forEach((node, i) => {
    let newText = translatedTexts[i];
    // 如果有「14%14.7%」这种，就改成「14%/14.7%」
    newText = newText.replace(percentGapRe, '$1/');
    if (newText !== node.textContent) {
      node.textContent = newText;
    }
  });

  callback();
}


// 收集文字節點（跳過部分元素）
function collectTextNodes(node, textNodes) {
  const numericSlashRe = /^[0-9.%\/]+$/;

  if (node.nodeType === Node.TEXT_NODE) {
    const trimmed = node.textContent.trim();
    // 非空，又不是全由數字 . % / 組成，才收進 textNodes
    if (trimmed.length > 0 && !numericSlashRe.test(trimmed)) {
      textNodes.push(node);
    }
    return;
  }
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    !skipSelector.some(selector => node.matches(selector))
  ) {
    node.childNodes.forEach(child => collectTextNodes(child, textNodes));
  }
}

// 預編譯字典，將 sortedDictionary 轉換為包含正則與替換值的結構
function compileDictionary() {
  compiledPatterns = sortedDictionary.map(([koreanWord, chineseWord]) => {
    const pattern = new RegExp(escapeRegExp(koreanWord), 'gi');
    return { pattern, replacement: chineseWord };
  });
}

// 載入 JSON 檔案並建立字典
async function loadLanguageFiles(language) {
  let folderPath = language === 'zh_tw' ? 'zh_TW-json/' : language === 'jpn' ? 'JPN-json/' : '';
  if (!folderPath) {
    console.warn(`No folder defined for language: ${language}`);
    return;
  }
  const files = [
    'dictionary.json', 'students_mapping.json', 'Event.json', 'Club.json', 'School.json',
    'CharacterSSRNew.json', 'FamilyName_mapping.json', 'Hobby_mapping.json', 'skill_name_mapping.json',
    'skill_Desc_mapping.json', 'furniture_name_mapping.json', 'furniture_Desc_mapping.json',
    'item_name_mapping.json', 'item_Desc_mapping.json', 'equipment_Desc_mapping.json',
    'equipment_name_mapping.json', 'stages_name_mapping.json', 'stages_Event_mapping.json',
    'ArmorType.json', 'TacticRole.json', 'ProfileIntroduction.json', 'WeaponNameMapping.json',
    'crafting.json'
  ];
  data = {};
  const promises = files.map(file => {
    const url = browser.runtime.getURL(folderPath + file);
    return fetch(url).then(res => res.json());
  });
  const results = await Promise.allSettled(promises);
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      Object.assign(data, result.value);
      console.log(`Loaded: ${files[index]}`);
    } else {
      console.error(`Error loading ${files[index]}:`, result.reason);
    }
  });
  sortedDictionary = Object.entries(data).sort(([keyA], [keyB]) => keyB.length - keyA.length);
  compileDictionary();
  jsonLoaded = true;
  if (translationEnabled) translatePage();
}

// 簡單 debounce 函式
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// 在 content.js 開頭，把 skipSelector 改成：
const skipSelector = [
  'script', 'style', 'input', 'select', 'textarea', '.no-translate',
  '.MuiSlider-markLabel',  // 跳過刻度文字
  '.MuiSlider-thumb',      // 跳過拖把
  '.MuiSlider-track',
  '.MuiSlider-rail'
];
// 這些元素不需要翻譯

function translatePage() {
  if (!translationEnabled || isTranslating) return;
  isTranslating = true;
  // 先檢查合併相鄰的 <ruby> 節點
  mergeAdjacentRubyNodes();
  mergeAdjacentSpanNodes();
  // 然後檢查合併相鄰的 <span> 節點
  translateTextNodesInElement(document.body, () => {
    isTranslating = false;
  });
}



function normalizeText(text) {
  let normalized = text
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
  normalized = normalized.replace(/\(([^)]+)\)/g, (_, inner) => {
    return "(" + inner.replace(/\s+/g, "") + ")";
  });
  return normalized;
}

function mergeAdjacentSpanNodes() {
  const spanNodes = Array.from(document.querySelectorAll('span'));
  const processed = new Set();
  const numericSlashRe = /^[0-9.%\/]+$/;

  spanNodes.forEach(span => {
    if (processed.has(span)) return;

    // 1) 收集一组相邻且非空白的 span
    let group = [];
    let curr = span;
    while (
      curr &&
      curr.nodeType === Node.ELEMENT_NODE &&
      curr.tagName === "SPAN"
    ) {
      const txt = curr.textContent.trim();
      if (txt) group.push(curr);
      processed.add(curr);
      curr = curr.nextSibling;
      while (
        curr &&
        curr.nodeType === Node.TEXT_NODE &&
        curr.textContent.trim() === ""
      ) {
        curr = curr.nextSibling;
      }
    }

    // 2) 如果只有一个，或全是数字，就不处理
    if (group.length < 2 || group.every(n => numericSlashRe.test(n.textContent.trim()))) {
      // 只要整个 group 里每个 span 文本都是数字、点、%或 /，
      // 就认定它是一个数值序列，原样保留，不要再合并到韩文里
      return;
    }

    // 3) 合并成一句韩文
    let merged = group.map(n => n.textContent).join("");
    merged = merged.replace(/\s+/g, " ").trim();

    // 4) 标准化后拿去字典里查
    const norm = normalizeText(merged);
    const noSlash = norm.replace(/\//g, "");
    const entry = sortedDictionary.find(([key]) => {
      const kNorm = normalizeText(key);
      return kNorm === norm || kNorm.replace(/\//g, "") === noSlash;
    });

    
    if (!entry) {
      return;
    }

  
    const newSpan = document.createElement("span");
    newSpan.textContent = merged;

    const first = group[0];
    first.parentNode.insertBefore(newSpan, first);
    group.forEach(n => {
      if (n.parentNode && n.parentNode.contains(n)) {
        n.parentNode.removeChild(n);
      }
    });
  });
}


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function printPageContent() {
  document.body.querySelectorAll('*:not(script):not(style)').forEach(element => {
    if (element.children.length === 0 && element.innerHTML.trim() !== '') {
      console.log("Debug: Element content:", element.innerHTML.trim());
    }
  });
}

const debouncedTranslate = debounce(translatePage, 100);
const observerConfig = { childList: true, subtree: true, characterData: true, characterDataOldValue: true };
const globalObserver = new MutationObserver(() => {
  if (!translationEnabled) return;
  if (debugMode) {
    console.log("Debug: DOM mutation observed. Printing updated page content.");
    printPageContent();
  }
  globalObserver.disconnect();
  debouncedTranslate();
  globalObserver.observe(document.body, observerConfig);
});
globalObserver.observe(document.body, observerConfig);

// 接收 popup / background 訊息
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enableTranslation') {
    browser.storage.sync.set({ translationEnabled: true }, () => {
      translationEnabled = true;
      if (jsonLoaded) translatePage();
    });
  } else if (request.action === 'disableTranslation') {
    browser.storage.sync.set({ translationEnabled: false }, () => {
      translationEnabled = false;
      location.reload();
    });
  } else if (request.action === 'toggleDebugMode') {
    browser.storage.sync.set({ debugMode: request.debugMode }, () => {
      debugMode = request.debugMode;
      console.log(debugMode ? "Debug Mode is ON." : "Debug Mode is OFF.");
      if (debugMode) printPageContent();
    });
  } else if (request.action === 'setLanguage') {
    currentLanguage = request.language;
    console.log(`Language switched to: ${currentLanguage}`);
    location.reload();
  }
});

// 初始化：讀取 storage 設定、載入 JSON 字典，並初始化 Worker
browser.storage.sync.get(["translationEnabled", "debugMode", "selectedLanguage"], (result) => {
  translationEnabled = !!result.translationEnabled;
  debugMode = !!result.debugMode;
  currentLanguage = result.selectedLanguage || 'zh_tw';
  loadLanguageFiles(currentLanguage);
  if (debugMode) console.log("Debug Mode is enabled.");
});

initWorker();
document.addEventListener('DOMContentLoaded', () => {
  if (jsonLoaded && translationEnabled) translatePage();
});

