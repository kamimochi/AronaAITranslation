/**
 * 先定義一個全域的 browser 物件以支援 Chrome 與 Firefox。
 * 若在 Firefox，window.browser 通常已存在；
 * 若在 Chrome，就把 window.browser 設定為 chrome。
 */
if (typeof browser === 'undefined' || !browser) {
  var browser = chrome;
}

let data = {};
let isTranslating = false;
let translationEnabled = false;
let jsonLoaded = false;
let debugMode = false;

// 目前使用中的語言 (預設繁體中文)
let currentLanguage = 'zh_tw';

// 原本的字典 (key-value) 陣列
let sortedDictionary = [];

// 新增：把字典先「預編譯」為正則與對應替換值
let compiledPatterns = [];

/**
 * 依語言載入對應資料夾下的 JSON 檔案
 */
function loadLanguageFiles(language) {
  let folderPath = '';
  if (language === 'zh_tw') {
    folderPath = 'json/';
  } else if (language === 'jpn') {
    folderPath = 'JPN-json/';
  } else {
    console.warn(`No folder defined for language: ${language}`);
    return Promise.resolve(); 
  }

  // 要載入的檔案清單
  const files = [
    'dictionary.json',
    'students_mapping.json',
    'Event.json',
    'Club.json',
    'School.json',
    'CharacterSSRNew.json',
    'FamilyName_mapping.json',
    'Hobby_mapping.json',
    'skill_name_mapping.json',
    'skill_Desc_mapping.json',
    'furniture_name_mapping.json',
    'furniture_Desc_mapping.json',
    'item_name_mapping.json',
    'item_Desc_mapping.json',
    'equipment_Desc_mapping.json',
    'equipment_name_mapping.json',
    'stages_name_mapping.json',
    'stages_Event_mapping.json',
    'ArmorType.json',
    'TacticRole.json',
    'ProfileIntroduction.json',
    'WeaponNameMapping.json',
    'crafting.json'
  ];

  data = {}; // 清空，避免多次切換語言詞典混雜

  return Promise.allSettled(
    files.map(file => {
      const url = browser.runtime.getURL(folderPath + file);
      return fetch(url).then(res => res.json());
    })
  )
  .then(results => {
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        Object.assign(data, result.value);
        console.log(`Loaded: ${files[index]}`);
      } else {
        console.error(`Error loading ${files[index]}:`, result.reason);
      }
    });

    // 根據 key 長度降序排序
    sortedDictionary = Object.entries(data).sort(([keyA], [keyB]) => keyB.length - keyA.length);

    // **在這裡執行「預編譯字典」：把每個關鍵字先轉成已編譯的 RegExp**
    compileDictionary();

    jsonLoaded = true;
    if (translationEnabled) {
      translatePage();
    }
  })
  .catch(err => console.error('Error loading JSON files:', err));
}

/**
 * 把 sortedDictionary 編譯成 { pattern: /.../gi, replacement: ... }
 */
function compileDictionary() {
  compiledPatterns = sortedDictionary.map(([koreanWord, chineseWord]) => {
    const pattern = new RegExp(escapeRegExp(koreanWord), 'gi');
    return { pattern, replacement: chineseWord };
  });
}

/**
 * 文字節點翻譯：使用「預編譯」的 pattern 逐一替換
 * 只在翻譯後結果與原文不同時，才寫回
 */
function translateString(originalText) {
  let translatedText = originalText;
  for (const { pattern, replacement } of compiledPatterns) {
    translatedText = translatedText.replace(pattern, replacement);
  }
  return translatedText;
}

/**
 * 跳過翻譯的元素選擇器
 */
const skipSelector = [
  'script',
  'style',
  'input',
  'select',
  'textarea',
  '.no-translate'
];

/**
 * 遞迴翻譯元素下所有子節點
 */
function translateTextNodesInElement(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const original = node.textContent;
    const trimmed = original.trim();
    if (trimmed.length > 0) {
      const newText = translateString(original);
      if (newText !== original) {
        node.textContent = newText;
      }
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    // 符合 skipSelector 就整塊跳過
    if (skipSelector.some(selector => node.matches(selector))) {
      return;
    }
    node.childNodes.forEach(child => translateTextNodesInElement(child));
  }
}

/**
 * 整頁翻譯
 */
function translatePage() {
  if (!translationEnabled || isTranslating) return;
  isTranslating = true;

  translateTextNodesInElement(document.body);

  isTranslating = false;
}

/**
 * 用於在正則中逃脫特殊字元
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Debug: 印出頁面文字
 */
function printPageContent() {
  document.body.querySelectorAll('*:not(script):not(style)').forEach(element => {
    if (element.children.length === 0 && element.innerHTML.trim() !== '') {
      console.log("Debug: Element content:", element.innerHTML.trim());
    }
  });
}

/**
 * 避免 Mutation 多次頻繁觸發：用簡易 Debounce
 */
let mutationTimer = null;
const DEBOUNCE_DELAY = 100;

const observerConfig = {
  childList: true,
  subtree: true,
  characterData: true,
  characterDataOldValue: true
};

const globalObserver = new MutationObserver(() => {
  if (!translationEnabled) return;
  if (debugMode) {
    console.log("Debug: DOM mutation observed. Printing updated page content.");
    printPageContent();
  }

  // 先斷開觀察
  globalObserver.disconnect();

  // 100ms 內若還有新 Mutation，就清除再重設
  clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    translatePage();
    globalObserver.observe(document.body, observerConfig);
  }, DEBOUNCE_DELAY);
});

// 啟用 Observer
globalObserver.observe(document.body, observerConfig);

/**
 * DOMContentLoaded：若字典已載入 & 翻譯已啟用，就翻譯
 */
document.addEventListener('DOMContentLoaded', () => {
  if (jsonLoaded && translationEnabled) {
    translatePage();
  }
});

/**
 * 接收來自 popup / background 的訊息
 */
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
      if (debugMode) {
        console.log("Debug Mode is ON. Printing page content...");
        printPageContent();
      } else {
        console.log("Debug Mode is OFF.");
      }
    });
  } else if (request.action === 'setLanguage') {
    currentLanguage = request.language;
    console.log(`Language switched to: ${currentLanguage}`);
    location.reload();
  }
});

/**
 * 初始化：從 storage 讀取設定 (translationEnabled、debugMode、selectedLanguage) 後，
 * 載入對應語言 JSON，最後若啟用翻譯則執行 translatePage()
 */
browser.storage.sync.get(["translationEnabled", "debugMode", "selectedLanguage"], (result) => {
  translationEnabled = !!result.translationEnabled;
  debugMode = !!result.debugMode;
  currentLanguage = result.selectedLanguage || 'zh_tw';

  // 載入對應語言的 JSON
  loadLanguageFiles(currentLanguage).then(() => {
    if (translationEnabled) {
      translatePage();
    }
  });

  if (debugMode) {
    console.log("Debug Mode is enabled. Logging page content updates.");
  }
});
