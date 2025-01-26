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

  // 為了重新載入時清空 data（避免多次切換語言造成詞典混雜），可視需求而定
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
 * 文字節點翻譯
 */
function translateString(originalText) {
  let translatedText = originalText;
  sortedDictionary.forEach(([koreanWord, chineseWord]) => {
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
    const trimmed = node.textContent.trim();
    if (trimmed.length > 0) {
      node.textContent = translateString(node.textContent);
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
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
 * 觀察動態新增節點並翻譯
 */
const globalObserver = new MutationObserver(mutations => {
  globalObserver.disconnect();
  // 先印 Debug，再看翻譯要不要執行
  if (debugMode) {
    console.log("Debug: DOM mutation observed. Printing updated page content.");
    printPageContent();
  }

  // 如果翻譯關閉，就跳出
  if (!translationEnabled) return;

  // 否則再做翻譯
  mutations.forEach(mutation => {
    if (mutation.type === 'characterData') {
      translateTextNodesInElement(mutation.target);
    }
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        translateTextNodesInElement(node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        translateTextNodesInElement(node);
      }
    });
  });
  globalObserver.observe(document.body, observerConfig);
});

const observerConfig = {
  childList: true,
  subtree: true,
  characterData: true,
  characterDataOldValue: true
};

globalObserver.observe(document.body, observerConfig);
/**
 * 其他工具或函式
 */
function applyCustomFontToTranslatedText() {
  document.querySelectorAll('.translated-text').forEach(element => {
    element.style.fontFamily = "'ShinMGoUprMedium', sans-serif";
  });
}
function printPageContent() {
  document.body.querySelectorAll('*:not(script):not(style)').forEach(element => {
    if (element.children.length === 0 && element.innerHTML.trim() !== '') {
      console.log("Debug: Element content:", element.innerHTML.trim());
    }
  });
}
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 監聽 DOMContentLoaded 後嘗試翻譯
 */
document.addEventListener('DOMContentLoaded', () => {
  // 如果 json 已載入且翻譯已啟用就直接翻譯
  if (jsonLoaded && translationEnabled) {
    translatePage();
  }
  applyCustomFontToTranslatedText();
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
      location.reload();
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

    // 重新載入對應資料夾的 JSON 檔
    location.reload();
  }
});

// -------------------- 在初始化階段，就根據 storage 讀取語言並載入對應檔案 --------------------
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
