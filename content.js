// content.js - 優化版本

if (typeof browser === 'undefined' || !browser) {
	var browser = chrome;
}

let spanDict;
const Config = {
	defaults: {
		translationEnabled: false,
		debugMode: false,
		language: 'zh_tw',
		disableAlert: false,
		fuzzyMatchThreshold: 0.95
	},

	current: {},

	async load() {
		return new Promise(resolve => {
			browser.storage.sync.get(Object.keys(this.defaults), result => {
				this.current = { ...this.defaults, ...result };
				resolve(this.current);
			});
		});
	},

	async save(key, value) {
		return new Promise(resolve => {
			const data = {};
			data[key] = value;
			this.current[key] = value;
			browser.storage.sync.set(data, resolve);
		});
	}
};

const Dictionary = {
	data: {},
	sortedEntries: [],
	compiledPatterns: [],
	loadedFiles: [],


	async loadLanguage(language) {
		const cacheKey = `translationDict_${language}`;

		try {

			this.loadedFiles = [];


			const cached = await this.getFromDB(cacheKey);
			if (cached) {

				this.data = cached.dict || {};
				this.loadedFiles = cached.files || [];
			} else {

				await this.fetchDictionaryFiles(language);

				await this.saveToDB(cacheKey, {
					dict: this.data,
					files: this.loadedFiles
				});
			}


			this.sortedEntries = Object.entries(this.data)
				.sort(([a], [b]) => b.length - a.length);
			this.compileDictionary();


			if (Config.current.debugMode) {
				console.log(`[DEBUG] 成功載入字典檔案數：${this.loadedFiles.length} 個檔案`);
				console.log(`[DEBUG] 字典總條目數：${Object.keys(this.data).length}`);
				console.log(`[DEBUG] 檔案清單：`, this.loadedFiles);
			}

			return true;
		} catch (error) {
			console.error('Dictionary loading error:', error);
			return false;
		}
	},

	// 抓取多個 JSON 字典檔
	async fetchDictionaryFiles(language) {
		const folderPath = language === 'zh_tw'
			? 'zh_TW-json/'
			: language === 'jpn'
				? 'JPN-json/'
				: '';

		const files = [
			'dictionary.json',
			'students_mapping.json',
			'Event.json',
			'Club.json',
			'School.json',
			'CharacterSSRNew.json',
			'FamilyName_mapping.json',
			'Hobby_mapping.json',
			'skill_name_mapping.json',
			'skill_Desc_mapping.json',
			'furniture_name_mapping.json',
			'furniture_Desc_mapping.json',
			'item_name_mapping.json',
			'item_Desc_mapping.json',
			'equipment_Desc_mapping.json',
			'equipment_name_mapping.json',
			'stages_name_mapping.json',
			'stages_Event_mapping.json',
			'ArmorType.json',
			'TacticRole.json',
			'ProfileIntroduction.json',
			'WeaponNameMapping.json',
			'crafting.json',
			'skill_Desc_one_row.json',
			'StatusMessage.json'
		];

		this.data = {};
		this.loadedFiles = [];

		const results = await Promise.allSettled(
			files.map(file =>
				fetch(browser.runtime.getURL(folderPath + file))
					.then(r => r.ok ? r.json() : Promise.reject(`Failed to load ${file}`))
			)
		);

		results.forEach((res, i) => {
			if (res.status === 'fulfilled') {
				Object.assign(this.data, res.value);
				this.loadedFiles.push(files[i]);
				if (Config.current.debugMode) {
					console.log(`[DEBUG] 已載入 ${files[i]} （${Object.keys(res.value).length} 條）`);
				}
			} else if (Config.current.debugMode) {
				console.warn(`[DEBUG] 載入失敗: ${files[i]} ->`, res.reason);
			}
		});
	},


	async getFromDB(key) {
		return new Promise((resolve, reject) => {
			const openReq = indexedDB.open('translation_cache', 1);
			openReq.onupgradeneeded = e => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains('dictionaries')) {
					db.createObjectStore('dictionaries');
				}
			};
			openReq.onsuccess = e => {
				const db = e.target.result;
				const tx = db.transaction('dictionaries', 'readonly');
				const store = tx.objectStore('dictionaries');
				const getReq = store.get(key);
				getReq.onsuccess = () => resolve(getReq.result);
				getReq.onerror = () => reject(getReq.error);
			};
			openReq.onerror = e => reject(e.target.error);
		});
	},


	async saveToDB(key, value) {
		return new Promise((resolve, reject) => {
			const openReq = indexedDB.open('translation_cache', 1);
			openReq.onupgradeneeded = e => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains('dictionaries')) {
					db.createObjectStore('dictionaries');
				}
			};
			openReq.onsuccess = e => {
				const db = e.target.result;
				const tx = db.transaction('dictionaries', 'readwrite');
				const store = tx.objectStore('dictionaries');
				store.put(value, key);
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			};
			openReq.onerror = e => reject(e.target.error);
		});
	},


	compileDictionary() {
		this.compiledPatterns = this.sortedEntries.map(([k, v]) => ({
			pattern: new RegExp(this.escapeRegExp(k), 'gi'),
			replacement: v
		}));
	},

	escapeRegExp(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	},

	getFuzzyTranslation(text, threshold = Config.current.fuzzyMatchThreshold) {
		if (!text) return null;
		let bestScore = 0, bestTrans = null;
		const lenThresh = text.length * 0.3;
		for (const [key, val] of this.sortedEntries) {
			if (Math.abs(key.length - text.length) > lenThresh) continue;
			const score = this.similarity(text, key);
			if (score > bestScore) {
				bestScore = score;
				bestTrans = val;
				if (score >= 0.98) break;
			}
		}
		return bestScore >= threshold ? bestTrans : null;
	},

	similarity(a, b) {
		if (!a.length && !b.length) return 1;
		const dist = this.levenshteinDistance(a, b);
		return 1 - dist / Math.max(a.length, b.length);
	},

	levenshteinDistance(a, b) {
		const m = a.length, n = b.length;
		let prev = Array(n + 1).fill(0), curr = Array(n + 1).fill(0);
		for (let j = 0; j <= n; j++) prev[j] = j;
		for (let i = 1; i <= m; i++) {
			curr[0] = i;
			for (let j = 1; j <= n; j++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
			}
			[prev, curr] = [curr, prev];
		}
		return prev[n];
	}
};




