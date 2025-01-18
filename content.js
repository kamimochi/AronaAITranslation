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
                if (index === 0) dictionary = { ...dictionary, ...data };
                if (index === 1) studentMapping = data;
                if (index === 2) eventMapping = data;
                // Add other mappings as needed
            } else {
                console.error(`Error loading ${jsonFiles[index]}:`, result.reason);
            }
        });

        jsonLoaded = true;
        if (translationEnabled) translatePage();
    })
    .catch(err => console.error('Error loading JSON files:', err));

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    

function translateTextUsingInnerHTML(originalHTML) {
    let translatedHTML = originalHTML;

    const sortedDictionary = Object.entries(dictionary).sort(([a], [b]) => b.length - a.length);
    sortedDictionary.forEach(([koreanWord, chineseWord]) => {
        const regex = new RegExp(escapeRegExp(koreanWord), 'gi');
        translatedHTML = translatedHTML.replace(regex, chineseWord);
    });

    return translatedHTML;
}

function translatePage() {
    if (!translationEnabled || isTranslating) return;

    isTranslating = true;

    const elements = document.querySelectorAll('*:not(script):not(style)');

    elements.forEach(element => {
        if (element.children.length === 0 && element.innerHTML.trim() !== '') {
            element.innerHTML = translateTextUsingInnerHTML(element.innerHTML);
        }
    });

    isTranslating = false;
}

function printPageContent() {
    document.body.querySelectorAll('*:not(script):not(style)').forEach(element => {
        if (element.children.length === 0 && element.innerHTML.trim() !== '') {
            console.log("Debug: Element content:", element.innerHTML.trim());
        }
    });
}

const observer = new MutationObserver(mutations => {
    const shouldTranslate = mutations.some(mutation =>
        Array.from(mutation.addedNodes).some(node =>
            node.nodeType === Node.ELEMENT_NODE && node.innerHTML.trim() !== ''
        )
    );
    if (shouldTranslate) {
        if (debugMode) {
            console.log("Debug: Mutation detected. Printing updated content.");
            printPageContent();
        }
        translatePage();
    }
});

observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', () => {
    translatePage();
    applyCustomFontToTranslatedText();
    if (debugMode) {
        console.log("Debug: DOMContentLoaded event triggered. Printing initial page content.");
        printPageContent();
    }
});
