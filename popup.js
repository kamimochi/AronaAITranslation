document.addEventListener('DOMContentLoaded', function () {
	const toggle = document.getElementById('toggle-translation');
	const debugToggle = document.getElementById('toggle-debug');

	
	chrome.storage.sync.get(['translationEnabled', 'debugMode'], function (result) {
		toggle.checked = result.translationEnabled || false;
		debugToggle.checked = result.debugMode || false;
	});

	
	toggle.addEventListener('change', function () {
		const isEnabled = toggle.checked;
		chrome.storage.sync.set({ translationEnabled: isEnabled });
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { action: isEnabled ? 'enableTranslation' : 'disableTranslation' });
		});
	});

	
	debugToggle.addEventListener('change', function () {
		const isDebugEnabled = debugToggle.checked;
		chrome.storage.sync.set({ debugMode: isDebugEnabled });
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleDebugMode', debugMode: isDebugEnabled });
		});
	});

	
	const aboutBtn = document.getElementById('about-btn');

	aboutBtn.addEventListener('click', function () {
		window.open('about.html', '關於我', 'width=400,height=300');
	});
});
