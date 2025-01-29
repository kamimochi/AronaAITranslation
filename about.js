// 從 storage 載入原本的翻譯/Debug 狀態 & 語言
if (typeof browser === "undefined") {
    var browser = chrome;
}

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-i18n]").forEach(elem => {
        const msg = chrome.i18n.getMessage(elem.getAttribute("data-i18n"));
        if (msg) elem.textContent = msg;
    });
});
