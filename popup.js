document.addEventListener('DOMContentLoaded', function () {
    // UI 元素
    const toggleTranslation = document.getElementById('toggle-translation');
    const toggleDebug = document.getElementById('toggle-debug');
    const toggleAlert = document.getElementById('toggle-alert');
    const languageSelect = document.getElementById('language-select');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const aboutBtn = document.getElementById('about-btn');

    // 兼容 Chrome/Firefox
    const browserApi = (typeof browser === 'undefined') ? chrome : browser;

    // 多語系 UI
    function localizeUI() {
        document.querySelectorAll('[data-i18n]').forEach(elem => {
            const key = elem.getAttribute('data-i18n');
            const msg = browserApi.i18n.getMessage(key);
            if (msg) elem.textContent = msg;
        });
    }
    localizeUI();

    // 載入 Storage 狀態
    browserApi.storage.sync.get([
        'translationEnabled',
        'debugMode',
        'selectedLanguage',
        'disableAlert'
    ], (result) => {
        toggleTranslation.checked = !!result.translationEnabled;
        toggleDebug.checked = !!result.debugMode;
        toggleAlert.checked = !!result.disableAlert;
        languageSelect.value = result.selectedLanguage || 'zh_tw';
    });

    // 清除快取按鈕
    clearCacheBtn.addEventListener('click', () => {
        browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            // 若當前分頁未注入 content script
            if (!tab || !tab.id) {
                alert(browserApi.i18n.getMessage('cacheClearError'));
                return;
            }
            browserApi.tabs.sendMessage(tab.id, { action: 'clearCache' }, (response) => {
                // 處理無接收端情況
                if (browserApi.runtime.lastError) {
                    console.error('sendMessage error:', browserApi.runtime.lastError);
                    alert(browserApi.i18n.getMessage('cacheClearError'));
                    return;
                }
                // 根據 content script 回應顯示提示
                if (response && response.success) {
                    alert(browserApi.i18n.getMessage('cacheCleared'));
                    browserApi.tabs.reload(tab.id);
                } else {
                    alert(browserApi.i18n.getMessage('cacheClearError'));
                }
            });
        });
    });

    // 翻譯開關
    toggleTranslation.addEventListener('change', () => {
        const enabled = toggleTranslation.checked;
        browserApi.storage.sync.set({ translationEnabled: enabled });
        browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            browserApi.tabs.sendMessage(
                tabs[0].id,
                { action: enabled ? 'enableTranslation' : 'disableTranslation' }
            );
        });
    });

    // Debug 模式開關
    toggleDebug.addEventListener('change', () => {
        const debugOn = toggleDebug.checked;
        browserApi.storage.sync.set({ debugMode: debugOn });
        browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            browserApi.tabs.sendMessage(
                tabs[0].id,
                { action: 'toggleDebugMode', debugMode: debugOn }
            );
        });
    });

    // Alert 開關
    toggleAlert.addEventListener('change', () => {
        const disable = toggleAlert.checked;
        browserApi.storage.sync.set({ disableAlert: disable });
    });

    // 語言選擇
    languageSelect.addEventListener('change', function () {
        const lang = this.value;
        browserApi.storage.sync.set({ selectedLanguage: lang }, () => {
            console.log(`Popup: Language switched to: ${lang}`);
            browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                browserApi.tabs.sendMessage(tabs[0].id, { action: 'setLanguage', language: lang });
            });
        });
    });

    // 關於按鈕
    aboutBtn.addEventListener('click', () => {
        window.open('about.html', '關於我', 'width=400,height=300');
    });

});
