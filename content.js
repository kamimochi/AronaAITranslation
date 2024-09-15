// 词汇映射表，初始为空，将从 JSON 文件中加载
let dictionary = {};
let studentMapping = {};
let eventMapping = {};  // 用于加载 Event.json
let isTranslating = false;

// 使用 fetch 同时加载 dictionary.json、students_mapping.json 和 Event.json 文件
Promise.all([
  fetch(chrome.runtime.getURL('dictionary.json')).then(response => response.json()),
  fetch(chrome.runtime.getURL('students_mapping.json')).then(response => response.json()),
  fetch(chrome.runtime.getURL('Event.json')).then(response => response.json()),  // 加载 Event.json
  fetch(chrome.runtime.getURL('Club.json')).then(response => response.json()),  // 加载 Club.json
  fetch(chrome.runtime.getURL('School.json')).then(response => response.json()),  // 加载 school.json
  fetch(chrome.runtime.getURL('CharacterSSRNew.json')).then(response => response.json()), // 加载 CharacterSSRNew.json
  fetch(chrome.runtime.getURL('FamilyName_mapping.json')).then(response => response.json()), // 加载 FamilyName_mapping.json
  fetch(chrome.runtime.getURL('Hobby_mapping.json')).then(response => response.json()), // 加载 Hobby_mapping.json
  fetch(chrome.runtime.getURL('skill_name_mapping.json')).then(response => response.json()),
  fetch(chrome.runtime.getURL('skill_Desc_mapping.json')).then(response => response.json()),
  fetch(chrome.runtime.getURL('furniture_name_mapping.json')).then(response => response.json()),
  fetch(chrome.runtime.getURL('furniture_Desc_mapping.json')).then(response => response.json())
  
])
  .then(([dictionaryData, studentMappingData, eventMappingData , ClubMappingData , SchoolMappingData , CharacterSSRNewData ,  FamilyName_mappingData , Hobby_mappingData , skill_name_mappingData , skill_Desc_mappingData , furniture_name_mappingData , furniture_Desc_mappingData]) => {
    dictionary = { ...dictionaryData, ...eventMappingData , ...ClubMappingData , ...SchoolMappingData , ...furniture_Desc_mappingData , ...CharacterSSRNewData , ...FamilyName_mappingData , ...Hobby_mappingData , ...skill_name_mappingData, ...skill_Desc_mappingData , ...studentMappingData}; // 将加载到的字典数据存储到全局变量
    studentMapping = studentMappingData; // 将学生映射表存储到全局变量
    eventMapping = eventMappingData;  // 将事件映射表存储到全局变量
    ClubMapping = ClubMappingData;  // 将社团映射表存储到全局变量
    SchoolMapping = SchoolMappingData;  // 将社团映射表存储到全局变量
    CharacterSSRNew = CharacterSSRNewData;  // 将社团映射表存储到全局变量
    FamilyName_mapping = FamilyName_mappingData;  // 将社团映射表存储到全局变量
    Hobby_mapping = Hobby_mappingData;  // 将社团映射表存储到全局变量
    skill_name_mapping = skill_name_mappingData;  // 将社团映射表存储到全局变量 
    skill_Desc_mapping = skill_Desc_mappingData;
    furniture_name_mapping = furniture_name_mappingData;  
    furniture_Desc_mapping = furniture_Desc_mappingData;
    /** 
    console.log('词汇映射表已加载:', dictionary);
    console.log('学生映射表已加载:', studentMapping);
    console.log('事件映射表已加载:', eventMapping);  // 打印 Event.json 数据
    console.log('社团映射表已加载:', ClubMapping);  // 打印 Club.json 数据
    console.log('学校映射表已加载:', SchoolMapping);  // 打印 School.json 数据
    console.log('角色映射表已加载:', CharacterSSRNew);  // 打印 CharacterSSRNew.json 数据
    console.log('家族名字映射表已加载:', FamilyName_mapping);  // 打印 FamilyName_mapping.json 数据
    console.log('爱好映射表已加载:', Hobby_mapping);  // 打印 Hobby_mapping.json 数据
    console.log('技能名字映射表已加载:', skill_name_mapping);  // 打印 skill_name_mapping.json 数据
    console.log('技能描述映射表已加载:', skill_Desc_mapping);  // 打印 skill_Desc_mapping.json 数据
    console.log('家具名字映射表已加载:', furniture_name_mapping);  // 打印 furniture_name_mapping.json 数据
    console.log('家具描述映射表已加载:', furniture_Desc_mapping);  // 打印 furniture_Desc_mapping
    */
    translatePage(); // 页面加载后立即翻译一次
  })
  .catch(error => console.error('加载词汇映射表或学生映射表时出错:', error));
