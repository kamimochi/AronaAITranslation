// 词汇映射表，初始为空，将从 JSON 文件中加载
let dictionary = {};
let isTranslating = false;

// 使用 fetch 加载 dictionary.json 文件
fetch(chrome.runtime.getURL('dictionary.json'))
  .then(response => response.json())
  .then(data => {
    dictionary = data; // 将加载到的字典数据存储到全局变量
    console.log('词汇映射表已加载:', dictionary); // 检查是否成功加载
    translatePage(); // 页面加载后立即翻译一次
  })
  .catch(error => console.error('加载词汇映射表时出错:', error));

// 翻译函数，使用字典中的对应翻译
function translateText(originalText) {
  let translatedText = originalText;

  // 遍历字典，替换匹配的韩文单字
  for (let [koreanWord, chineseWord] of Object.entries(dictionary)) {
    let regex;

    // 檢查是否是單字并且需要处理数字边界
    if (koreanWord.includes("(單字)")) {
      const cleanKoreanWord = koreanWord.replace("(單字)", "").trim();
      // 匹配左右任意一边是数字的情况，或单独的字
      regex = new RegExp(`(?<=\\d)${cleanKoreanWord}|${cleanKoreanWord}(?=\\d)`, 'g');
    } else {
      // 正常替换其他单词
      regex = new RegExp(koreanWord.trim(), 'gi');
    }

    // 进行替换
    translatedText = translatedText.replace(regex, chineseWord);
  }

  return translatedText;
}

// 分批翻译函数，处理少量节点
function translateBatch(nodes) {
  nodes.forEach(node => {
    node.textContent = translateText(node.textContent);
  });
}

// 翻译整个页面内容，使用分批翻译
function translatePage() {
  if (isTranslating) return; // 防止重复调用
  isTranslating = true;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let node;

  // 遍历页面上的所有文本节点并存储
  while (node = walker.nextNode()) {
    nodes.push(node);
  }

  const batchSize = 50; // 每次翻译的节点数量
  let index = 0;

  function processBatch() {
    if (index < nodes.length) {
      const batch = nodes.slice(index, index + batchSize);
      translateBatch(batch);
      index += batchSize;
      requestAnimationFrame(processBatch); // 使用 requestAnimationFrame 分帧处理，防止页面卡顿
    } else {
      isTranslating = false; // 翻译完成
    }
  }

  processBatch();
}



// 使用节流优化的 MutationObserver，限制频率
let observerThrottle;
const throttledObserver = () => {
  if (!observerThrottle) {
    observerThrottle = setTimeout(() => {
      translatePage();
      observerThrottle = null;
    }, 500); // 节流 500ms
  }
};

// 使用 MutationObserver 监听页面内容的变化（如动态加载的内容）
const observer = new MutationObserver((mutationsList) => {
  for (let mutation of mutationsList) {
    if (mutation.type === 'childList') {
      // 当 DOM 变化时，重新翻译页面
      throttledObserver();
    }
  }
});

// 开始观察 body 节点，监听子元素的变化
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 当页面加载完成时自动翻译一次
document.addEventListener('DOMContentLoaded', () => {
  translatePage();
});
