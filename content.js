let dictionary = {};
let studentMapping = {};
let eventMapping = {};
let isTranslating = false;
let translationEnabled = false;
let jsonLoaded = false;

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
    }
});

chrome.storage.sync.get(["translationEnabled"], result => {
    translationEnabled = result.translationEnabled || false;
    if (translationEnabled && jsonLoaded) translatePage();
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
        const regex = koreanWord.includes('(單字)')
            ? new RegExp(`(?<=\d)${escapeRegExp(koreanWord)}|${escapeRegExp(koreanWord)}(?=\d)`, 'g')
            : new RegExp(escapeRegExp(koreanWord), 'gi');
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

const observer = new MutationObserver(mutations => {
    const shouldTranslate = mutations.some(mutation =>
        Array.from(mutation.addedNodes).some(node =>
            node.nodeType === Node.ELEMENT_NODE && node.innerHTML.trim() !== ''
        )
    );
    if (shouldTranslate) translatePage();
});

observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', () => {
    translatePage();
    applyCustomFontToTranslatedText();
});
