document.addEventListener('DOMContentLoaded', function () {
    const toggleTranslation = document.getElementById('toggle-translation');
    const toggleDebug = document.getElementById('toggle-debug');
    const languageSelect = document.getElementById('language-select');
    const aboutBtn = document.getElementById("about-btn");


    // Chrome/Firefox 共用的 API
    if (typeof browser === "undefined") {
        var browser = chrome;
    }

    // 設定多語系翻譯
    function localizeUI() {
        document.querySelectorAll("[data-i18n]").forEach(elem => {
            const msg = chrome.i18n.getMessage(elem.getAttribute("data-i18n"));
            if (msg) elem.textContent = msg;
        });
    }
    localizeUI();

    // 從 storage 載入原本的翻譯/Debug 狀態 & 語言
    chrome.storage.sync.get(["translationEnabled", "debugMode", "selectedLanguage"], (result) => {
        const isEnabled = !!result.translationEnabled;
        const isDebug = !!result.debugMode;
        const currentLanguage = result.selectedLanguage || "zh_tw";

        // 初始化 UI 狀態
        toggleTranslation.checked = isEnabled;
        toggleDebug.checked = isDebug;
        languageSelect.value = currentLanguage;
    });

    // 翻譯開關事件
    toggleTranslation.addEventListener('change', function () {
        const isEnabled = toggleTranslation.checked;
        chrome.storage.sync.set({ translationEnabled: isEnabled });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: isEnabled ? 'enableTranslation' : 'disableTranslation'
            });
        });
    });

    // Debug Mode 切換事件
    toggleDebug.addEventListener('change', function () {
        const isDebugEnabled = toggleDebug.checked;
        chrome.storage.sync.set({ debugMode: isDebugEnabled });
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleDebugMode',
                debugMode: isDebugEnabled
            });
        });
    });

    // 語言選擇事件
    languageSelect.addEventListener("change", function () {
        const selectedLanguage = this.value;
        chrome.storage.sync.set({ selectedLanguage: selectedLanguage }, () => {
            console.log(`Popup: Language switched to: ${selectedLanguage}`);
            // 發送給 content.js 讓它重新載入對應檔案
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "setLanguage",
                    language: selectedLanguage
                });
            });
        });
    });

    // 關於按鈕事件
    aboutBtn.addEventListener('click', function () {
        window.open('about.html', '關於我', 'width=400,height=300');
    });
    // 取得關閉 alert 的 checkbox
    const toggleAlert = document.getElementById('toggle-alert');

    // 從 storage 載入 alert 設定，預設 alert 顯示（disableAlert 為 false）
    chrome.storage.sync.get(["disableAlert"], (result) => {
        toggleAlert.checked = !!result.disableAlert;
    });

    // 監聽 checkbox 狀態改變，儲存設定
    toggleAlert.addEventListener('change', function () {
        const disable = toggleAlert.checked;
        chrome.storage.sync.set({ disableAlert: disable });
    });

});