// 翻譯工作器管理
const WorkerManager = {
	worker: null,
	isReady: false,
	pendingRequests: new Map(),
	nextRequestId: 1,

	async init() {
		if (typeof Worker === 'undefined') return false;

		try {
			const workerUrl = browser.runtime.getURL('translationWorker.js');
			const response = await fetch(workerUrl);
			const blob = await response.blob();
			const blobURL = URL.createObjectURL(blob);

			this.worker = new Worker(blobURL);

			this.worker.onmessage = e => {
				if (e.data.ready) {
					this.isReady = true;
					return;
				}

				if (e.data.requestId && this.pendingRequests.has(e.data.requestId)) {
					const { resolve } = this.pendingRequests.get(e.data.requestId);
					this.pendingRequests.delete(e.data.requestId);
					resolve(e.data.result);
				}
			};

			this.worker.onerror = err => {
				console.error('Worker error:', err);
				setTimeout(() => this.init(), 5000);
			};


			this.worker.postMessage({ action: "init" });


			return new Promise(resolve => {
				const checkReady = setInterval(() => {
					if (this.isReady) {
						clearInterval(checkReady);
						resolve(true);
					}
				}, 100);
			});
		} catch (err) {
			console.error('Failed to load Worker:', err);
			return false;
		}
	},

	async sendTranslationRequest(texts) {
		if (!this.worker || !this.isReady) {
			return texts;
		}

		const requestId = this.nextRequestId++;

		return new Promise(resolve => {
			this.pendingRequests.set(requestId, { resolve });

			this.worker.postMessage({
				action: "translate",
				requestId,
				texts,
				patterns: Dictionary.compiledPatterns.map(p => ({
					pattern: p.pattern.source,
					replacement: p.replacement
				}))
			});
		});
	}
};

