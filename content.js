// content.js

if (typeof browser === 'undefined' || !browser) {
  var browser = chrome;
}

if (window.location.hostname === "arona.ai") {
  const meta = document.createElement("meta");
  meta.name = "google";
  meta.content = "notranslate";
  document.head.appendChild(meta);

  chrome.storage.sync.get(["disableAlert"], function (result) {
    if (!result.disableAlert) {
      alert(chrome.i18n.getMessage("alertMessage"));
    }
  });
}

let translationWorker = null;
let workerReady = false;
let data = {};
let isTranslating = false;
let translationEnabled = false;
let jsonLoaded = false;
let debugMode = false;
let currentLanguage = 'zh_tw';
let sortedDictionary = [];
let compiledPatterns = [];

const skipSelector = [
  'script', 'style', 'input', 'select', 'textarea', '.no-translate',
  '.MuiSlider-markLabel', '.MuiSlider-thumb', '.MuiSlider-track', '.MuiSlider-rail'
];

function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a.length && !b.length) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function getFuzzyTranslation(text, threshold = 0.95) {
  let bestScore = 0, bestTrans = null;
  for (const [key, val] of sortedDictionary) {
    const score = similarity(text, key);
    if (score > bestScore) {
      bestScore = score;
      bestTrans = val;
    }
  }
  return bestScore >= threshold ? bestTrans : null;
}

async function initWorker() {
  if (typeof Worker === 'undefined') return;
  try {
    const workerUrl = chrome.runtime.getURL('translationWorker.js');
    const response = await fetch(workerUrl);
    const blob = await response.blob();
    const blobURL = URL.createObjectURL(blob);
    translationWorker = new Worker(blobURL);
    translationWorker.onmessage = e => {
      if (e.data.ready) {
        workerReady = true;
        if (translationEnabled) translatePage();
      }
    };
    await loadLanguageFiles(currentLanguage);
    translationWorker.postMessage({ action: "init" });
  } catch (err) {
    console.error('Failed to load Worker:', err);
  }
}

function sendTranslationRequest(texts) {
  return new Promise(resolve => {
    const handler = e => {
      translationWorker.removeEventListener('message', handler);
      resolve(e.data);
    };
    translationWorker.addEventListener('message', handler);
    translationWorker.postMessage({ action: "translate", texts, patterns: compiledPatterns.map(p => ({ pattern: p.pattern.source, replacement: p.replacement })) });
  });
}

function mergeAdjacentRubyNodes() {
  const rubyNodes = Array.from(document.querySelectorAll('ruby'));
  const processed = new Set();
  rubyNodes.forEach(ruby => {
    if (processed.has(ruby) || !ruby.isConnected) return;
    const group = [ruby];
    let next = ruby.nextSibling;
    while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") next = next.nextSibling;
    while (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === 'RUBY') {
      if (!next.isConnected) break;
      group.push(next);
      processed.add(next);
      next = next.nextSibling;
      while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") next = next.nextSibling;
    }
    if (group.length > 1) {
      const combined = group.map(n => n.textContent.trim()).join(' ');
      const exact = sortedDictionary.find(([k]) => k === combined);
      const translated = exact ? exact[1] : getFuzzyTranslation(combined);
      if (translated) {
        const newNode = document.createElement('ruby');
        newNode.textContent = translated;
        const first = group[0];
        if (first.parentNode && first.isConnected) first.parentNode.insertBefore(newNode, first);
        group.forEach(n => { if (n.isConnected) n.remove(); processed.add(n); });
      }
    }
  });
}

function mergeAdjacentSpanNodes() {
  const spanNodes = Array.from(document.querySelectorAll('span'));
  const processed = new Set();
  const numericSlashRe = /^[0-9.%\/]+$/;
  spanNodes.forEach(span => {
    if (processed.has(span) || !span.isConnected) return;
    const group = [];
    let curr = span;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName === "SPAN") {
      const txt = curr.textContent.trim();
      if (txt) group.push(curr);
      processed.add(curr);
      curr = curr.nextSibling;
      while (curr && curr.nodeType === Node.TEXT_NODE && curr.textContent.trim() === "") curr = curr.nextSibling;
    }
    if (group.length < 2 || group.every(n => numericSlashRe.test(n.textContent.trim()))) return;
    const merged = group.map(n => n.textContent).join("").replace(/\s+/g, " ").trim();
    const exact = sortedDictionary.find(([k]) => k === merged);
    const translated = exact ? exact[1] : getFuzzyTranslation(merged);
    if (translated) {
      const newSpan = document.createElement("span");
      newSpan.textContent = translated;
      const first = group[0];
      if (first.parentNode && first.isConnected) first.parentNode.insertBefore(newSpan, first);
      group.forEach(n => { if (n.isConnected) n.remove(); processed.add(n); });
    }
  });
}