// 翻译函数，使用字典和学生映射表中的对应翻译


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 转义正则表达式的特殊字符
}


function translateVocabulary(originalText) {
  let translatedText = originalText;

  // 对词汇映射表按长度排序，确保长的词条优先匹配
  const sortedDictionary = Object.entries(dictionary).sort(([a], [b]) => b.length - a.length);

  for (let [koreanWord, chineseWord] of sortedDictionary) {
    let regex;

    // 如果包含 "(單字)"，处理左右任意一边是数字的情况，或单独的字
    if (koreanWord.includes("(單字)")) {
      const cleanKoreanWord = escapeRegExp(koreanWord.replace("(單字)", "").trim());
      regex = new RegExp(`(?<=\\d)${cleanKoreanWord}|${cleanKoreanWord}(?=\\d)`, 'g');
    } else {
      // 正常替换其他单词
      regex = new RegExp(escapeRegExp(koreanWord.trim()), 'gi');
    }

    // 进行替换
    translatedText = translatedText.replace(regex, chineseWord);
  }

  return translatedText;
}

/** 
function translateStudentNames(originalText) {
  let translatedText = originalText;

  // 处理带括号的名字，先翻译不带括号的部分
  const sortedStudentMapping = Object.entries(studentMapping)
    .sort(([a], [b]) => b.length - a.length); // 按照长度从长到短排序

  // 遍历所有学生映射，处理括号内外的情况
  for (let [koreanName, chineseName] of sortedStudentMapping) {
    let cleanKoreanName = escapeRegExp(koreanName.trim());

    // 正则表达式匹配括号及括号内容，(?:...) 是非捕获组，确保括号内的内容也被正确匹配
    const regexWithParens = new RegExp(`(${cleanKoreanName})(\\([^\\)]*\\))?`, 'gi');
    
    translatedText = translatedText.replace(regexWithParens, (match, p1, p2) => {
      let translated = chineseName; // 翻译基本名字

      // 如果 p2 存在（即有括号的内容），处理括号内的字符
      if (p2 && typeof p2 === 'string') {
        translated += p2.replace(/[\uac00-\ud7af]/g, (char) => studentMapping[char] || char); // 替换括号内的字符
      }

      return translated;
    });
  }

  return translatedText;
}
*/



function translateFurniture(originalText) {
  let translatedText = originalText;

  // 按照家具名称长度从长到短排序
  const sortedFurnitureMapping = Object.entries(furniture_name_mapping)
    .sort(([a], [b]) => b.length - a.length); // 按照长度从长到短排序

  // 遍历家具映射表，替换韩文单字
  for (let [koreanWord, chineseWord] of sortedFurnitureMapping) {
    let regex = new RegExp(koreanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); // 转义特殊字符
    translatedText = translatedText.replace(regex, chineseWord);
  }

  return translatedText;
} 

function translateBrackets(originalText) {
  let translatedText = originalText;

  // 处理括号内的内容
  const regexWithBrackets = /\(([^)]+)\)/g;  // 匹配括号内的内容
  translatedText = translatedText.replace(regexWithBrackets, (match, p1) => {
    // 翻译括号内的韩文内容
    let translatedBrackets = p1.replace(/[\uac00-\ud7af]/g, (char) => dictionary[char] || char);
    return `(${translatedBrackets})`;  // 使用模板字符串来保留括号并插入翻译的内容
  });

  return translatedText;
}

function translateText(originalText) {
  let translatedText = originalText;

  // 优先处理带有括号的部分
  translatedText = translateBrackets(translatedText); // 翻译括号内的内容
  translatedText = translateFurniture(translatedText); // 翻译家具相关词汇
  translatedText = translateVocabulary(translatedText); // 翻译一般词汇
  //translatedText = translateStudentNames(translatedText); // 翻译学生名称

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