// DOM 翻譯模塊
// DOM 翻譯模塊
const DOMTranslator = {
    isTranslating: false,
    observer: null,
    skipSelector: [
        'script', 'style', 'input', 'select', 'textarea', '.no-translate',
        '.MuiSlider-markLabel', '.MuiSlider-thumb', '.MuiSlider-track', '.MuiSlider-rail',
        '[data-translated="true"]' // 新增：直接跳過已標記的元素
    ],
    translatedAttribute: 'data-translated', // 定義標記屬性名，方便管理

    init() {
        // 初始化 MutationObserver
        const observerConfig = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [this.translatedAttribute] }; // 監聽屬性變化，特別是我們的標記
        this.observer = new MutationObserver(this.handleMutations.bind(this));
        this.observer.observe(document.body, observerConfig);
    },

    handleMutations(mutations) {
        if (!Config.current.translationEnabled) return;

        const changedNodes = new Set();
        let translationAttributeChanged = false;

        for (const mutation of mutations) {
            // 如果是我們自己的 data-translated 屬性變化，通常可以忽略，除非是外部移除了它
            if (mutation.type === 'attributes' && mutation.attributeName === this.translatedAttribute) {
                translationAttributeChanged = true;
                // 如果是外部移除了我們的標記，可能需要重新翻譯，但這比較複雜，暫時先簡化處理
                // changedNodes.add(mutation.target); // 可以考慮將其加入，以便重新評估
                continue; // 簡單起見，先忽略我們自己標記的變化
            }

            // 文本內容變化
            if (mutation.type === 'characterData') {
                // 檢查父節點是否已標記
                if (mutation.target.parentNode && !mutation.target.parentNode.hasAttribute(this.translatedAttribute)) {
                    changedNodes.add(mutation.target.parentNode);
                }
            }
            // 節點添加或移除
            else if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute(this.translatedAttribute) && !node.closest(`[${this.translatedAttribute}]`)) {
                        changedNodes.add(node);
                    }
                    // 如果添加的是文本節點，其父節點也可能需要檢查
                    else if (node.nodeType === Node.TEXT_NODE && node.parentNode && !node.parentNode.hasAttribute(this.translatedAttribute) && !node.parentNode.closest(`[${this.translatedAttribute}]`)) {
                         changedNodes.add(node.parentNode);
                    }
                });
                // 對於移除的節點，我們通常不需要做什麼，因為它們已經不在 DOM 中了
            }
        }

        if (changedNodes.size > 0) {
            this.observer.disconnect(); // 斷開，避免處理自己觸發的變化
            this.debouncedTranslate(Array.from(changedNodes));
        } else if (translationAttributeChanged && changedNodes.size === 0) {
            // 如果只有 data-translated 屬性變化，並且沒有其他需要翻譯的節點，
            // 我們可能仍然需要重新啟動 observer，以防外部移除了標記
             this.observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [this.translatedAttribute] });
        }
    },

    debouncedTranslate: debounce(async function (nodes) {
        if (Config.current.debugMode) console.log('[DEBUG] Debounced translate triggered for nodes:', nodes);
        await this.mergeAdjacentNodes(); // merge 內部也需要檢查標記
        await this.translateNodes(nodes.filter(node => node.isConnected && !node.hasAttribute(this.translatedAttribute) && !node.closest(`[${this.translatedAttribute}]`))); // 過濾掉已標記或其父級已標記的節點
        
        // 確保在所有異步操作完成後再重新連接 observer
        if (this.observer) { // 檢查 observer 是否還存在 (例如，在 disableTranslation 時可能為 null)
             this.observer.observe(
                document.body,
                { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [this.translatedAttribute] }
            );
        }
    }, 100),

    async translatePage() {
        if (!Config.current.translationEnabled || this.isTranslating) return;

        this.isTranslating = true;
        if (this.observer) this.observer.disconnect(); // 翻譯前斷開

        try {
            // 在全頁翻譯前，可以考慮移除所有已存在的 data-translated 標記，以確保全新翻譯
            // document.querySelectorAll(`[${this.translatedAttribute}]`).forEach(el => el.removeAttribute(this.translatedAttribute));
            // 但這也可能導致不必要的重翻，需要權衡。目前假設全新頁面或手動觸發時，就是要重翻。

            await this.mergeAdjacentNodes();
            await new Promise(resolve => setTimeout(resolve, 0)); // 確保 DOM 更新
            await this.translateNodes([document.body]); // translateNodes 內部會檢查標記
        } catch (error) {
            console.error('Translation error:', error);
        } finally {
            this.isTranslating = false;
            if (this.observer) { // 檢查 observer 是否還存在
                this.observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [this.translatedAttribute] });
            }
        }
    },

    async translateNodes(nodes) {
        if (!Config.current.translationEnabled || !nodes.length) return;

        for (const node of nodes) {
            // 如果節點本身或其祖先已被標記，則跳過
            if (!node || !node.isConnected || node.hasAttribute && node.hasAttribute(this.translatedAttribute) || node.closest && node.closest(`[${this.translatedAttribute}]`)) {
                continue;
            }

            const textNodes = [];
            this.collectTextNodes(node, textNodes); // collectTextNodes 內部也需要檢查標記

            if (!textNodes.length) continue;

            const BATCH_SIZE = 100;
            for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
                const batch = textNodes.slice(i, i + BATCH_SIZE);
                const textsToTranslate = batch.map(n => n.textContent);

                try {
                    const translatedTexts = await WorkerManager.sendTranslationRequest(textsToTranslate);

                    batch.forEach((textNode, idx) => { // 這裡的 node 是 textNode
                        const orig = textNode.textContent;
                        let newText = translatedTexts[idx];
                        let finalNewText = newText;

                        // 優先嘗試對原始完整文本進行精確詞典匹配 (從 spanDict 或 Dictionary)
                        const exactMatchForOrig = spanDict.findExact(orig); // 假設 spanDict 是主要詞典

                        if (exactMatchForOrig) {
                            finalNewText = exactMatchForOrig;
                        } else {
                            // 如果 worker 未作任何更改，則嘗試模糊匹配
                            if (newText === orig) {
                                const fuzzyMatchForOrig = spanDict.findFuzzy(orig);
                                if (fuzzyMatchForOrig) {
                                    finalNewText = fuzzyMatchForOrig;
                                }
                            }
                            // else: worker 已經做了一些部分翻譯，finalNewText 此時就是 newText
                        }

                        if (finalNewText !== orig) {
                            textNode.textContent = finalNewText;
                            // 給文本節點的父元素打標記
                            if (textNode.parentNode && textNode.parentNode.nodeType === Node.ELEMENT_NODE) {
                                textNode.parentNode.setAttribute(this.translatedAttribute, 'true');
                            }
                        }
                    });
                } catch (error) {
                    console.error('Batch translation error:', error);
                }
            }
        }
    },

    collectTextNodes(node, textNodes) {
        const numericSlashRe = /^[0-9.%\/]+$/;

        // 如果節點本身或其祖先已被標記，則跳過其所有子節點
        if (node.nodeType === Node.ELEMENT_NODE && (node.hasAttribute(this.translatedAttribute) || node.closest(`[${this.translatedAttribute}]`))) {
            return;
        }
        
        if (node.nodeType === Node.TEXT_NODE) {
            const trimmed = node.textContent.trim();
            // 確保其父節點未被標記 (因為文本節點自身不能有屬性)
            if (trimmed.length > 0 && !numericSlashRe.test(trimmed) &&
                (!node.parentNode || !node.parentNode.hasAttribute || !node.parentNode.hasAttribute(this.translatedAttribute))) {
                textNodes.push(node);
            }
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE &&
            !this.skipSelector.some(selector => node.matches && node.matches(selector))) { // skipSelector 已加入 [data-translated="true"]
            node.childNodes.forEach(child => this.collectTextNodes(child, textNodes));
        }
    },

    async mergeAdjacentNodes() {
        // 在 mergeAdjacentNodes 執行前，確保 observer 已斷開
        if (this.observer) this.observer.disconnect();
        try {
            await Promise.all([
                this.mergeAdjacentRubyNodes(),
                this.mergeAdjacentSpanNodes()
            ]);
        } finally {
            // mergeAdjacentNodes 執行後，不一定立即重連 observer，
            // 通常由 translatePage 或 debouncedTranslate 的末尾統一重連。
            // 但如果 mergeAdjacentNodes 是獨立調用的，則可能需要考慮。
            // 在目前的結構下，它是由 translatePage 或 debouncedTranslate 調用，所以這裡不需要重連。
        }
    },

    async mergeAdjacentRubyNodes() {
        const rubyNodes = Array.from(document.querySelectorAll('ruby:not([data-translated="true"])')); // 直接選取未標記的
        const processed = new Set(); // processed 仍然有用，用於處理在同一次 merge 中的分組

        for (const ruby of rubyNodes) {
            if (processed.has(ruby) || !ruby.isConnected || ruby.hasAttribute(this.translatedAttribute)) continue; // 再次檢查

            // ... (收集 group 的邏輯不變) ...
            const group = [ruby];
            // ... (以下省略了 group 的收集邏輯，與您原碼一致)
            let next = ruby.nextSibling;
            while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") {
                next = next.nextSibling;
            }
            while (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === 'RUBY' && !next.hasAttribute(this.translatedAttribute)) {
                group.push(next);
                processed.add(next); // 標記為本次 merge 中已處理
                next = next.nextSibling;
                while (next && next.nodeType === Node.TEXT_NODE && next.textContent.trim() === "") {
                    next = next.nextSibling;
                }
            }


            if (group.length > 1) { // 確保 group 中所有元素都未被標記
                const combined = group.map(n => n.textContent.trim()).join(' ');
                // 注意：這裡的 Dictionary.sortedEntries 和 Dictionary.getFuzzyTranslation 應考慮是否也使用 spanDict
                const exact = Dictionary.sortedEntries.find(([k]) => k === combined); // 或 spanDict.findExact(combined)
                const translated = exact ? exact[1] : Dictionary.getFuzzyTranslation(combined); // 或 spanDict.findFuzzy(combined)

                if (translated) {
                    group.forEach((n, idx) => {
                        if (idx === 0) {
                            n.textContent = translated;
                        } else {
                            n.textContent = "";
                        }
                        n.setAttribute(this.translatedAttribute, 'true'); // 添加標記
                        processed.add(n); // 確保 processed 集合也更新
                    });
                }
            }
        }
    },

    async mergeAdjacentSpanNodes() {
        const spanNodes = Array.from(document.querySelectorAll('span:not([data-translated="true"])')); // 直接選取未標記的
        const processed = new Set(); // processed 仍然有用
        const numericSlashRe = /^[0-9.%\/]+$/;

        for (const span of spanNodes) {
            // 再次檢查，因為 spanNodes 是一開始獲取的快照，DOM 可能已變
            if (processed.has(span) || !span.isConnected || span.hasAttribute(this.translatedAttribute)) continue;

            const group = [];
            let curr = span;
            while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName === 'SPAN' && !curr.hasAttribute(this.translatedAttribute)) { // 檢查 group 中的每個元素
                const txt = curr.textContent.trim();
                if (txt) group.push(curr);
                // 不在這裡 add to processed，在 group 成功翻譯後再 add
                curr = curr.nextSibling;
                while (curr && curr.nodeType === Node.TEXT_NODE && curr.textContent.trim() === '') {
                    curr = curr.nextSibling;
                }
            }

            if (group.length < 2 || group.every(n => numericSlashRe.test(n.textContent.trim()))) {
                // 如果 group 不符合翻譯條件，但裡面的元素被掃描過了，把它們加到 processed 以免重複掃描空的 group
                 group.forEach(n => processed.add(n));
                continue;
            }

            const merged = group.map(n => n.textContent).join('')
                .replace(/\s+/g, ' ').trim();

            const exactTrans = spanDict.findExact(merged);
            const fuzzyTrans = exactTrans ? null : spanDict.findFuzzy(merged);
            const translated = exactTrans || fuzzyTrans;

            if (translated) {
                group.forEach((n, idx) => {
                    if (idx === 0) {
                        n.textContent = translated;
                    } else {
                        n.textContent = '';
                    }
                    n.setAttribute(this.translatedAttribute, 'true'); // 添加標記
                    processed.add(n); // 標記為已處理
                });
            } else {
                // 如果沒有翻譯成功，也將這些節點標記為 processed，避免在同一次 mergeAdjacentSpanNodes 調用中重複嘗試合併它們
                group.forEach(n => processed.add(n));
            }
        }
    }
};



