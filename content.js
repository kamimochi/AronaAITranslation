// 定義全域 browser 物件，支援 Chrome 與 Firefox
if (typeof browser === 'undefined' || !browser) {
  var browser = chrome;
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

// Worker 初始化：使用 async/await 與 Promise 化 Worker 通訊
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
    const patterns = compiledPatterns.map(p => ({ pattern: p.pattern.source, replacement: p.replacement }));
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

// 收集文字節點
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

// 預編譯字典
function compileDictionary() {
  compiledPatterns = sortedDictionary.map(([koreanWord, chineseWord]) => {
    const pattern = new RegExp(escapeRegExp(koreanWord), 'gi');
    return { pattern, replacement: chineseWord };
  });
}

// 載入 JSON 檔案，使用 async/await 提升可讀性
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

// Debounce 工具函數
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// 其他功能保持不變
const skipSelector = ['script', 'style', 'input', 'select', 'textarea', '.no-translate'];

function translatePage() {
  if (!translationEnabled || isTranslating) return;
  isTranslating = true;
  translateTextNodesInElement(document.body, () => {
    isTranslating = false;
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

// MutationObserver 使用 debounce 包裝
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

// 接收來自 popup / background 的訊息
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

// 初始化：讀取 storage 設定與 JSON 檔案，同時初始化 Worker
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
