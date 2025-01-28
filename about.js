document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-i18n]").forEach(elem => {
        const msg = chrome.i18n.getMessage(elem.getAttribute("data-i18n"));
        if (msg) elem.textContent = msg;
    });
});