// 網站特定處理
function handleAronaSite() {
	if (window.location.hostname === "arona.ai") {
		const meta = document.createElement("meta");
		meta.name = "google";
		meta.content = "notranslate";
		document.head.appendChild(meta);

		browser.storage.sync.get(["disableAlert"], function (result) {
			if (!result.disableAlert) {
				alert(browser.i18n.getMessage("alertMessage"));
			}
		});
	}
}

// 輔助函數
function debounce(func, delay) {
	let timeout;
	return function (...args) {
		const context = this;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), delay);
	};
}


// 初始化和消息處理
async function initialize() {
	// 處理 arona.ai 站點特定邏輯
	handleAronaSite();

	// 載入配置
	await Config.load();

	// 初始化翻譯工作器
	await WorkerManager.init();

	// 載入字典
	await Dictionary.loadLanguage(Config.current.language);

	if (spanDict) 
	{
		spanDict.updateConfig(Dictionary.data, Config.current.fuzzyMatchThreshold);
	}
	else
	{
		spanDict = new SpanDictionary(
			Dictionary.data,
			Config.current.fuzzyMatchThreshold
		);

	}

	// 初始化 DOM 翻譯器
	DOMTranslator.init();

	// 如果啟用了翻譯，立即開始翻譯
	if (Config.current.translationEnabled) {
		DOMTranslator.translatePage();
	}

	browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === 'clearCache') {
			const req = indexedDB.deleteDatabase('translation_cache');
			req.onsuccess = () => sendResponse({ success: true });
			req.onerror = () => sendResponse({ success: false });
			return true; // 告訴 Chrome：我會 async 呼叫 sendResponse
		}

		// 其餘需要 await 的邏輯，就用 IIFE 包起來
		(async () => {
			if (request.action === 'enableTranslation') {
				await Config.save('translationEnabled', true);
				DOMTranslator.translatePage();
			} else if (request.action === 'disableTranslation') {
				await Config.save('translationEnabled', false);
				location.reload();
			} else if (request.action === 'toggleDebugMode') {
				await Config.save('debugMode', request.debugMode);
				console.log(
					Config.current.debugMode
						? 'Debug Mode is ON.'
						: 'Debug Mode is OFF.'
				);
			} else if (request.action === 'setLanguage') {
				await Config.save('language', request.language);
				location.reload();
			}
			// 這些分支都不用回 sendResponse，所以不需要 return true
		})();
	});

	// DOM 加載完成後檢查並翻譯
	document.addEventListener('DOMContentLoaded', () => {
		if (Config.current.translationEnabled) {
			DOMTranslator.translatePage();
		}
	});
}


