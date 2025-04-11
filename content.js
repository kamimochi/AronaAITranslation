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
          node.parentNode.removeChild(node);
        });
      }
    }
  });
}


// 使用 async/await 改寫翻譯函數
async function translateTextNodesInElement(node, callback) {
  const textNodes = [];
  collectTextNodes(node, textNodes);
  if (textNodes.length > 0) {
    if (!workerReady) {
      console.warn('Worker not ready yet!');
      return callback();
    }
    const texts = textNodes.map(n => n.textContent);
    // 傳送給 Worker 的 patterns 改成包含 { pattern, replacement } 物件
    const patterns = compiledPatterns.map(p => ({
      pattern: p.pattern.source,
      replacement: p.replacement
    }));
    try {
      const translatedTexts = await sendTranslationRequest(texts, patterns);
      textNodes.forEach((node, index) => {
        if (translatedTexts[index] !== node.textContent) {
          node.textContent = translatedTexts[index];
        }
      });
    } catch (err) {
      console.error('Translation error:', err);
    }
    callback();
  } else {
    callback();
  }
}

// 收集文字節點（跳過部分元素）
function collectTextNodes(node, textNodes) {
  if (node.nodeType === Node.TEXT_NODE) {
    const trimmed = node.textContent.trim();
    if (trimmed.length > 0) textNodes.push(node);
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE && !skipSelector.some(selector => node.matches(selector))) {
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

const skipSelector = ['script', 'style', 'input', 'select', 'textarea', '.no-translate'];

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

// 定義 normalization 函式，標準化空白與斜線格式
// 定義 normalization 函式，標準化空白、斜線以及括號內的空白
function normalizeText(text) {
  // 先合併所有空白為單一空格，並統一斜線周圍的空白
  let normalized = text
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
  // 對括號內的文字作進一步處理，將括號內所有空白移除
  normalized = normalized.replace(/\(([^)]+)\)/g, (match, inner) => {
    return "(" + inner.replace(/\s+/g, "") + ")";
  });
  return normalized;
}

function mergeAdjacentSpanNodes() {
  // 將所有 <span> 節點轉成陣列
  const spanNodes = Array.from(document.querySelectorAll('span'));
  const processed = new Set();

  spanNodes.forEach(span => {
    if (processed.has(span)) return;

    let group = [];
    let current = span;
    // 收集連續的 <span> 節點（略過空白節點）
    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName === "SPAN") {
      if (current.textContent.trim() !== "") {
        group.push(current);
      }
      processed.add(current);
      current = current.nextSibling;
      while (current && current.nodeType === Node.TEXT_NODE && current.textContent.trim() === "") {
        current = current.nextSibling;
      }
    }

    if (group.length > 1) {
      // 輸出調試資訊，查看每個 <span> 的原始文字
      console.log("Merging the following spans:");
      group.forEach(node => console.log(`[${node.textContent.trim()}]`));

      // 合併所有節點的文字，中間用單一空格隔開，並標準化空白
      let combinedText = group.map(node => node.textContent.trim()).join(" ");
      combinedText = combinedText.replace(/\s+/g, " ");
      
      // 正規化合併後的文字（例如將 "대미지 대상이" 轉為 "대미지/대상이"）
      let normalizedCombined = normalizeText(combinedText);
      console.log("Normalized combined text after merge:", normalizedCombined);

      // 用正規化後的文本與字典中的條目作比對
      let translationEntry = sortedDictionary.find(([key]) => normalizeText(key) === normalizedCombined);
      if (translationEntry) {
        let translatedText = translationEntry[1];
        console.log("Found translation entry:", translatedText);

        // 建立新 <span>，置入翻譯結果，並替換原有群組
        let newSpan = document.createElement('span');
        newSpan.textContent = translatedText;

        let firstSpan = group[0];
        firstSpan.parentNode.insertBefore(newSpan, firstSpan);
        group.forEach(node => {
          node.parentNode.removeChild(node);
        });
      } else {
        console.log("No translation entry found for normalized combined text:", normalizedCombined);
      }
    }
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