async function translateTextNodesInElement(node, callback) {
  const textNodes = [];
  collectTextNodes(node, textNodes);
  if (!textNodes.length || !workerReady) return callback();
  let translatedTexts;
  try {
    translatedTexts = await sendTranslationRequest(textNodes.map(n => n.textContent));
  } catch (err) {
    console.error('Translation error:', err);
    return callback();
  }
  const percentGapRe = /(\d+(?:\.\d+)?%)\s*(?=\d+(?:\.\d+)?%)/g;
  textNodes.forEach((node, i) => {
    const orig = node.textContent;
    let newText = translatedTexts[i].replace(percentGapRe, '$1/');
    if (newText === orig) {
      const fuzzy = getFuzzyTranslation(orig);
      if (fuzzy) newText = fuzzy;
    }
    if (newText !== orig) {
      if (debugMode) console.log(`[翻譯差異] 原文: ${orig}, 翻譯: ${newText}`);
      node.textContent = newText;
    }
  });
  callback();
}

function collectTextNodes(node, textNodes) {
  const numericSlashRe = /^[0-9.%\/]+$/;
  if (node.nodeType === Node.TEXT_NODE) {
    const trimmed = node.textContent.trim();
    if (trimmed.length > 0 && !numericSlashRe.test(trimmed)) {
      textNodes.push(node);
    }
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE && !skipSelector.some(selector => node.matches(selector))) {
    node.childNodes.forEach(child => collectTextNodes(child, textNodes));
  }
}

function compileDictionary() {
  compiledPatterns = sortedDictionary.map(([koreanWord, chineseWord]) => {
    const pattern = new RegExp(escapeRegExp(koreanWord), 'gi');
    return { pattern, replacement: chineseWord };
  });
}

async function loadLanguageFiles(language) {
  const cacheKey = `translationDict_${language}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    data = JSON.parse(cached);
  } else {
    let folderPath = language === 'zh_tw' ? 'zh_TW-json/' : language === 'jpn' ? 'JPN-json/' : '';
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
    const results = await Promise.allSettled(files.map(file => fetch(browser.runtime.getURL(folderPath + file)).then(r => r.json())));
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') Object.assign(data, res.value);
    });
    localStorage.setItem(cacheKey, JSON.stringify(data));
  }
  sortedDictionary = Object.entries(data).sort(([a], [b]) => b.length - a.length);
  compileDictionary();
  jsonLoaded = true;
  if (translationEnabled) translatePage();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function translatePage() {
  if (!translationEnabled || isTranslating) return;
  isTranslating = true;
  mergeAdjacentRubyNodes();
  mergeAdjacentSpanNodes();
  translateTextNodesInElement(document.body, () => {
    isTranslating = false;
    globalObserver.observe(document.body, observerConfig);
  });
}

const observerConfig = { childList: true, subtree: true, characterData: true };
const globalObserver = new MutationObserver(() => {
  if (!translationEnabled) return;
  globalObserver.disconnect();
  debouncedTranslate();
});
const debouncedTranslate = debounce(translatePage, 100);

globalObserver.observe(document.body, observerConfig);

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
    });
  } else if (request.action === 'setLanguage') {
    currentLanguage = request.language;
    location.reload();
  }
});

browser.storage.sync.get(["translationEnabled", "debugMode", "selectedLanguage"], result => {
  translationEnabled = !!result.translationEnabled;
  debugMode = !!result.debugMode;
  currentLanguage = result.selectedLanguage || 'zh_tw';
  loadLanguageFiles(currentLanguage).then(() => {
    if (translationEnabled) translatePage();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  if (jsonLoaded && translationEnabled) translatePage();
});

initWorker();