class SpanDictionary {
	constructor(entries = {}, fuzzyMatchThreshold = 0.95) {
		// 你原本用了 this.entries，但之後又用 this.data，這裡統一用 this.data
		this.data = entries;
		this.fuzzyMatchThreshold = fuzzyMatchThreshold;

		this.sortedEntries = Object.entries(this.data)
			.sort(([keyA], [keyB]) => keyB.length - keyA.length);
	}

	findExact(text) {
		return this.data[text] || null;
	}

	findFuzzy(text) {
		if (!text) return null;
		let bestScore = 0;
		let bestTrans = null;
		const lenThresh = text.length * 0.3;

		for (const [key, val] of this.sortedEntries) {
			if (
				Math.abs(key.length - text.length) > lenThresh &&
				key.length > 5 &&
				text.length > 5
			) {
				continue;
			}
			const score = this.similarity(text, key);
			if (score > bestScore) {
				bestScore = score;
				bestTrans = val;
				if (score >= 0.99) break;
			}
		}
		return bestScore >= this.fuzzyMatchThreshold ? bestTrans : null;
	}

	levenshteinDistance(a, b) {
		const m = a.length;
		const n = b.length;
		let prevRow = Array(n + 1).fill(0);
		let currentRow = Array(n + 1).fill(0);

		for (let j = 0; j <= n; j++) prevRow[j] = j;

		for (let i = 1; i <= m; i++) {
			currentRow[0] = i;
			for (let j = 1; j <= n; j++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				currentRow[j] = Math.min(
					prevRow[j] + 1,
					currentRow[j - 1] + 1,
					prevRow[j - 1] + cost
				);
			}
			[prevRow, currentRow] = [currentRow, prevRow];
		}
		return prevRow[n];
	}

	similarity(a, b) {
		if (!a || !b) return a === b ? 1 : 0;
		const maxLength = Math.max(a.length, b.length);
		if (maxLength === 0) return 1;
		const dist = this.levenshteinDistance(a, b);
		return 1 - dist / maxLength;
	}

	updateConfig(newEntries, newThreshold) {
		if (newEntries) {
			this.data = newEntries;
			this.sortedEntries = Object.entries(this.data)
				.sort(([keyA], [keyB]) => keyB.length - keyA.length);
		}
		if (newThreshold !== undefined) {
			this.fuzzyMatchThreshold = newThreshold;
		}
	}
}


initialize();