let dictionary = {};
let studentMapping = {};
let eventMapping = {};
let isTranslating = false;
let translationEnabled = false;
let jsonLoaded = false;
let debugMode = false; // Debug mode state

function applyCustomFontToTranslatedText() {
    document.querySelectorAll('.translated-text').forEach(element => {
        element.style.fontFamily = "'ShinMGoUprMedium', sans-serif";
    });
}

// -------------------- 新增：只翻译纯文本的工具函数 --------------------

// 在这里维护要“跳过翻译”的元素选择器，可根据需求添加
const skipSelector = [
    'script',
    'style',
    'input',
    'select',
    'textarea',
    '.no-translate'
    // 还可以在此添加其他需要跳过的类名或标签，如 '.MuiButton-root'
];

// 在加载完成后，我们会把字典“按键长倒序”排序好，以便做字符串替换
let sortedDictionary = [];

/**
 * 将传入的文本，根据 dictionary 做简单的替换。
 * 和你原先的 translateTextUsingInnerHTML 思路相同，只是改名并去掉 innerHTML。
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
 * 递归遍历节点，若是文本节点，则执行字符串替换；
 * 若是元素节点，则继续遍历子节点，但会跳过 `skipSelector` 中的元素。
 */
function translateTextNodesInElement(node) {
    // 如果是文本节点 (Node.TEXT_NODE == 3)
    if (node.nodeType === Node.TEXT_NODE) {
        const trimmed = node.textContent.trim();
        if (trimmed.length > 0) {
            node.textContent = translateString(node.textContent);
        }
        return;
    }

    // 如果是元素节点 (Node.ELEMENT_NODE == 1)，检查是否在跳过列表
    if (node.nodeType === Node.ELEMENT_NODE) {
        // 如果这个节点本身匹配了 skipSelector，则整块跳过翻译
        if (skipSelector.some(selector => node.matches(selector))) {
            return;
        }
        // 否则，递归翻译子节点
        node.childNodes.forEach(child => translateTextNodesInElement(child));
    }
}

/**
 * 在一个指定的根节点(或选择器)上执行“只翻译文本”的操作
 */
function translateSpecificArea(selector) {
    waitForTargetArea(selector, (targetArea) => {
        if (!targetArea) {
            console.error(`Debug: Target area ${selector} is undefined.`);
            return;
        }

        // 遍历该区域所有子节点，进行翻译
        targetArea.childNodes.forEach(child => translateTextNodesInElement(child));

        console.log(`Debug: Translated content in ${selector}`);
    });
}

/**
 * 整页翻译：对 document.body 下的所有可翻译文本节点执行翻译
 */
function translatePage() {
    if (!translationEnabled || isTranslating) return;
    isTranslating = true;

    translateTextNodesInElement(document.body);

    isTranslating = false;
}

/**
 * 用于在加载或调试时打印页面内容
 */
function printPageContent() {
    document.body.querySelectorAll('*:not(script):not(style)').forEach(element => {
        if (element.children.length === 0 && element.innerHTML.trim() !== '') {
            console.log("Debug: Element content:", element.innerHTML.trim());
        }
    });
}

// -------------------- 你原先的监听和 JSON 加载逻辑 --------------------

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
    }
});

chrome.storage.sync.get(["translationEnabled", "debugMode"], result => {
    translationEnabled = result.translationEnabled || false;
    debugMode = result.debugMode || false;
    if (translationEnabled && jsonLoaded) translatePage();
    if (debugMode) {
        console.log("Debug Mode is enabled. Logging page content updates.");
    }
});

// 需要加载的 JSON 文件列表
const jsonFiles = [
    'dictionary.json', 'students_mapping.json', 'Event.json', 'Club.json', 'School.json',
    'CharacterSSRNew.json', 'FamilyName_mapping.json', 'Hobby_mapping.json',
    'skill_name_mapping.json', 'skill_Desc_mapping.json', 'furniture_name_mapping.json',
    'furniture_Desc_mapping.json', 'item_name_mapping.json', 'item_Desc_mapping.json',
    'equipment_Desc_mapping.json', 'equipment_name_mapping.json',
    'stages_name_mapping.json', 'stages_Event_mapping.json'
];

Promise.allSettled(jsonFiles.map(file => fetch(chrome.runtime.getURL(`json/${file}`)).then(res => res.json())))
    .then(results => {
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const data = result.value;
                if (index === 0) {
                    // 这里将读取到的 dictionary.json 合并到 dictionary 对象
                    dictionary = { ...dictionary, ...data };
                } else if (index === 1) {
                    studentMapping = data;
                } else if (index === 2) {
                    eventMapping = data;
                }
                // 其他 mapping 也可按需处理
            } else {
                console.error(`Error loading ${jsonFiles[index]}:`, result.reason);
            }
        });

        // 加载完成后，准备好 sortedDictionary
        sortedDictionary = Object.entries(dictionary).sort(([a], [b]) => b.length - a.length);

        jsonLoaded = true;
        if (translationEnabled) translatePage();
    })
    .catch(err => console.error('Error loading JSON files:', err));

// 用于转义正则字符，原先已有，保留
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// -------------------- 保留你的目标区域等待逻辑与对话框观察 --------------------

function waitForTargetArea(selector, callback, timeout = 10000, interval = 500) {
    const startTime = Date.now();

    const checkExist = setInterval(() => {
        const targetArea = document.querySelector(selector);
        if (targetArea) {
            clearInterval(checkExist);
            console.log(`Debug: Target area ${selector} found.`);
            callback(targetArea); 
        } else if (Date.now() - startTime > timeout) {
            clearInterval(checkExist);
            console.warn(`Debug: Target area ${selector} not found within timeout.`);
        }
    }, interval);
}

function observeDialogContent() {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                // 如果是动态添加的对话框根元素
                if (node.nodeType === Node.ELEMENT_NODE && node.matches('.MuiDialogContent-root')) {
                    console.log("Debug: Detected dynamically added .MuiDialogContent-root, applying translation.");
                    translateSpecificArea('.MuiDialogContent-root');
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log("Debug: Global observer attached to watch for .MuiDialogContent-root.");
}

// -------------------- 监听 DOM 变动的全局 MutationObserver --------------------

const globalObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        Array.from(mutation.addedNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // 如果是弹窗内容，单独处理
                if (node.matches('.MuiDialogContent-root')) {
                    console.log("Debug: Translating dynamically added .MuiDialogContent-root content.");
                    translateSpecificArea('.MuiDialogContent-root');
                }
                // 对新添加的节点做文本翻译
                translateTextNodesInElement(node);
            } else if (node.nodeType === Node.TEXT_NODE) {
                // 如果是文本节点，直接翻译
                translateTextNodesInElement(node);
            }
        });
    });
    if (debugMode) {
        console.log("Debug: DOM mutation observed. Printing updated page content.");
        printPageContent();
    }
});

globalObserver.observe(document.body, { childList: true, subtree: true });

// -------------------- 页面加载后初始化 --------------------

document.addEventListener('DOMContentLoaded', () => {
    translatePage();
    applyCustomFontToTranslatedText();
    observeDialogContent();
    translateSpecificArea('.MuiDialogContent-root');
    if (debugMode) {
        console.log("Debug: DOMContentLoaded event triggered. Printing initial page content.");
        printPageContent();
    }
});
