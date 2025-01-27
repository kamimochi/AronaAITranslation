let data = {};
let isTranslating = false;
let translationEnabled = false;
let jsonLoaded = false;
let debugMode = false;

// 目前使用中的語言 (預設繁體中文)，後續可在 "setLanguage" 時更新
let currentLanguage = 'zh_tw';

// 存放載入後的字典（key-value）陣列
let sortedDictionary = [];

/**
 * 依語言載入對應資料夾下的 JSON 檔案
 */
function loadLanguageFiles(language) {
  // 根據語言指定資料夾
  let folderPath = '';
  if (language === 'zh_tw') {
    folderPath = 'json/';       // 繁體中文放這裡
  } else if (language === 'jpn') {
    folderPath = 'JPN-json/';   // 日文放這裡
  } else {
    console.warn(`No folder defined for language: ${language}`);
    return Promise.resolve(); // 若不支援其他語言，可直接 return
  }

  // 需要載入的檔案清單
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
    'TacticRole.json'
  ];

  // 為了重新載入時清空 data（避免多次切換語言造成詞典混雜）
  data = {};

  return Promise.allSettled(
    files.map(file => {
      const url = chrome.runtime.getURL(folderPath + file);
      return fetch(url).then(res => res.json());
    })
  )
    .then(results => {
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const jsonContent = result.value;
          // 合併到 data
          Object.assign(data, jsonContent);
          console.log(`Loaded: ${files[index]}`);
        } else {
          console.error(`Error loading ${files[index]}:`, result.reason);
        }
      });

      // 依照 key 長度降序排序，避免長字串被短字串先取代
      sortedDictionary = Object.entries(data).sort(([keyA], [keyB]) => keyB.length - keyA.length);

      // 設定載入完成
      jsonLoaded = true;

      // 若翻譯功能本來就已啟用，載入完就立即翻譯
      if (translationEnabled) {
        translatePage();
      }
    })
    .catch(err => console.error('Error loading JSON files:', err));
}

/**
 * 文字節點翻譯：只在翻譯後結果跟原文「不同」時才寫回，以避免不必要的 DOM 改動
 */
function translateString(originalText) {
  let translatedText = originalText;
  sortedDictionary.forEach(([koreanWord, chineseWord]) => {
    // 全域、大小寫不敏感替換
    const regex = new RegExp(escapeRegExp(koreanWord), 'gi');
    translatedText = translatedText.replace(regex, chineseWord);
  });
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
      // 只有在翻譯結果和原本不一樣時才回寫
      if (newText !== original) {
        node.textContent = newText;
      }
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    // 若此元素符合 skipSelector，就整塊跳過
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
 * 避免Mutation多次頻繁觸發：用簡單debounce
 */
let mutationTimer = null;
const DEBOUNCE_DELAY = 100; // (ms) 您可自行調整

/**
 * 建立 MutationObserver
 */
const observerConfig = {
  childList: true,
  subtree: true,
  characterData: true,
  characterDataOldValue: true
};

const globalObserver = new MutationObserver(mutations => {
  // 如果翻譯關閉，就直接跳過
  if (!translationEnabled) return;

  if (debugMode) {
    console.log("Debug: DOM mutation observed. Printing updated page content.");
    printPageContent();
  }

  // 暫時停止觀察
  globalObserver.disconnect();

  // 用 setTimeout 做簡易節流：在DEBOUNCE_DELAY ms內若多次呼叫，只執行最後一次
  clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    // 執行翻譯
    translatePage();
    // 翻譯完畢後，恢復監聽
    globalObserver.observe(document.body, observerConfig);
  }, DEBOUNCE_DELAY);
});

// 啟用Observer
globalObserver.observe(document.body, observerConfig);

/**
 * 監聽 DOMContentLoaded 後，如果字典已載入 & 翻譯啟用，直接翻譯
 */
document.addEventListener('DOMContentLoaded', () => {
  if (jsonLoaded && translationEnabled) {
    translatePage();
  }
});

/**
 * 監聽來自 popup.js/ background.js 的訊息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enableTranslation') {
    chrome.storage.sync.set({ translationEnabled: true }, () => {
      translationEnabled = true;
      if (jsonLoaded) translatePage();
    });
  } else if (request.action === 'disableTranslation') {
    chrome.storage.sync.set({ translationEnabled: false }, () => {
      translationEnabled = false;
      location.reload(); // 直接重整，可避免還原文字的麻煩
    });
  } else if (request.action === 'toggleDebugMode') {
    chrome.storage.sync.set({ debugMode: request.debugMode }, () => {
      debugMode = request.debugMode;
      if (debugMode) {
        console.log("Debug Mode is ON. Refreshing page and enabling content logging...");
        printPageContent();
      } else {
        console.log("Debug Mode is OFF.");
      }
    });
  } else if (request.action === 'setLanguage') {
    // 切換語言時，先更新 currentLanguage
    currentLanguage = request.language;
    console.log(`Language switched to: ${currentLanguage}`);
    // 再重整頁面 or 可直接重載字典
    location.reload();
  }
});

/**
 * 在初始化階段，根據 storage 讀取翻譯是否啟用 / debugMode / 選擇的語言
 * 然後載入對應語言的 JSON
 */
chrome.storage.sync.get(["translationEnabled", "debugMode", "selectedLanguage"], (result) => {
  translationEnabled = !!result.translationEnabled;
  debugMode = !!result.debugMode;
  currentLanguage = result.selectedLanguage || 'zh_tw';

  // 載入對應語言的 JSON
  loadLanguageFiles(currentLanguage).then(() => {
    // JSON 載好後再做翻譯
    if (translationEnabled) {
      translatePage();
    }
  });

  if (debugMode) {
    console.log("Debug Mode is enabled. Logging page content updates.");
  }
});
