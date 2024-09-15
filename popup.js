document.addEventListener('DOMContentLoaded', function () {
	const toggle = document.getElementById('toggle-translation');

	// 从存储中获取当前状态，设置开关的初始状态
	chrome.storage.sync.get(['translationEnabled'], function (result) {
		toggle.checked = result.translationEnabled || false; // 如果没有设置，则默认关闭
		console.log("当前翻译功能状态:", result.translationEnabled);  // 加入日志打印状态
	});

	// 当开关状态改变时，更新存储并发送消息给 content.js
	toggle.addEventListener('change', function () {
		const isEnabled = toggle.checked;

		// 更新翻译状态到存储中
		chrome.storage.sync.set({ translationEnabled: isEnabled }, function () {
			console.log("更新翻译功能状态:", isEnabled);  // 打印状态更新
		});

		// 向当前激活的选项卡发送启用/禁用翻译的消息
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { action: isEnabled ? 'enableTranslation' : 'disableTranslation' });
			console.log("发送消息:", isEnabled ? '启用翻译' : '禁用翻译');  // 加入消息发送日志
		});
	});
});
