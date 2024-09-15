document.addEventListener('DOMContentLoaded', function () {
	const toggle = document.getElementById('toggle-translation');
  
	// 获取当前翻译状态
	chrome.storage.sync.get(['translationEnabled'], function (result) {
	  toggle.checked = result.translationEnabled || false;
	});
  
	// 当开关状态改变时更新存储并发送消息给 content.js
	toggle.addEventListener('change', function () {
	  const isEnabled = toggle.checked;
	  chrome.storage.sync.set({ translationEnabled: isEnabled });
	  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, { action: isEnabled ? 'enableTranslation' : 'disableTranslation' });
	  });
	});
  
	// 添加“關於我”按钮的事件监听
	const aboutBtn = document.getElementById('about-btn');
	
	aboutBtn.addEventListener('click', function () {
	  // 彈出一個新的視窗，顯示關於插件的內容
	  window.open('about.html', '關於我', 'width=400,height=300');
	});
  });  