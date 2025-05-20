// content.js - 修改版

if (typeof browser === 'undefined' || !browser) {
	var browser = chrome;
}

// spanDict 會在 initialize 中被正確初始化
let spanDict;
let _skipInitialMutations = true;
const Config = { // ... (Config 物件保持不變) ...
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

const Dictionary = { // ... (Dictionary 物件保持不變，確保它能正確載入數據到 Dictionary.data) ...
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
			if (Math.abs(key.length - text.length) > lenThresh && key.length > 5 && text.length > 5) continue; // 增加長度判斷以優化
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
		if (!a || !b) return (a === b) ? 1 : 0; // 處理空字串和 undefined
		const maxLength = Math.max(a.length, b.length);
		if (maxLength === 0) return 1;
		const dist = this.levenshteinDistance(a, b);
		return 1 - dist / maxLength;
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

const WorkerManager = { // ... (WorkerManager 物件保持不變) ...
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
				// 可以考慮更穩健的重試機制或錯誤回饋
				// setTimeout(() => this.init(), 5000); // 避免無限重試
			};


			this.worker.postMessage({ action: "init" });


			return new Promise((resolve, reject) => {
				let retries = 0;
				const maxRetries = 10; // 最多重試10次 (共1秒)
				const checkReady = setInterval(() => {
					if (this.isReady) {
						clearInterval(checkReady);
						resolve(true);
					} else if (retries >= maxRetries) {
						clearInterval(checkReady);
						console.error("Worker failed to become ready.");
						reject(false);
					}
					retries++;
				}, 100);
			});
		} catch (err) {
			console.error('Failed to load Worker:', err);
			return false;
		}
	},

	async sendTranslationRequest(texts) {
		if (!this.worker || !this.isReady) {
			console.warn("Worker not ready or not initialized, returning original texts.");
			return texts;
		}

		const requestId = this.nextRequestId++;

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(requestId, { resolve, reject });

			// 增加超時處理
			const timeoutId = setTimeout(() => {
				if (this.pendingRequests.has(requestId)) {
					this.pendingRequests.delete(requestId);
					console.warn(`Translation request ${requestId} timed out.`);
					resolve(texts); // 超時則返回原文
				}
			}, 5000); // 5秒超時


			this.worker.postMessage({
				action: "translate",
				requestId,
				texts,
				patterns: Dictionary.compiledPatterns.map(p => ({ //確保 Dictionary.compiledPatterns 已準備好
					pattern: p.pattern.source,
					replacement: p.replacement
				}))
			});
			// 在 resolve 中清除超時
			const originalResolve = resolve;
			this.pendingRequests.get(requestId).resolve = (value) => {
				clearTimeout(timeoutId);
				originalResolve(value);
			};
		});
	}
};

const DOMTranslator = {
	isTranslating: false,
	observer: null,
	translatedAttribute: 'data-translated-by-extension', // 使用更明確的屬性名，避免衝突
	skipSelector: [
	],

	init() {
		// 動態將 translatedAttribute 添加到 skipSelector
		this.skipSelector.push(`[${this.translatedAttribute}="true"]`);

		const observerConfig = {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true, // 需要監聽屬性變化
			attributeFilter: [this.translatedAttribute] // 特別關注我們的標記屬性
		};
		this.observer = new MutationObserver(this.handleMutations.bind(this));
		// 確保 body 存在後再 observe
		
		window.addEventListener('load', () => {
			if (document.body) {
				this.observer.observe(document.body, {
					childList: true,
					subtree: true,
					characterData: true,
					attributes: true,
					attributeFilter: [this.translatedAttribute]
				});
			}
		});
		
		const startObserving = () => {
			if (document.body) {
				this.observer.observe(document.body, {
					childList: true,
					subtree: true,
					characterData: true,
					attributes: true,
					attributeFilter: [this.translatedAttribute]
				});
			}
		};

		if (document.readyState === 'interactive' || document.readyState === 'complete') {
			startObserving();
		} else {
			window.addEventListener('DOMContentLoaded', startObserving);
		}

		document.body.addEventListener('vaadin-overlay-open', () => {
			// 延遲等 overlay 內容渲染完畢
			setTimeout(() => this.translatePage(), 50);
		});


		document.body.addEventListener('click', e => {
			if (e.target.closest('vaadin-select') || e.target.closest('my-custom-select')) {
				setTimeout(() => this.translatePage(), 100);
			}
		});


		const origAttach = Element.prototype.attachShadow;
		Element.prototype.attachShadow = function (init) {
			const root = origAttach.call(this, init);
			// 同步把 shadowRoot 加入 observer
			DOMTranslator.observer.observe(root, { childList: true, subtree: true, characterData: true });
			return root;
		};



	},

	handleMutations(mutations) {
		if (_skipInitialMutations) {
			return;
		}
		if (!Config.current.translationEnabled || this.isTranslating) return;

		const changedNodes = new Set();
		let relevantMutationDetected = false;

		for (const mutation of mutations) {
			// 如果是我們自己添加或移除 data-translated 屬性造成的變動，通常可以忽略
			// 以避免無限循環。但如果外部腳本移除了我們的標記，則可能需要重新翻譯。
			if (mutation.type === 'attributes' && mutation.attributeName === this.translatedAttribute) {
				// 如果是外部移除了標記 (value is null)，則將其加入 changedNodes
				if (mutation.target.getAttribute(this.translatedAttribute) === null) {
					// 檢查其父級是否也已經有標記，避免重複添加
					if (!mutation.target.closest(`[${this.translatedAttribute}="true"]`)) {
						changedNodes.add(mutation.target);
						relevantMutationDetected = true;
					}
				}
				continue; // 大部分情況下忽略我們自己標記的變化
			}

			if (mutation.type === 'characterData') {
				const parent = mutation.target.parentNode;
				// 只有當文本節點的父節點未被標記時，才認為是需要處理的變動
				if (parent && parent.nodeType === Node.ELEMENT_NODE && !parent.hasAttribute(this.translatedAttribute)) {
					changedNodes.add(parent);
					relevantMutationDetected = true;
				}
			} else if (mutation.type === 'childList') {
				mutation.addedNodes.forEach(node => {
					// 只處理未被標記的已添加元素節點或其父節點未被標記的文本節點
					if (node.nodeType === Node.ELEMENT_NODE && !node.hasAttribute(this.translatedAttribute) && !node.closest(`[${this.translatedAttribute}="true"]`)) {
						changedNodes.add(node);
						relevantMutationDetected = true;
					} else if (node.nodeType === Node.TEXT_NODE) {
						const parent = node.parentNode;
						if (parent && parent.nodeType === Node.ELEMENT_NODE && !parent.hasAttribute(this.translatedAttribute) && !parent.closest(`[${this.translatedAttribute}="true"]`)) {
							changedNodes.add(parent);
							relevantMutationDetected = true;
						}
					}
				});
			}
		}

		if (relevantMutationDetected && changedNodes.size > 0) {
			if (this.observer) this.observer.disconnect();
			this.debouncedTranslate(Array.from(changedNodes));
		} else if (!relevantMutationDetected && this.observer && !this.isTranslating) {
			// 如果沒有檢測到需要翻譯的相關變動 (例如只有我們自己移除標記後又加上)，確保 observer 仍然連接
			// 但要小心這種情況，通常 debouncedTranslate 末尾會重連
		}
	},

	debouncedTranslate: debounce(async function (nodes) {
		if (Config.current.debugMode) console.log('[DEBUG] Debounced translate triggered for nodes:', nodes);
		if (this.isTranslating) return; // 避免重入
		this.isTranslating = true;

		try {
			// mergeAdjacentNodes 應該在 translateNodes 之前，並且只處理未標記的節點
			await this.mergeAdjacentNodes(); // merge 內部已處理標記檢查
			// 過濾掉在 merge 過程中可能已被標記的節點，以及其父級已被標記的節點
			const nodesToTranslate = nodes.filter(node =>
				node.isConnected &&
				(!node.hasAttribute || !node.hasAttribute(this.translatedAttribute)) &&
				(!node.closest || !node.closest(`[${this.translatedAttribute}="true"]`))
			);
			if (nodesToTranslate.length > 0) {
				await this.translateNodes(nodesToTranslate);
			}
		} finally {
			this.isTranslating = false;
			if (this.observer && document.body) {
				this.observer.observe(
					document.body,
					{ childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [this.translatedAttribute] }
				);
			}
		}
	}, 100),

	async translatePage() {
		if (!Config.current.translationEnabled || this.isTranslating) return;


		this.isTranslating = true;
		if (this.observer) this.observer.disconnect();

		try {
			// 可選：在全頁翻譯前，移除所有舊標記。
			document.querySelectorAll(`[${this.translatedAttribute}]`).forEach(el => el.removeAttribute(this.translatedAttribute));

			await this.mergeAdjacentNodes(); // 先 Span 後 Ruby
			await new Promise(resolve => setTimeout(resolve, 0)); // DOM 更新緩衝
			await this.translateNodes([document.body]);
		} catch (error) {
			console.error('Translation error:', error);
		} finally {
			this.isTranslating = false;
			if (this.observer && document.body) {
				this.observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [this.translatedAttribute] });
			}
		}
	},

	async translateNodes(nodes) {
		if (!Config.current.translationEnabled || !nodes || !nodes.length) return;

		for (const node of nodes) {
			// 防禦性檢查，確保節點存在且已連接
			if (!node || !node.isConnected) continue;

			// 如果節點本身是元素且已被標記，或其祖先已被標記，則跳過
			if (node.nodeType === Node.ELEMENT_NODE && (node.hasAttribute(this.translatedAttribute) || node.closest(`[${this.translatedAttribute}="true"]`))) {
				continue;
			}
			// 如果節點是文本節點，檢查其父元素是否已被標記
			if (node.nodeType === Node.TEXT_NODE && node.parentNode && node.parentNode.nodeType === Node.ELEMENT_NODE && (node.parentNode.hasAttribute(this.translatedAttribute) || node.parentNode.closest(`[${this.translatedAttribute}="true"]`))) {
				continue;
			}


			const textNodes = [];
			this.collectTextNodes(node, textNodes);

			if (!textNodes.length) continue;

			const BATCH_SIZE = 100;
			for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
				const batch = textNodes.slice(i, i + BATCH_SIZE).filter(tn => tn.parentNode); // 確保文本節點有父節點
				if (!batch.length) continue;

				const textsToTranslate = batch.map(n => n.textContent);

				try {
					const translatedTexts = await WorkerManager.sendTranslationRequest(textsToTranslate);
					if (!translatedTexts || translatedTexts.length !== batch.length) {
						console.error("Translated texts mismatch with batch size or undefined.");
						continue;
					}

					batch.forEach((textNode, idx) => {
						const orig = textNode.textContent;
						let newText = translatedTexts[idx];
						let finalNewText = newText;

						// 確保 newText 不是 undefined 或 null
						if (typeof newText !== 'string' && newText !== null && newText !== undefined) {
							if (Config.current.debugMode) console.warn(`[DEBUG] Received non-string translation for: "${orig}", got:`, newText);
							finalNewText = orig; // 保守處理，使用原文
						}


						const exactMatchForOrig = spanDict.findExact(orig);
						if (exactMatchForOrig) {
							finalNewText = exactMatchForOrig;
						} else {
							if (newText === orig) { // Worker 未做任何更改
								const fuzzyMatchForOrig = spanDict.findFuzzy(orig);
								if (fuzzyMatchForOrig) {
									finalNewText = fuzzyMatchForOrig;
								}
							}
							// else: worker 已做部分翻譯，finalNewText 目前是 newText
						}

						if (finalNewText !== orig) {
							textNode.textContent = finalNewText;
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

		if (node.nodeType === Node.ELEMENT_NODE) {
			// 如果元素本身已被標記，或其祖先已被標記，則不收集其下的任何文本節點
			if (node.hasAttribute(this.translatedAttribute) || node.closest(`[${this.translatedAttribute}="true"]`)) {
				return;
			}
			// 如果是 skipSelector 中的元素，也不收集
			if (this.skipSelector.some(selector => node.matches && node.matches(selector))) {
				return;
			}
			// 遍歷子節點
			node.childNodes.forEach(child => this.collectTextNodes(child, textNodes));
			return;
		}

		if (node.nodeType === Node.TEXT_NODE) {
			const trimmed = node.textContent.trim();
			// 確保文本節點的父節點未被標記
			const parent = node.parentNode;
			if (trimmed.length > 0 && !numericSlashRe.test(trimmed) &&
				parent && parent.nodeType === Node.ELEMENT_NODE &&
				!parent.hasAttribute(this.translatedAttribute) &&
				!parent.closest(`[${this.translatedAttribute}="true"]`)) {
				textNodes.push(node);
			}
			return;
		}
	},

	async mergeAdjacentNodes() {
		// 順序：先 Spans，再 Rubies
		if (this.observer) this.observer.disconnect(); // 斷開 observer 避免干擾
		try {
			await this.mergeAdjacentSpanNodes();
			// 可以考慮在兩者之間加入一個短暫的延遲或 DOM 更新等待，如果它們之間有依賴
			// await new Promise(resolve => setTimeout(resolve, 0));
			await this.mergeAdjacentRubyNodes();
		} finally {
			// 注意：不在此處重連 observer，由調用 mergeAdjacentNodes 的外層函數
			// (如 translatePage 或 debouncedTranslate) 在其操作的最後統一重連。
		}
	},

	async mergeAdjacentRubyNodes() {
		const rubyNodes = Array.from(document.querySelectorAll(`ruby:not([${this.translatedAttribute}="true"])`));
		const processedInThisRun = new Set();

		for (const ruby of rubyNodes) {
			if (processedInThisRun.has(ruby) || !ruby.isConnected || ruby.hasAttribute(this.translatedAttribute)) continue;

			const group = [];
			let curr = ruby;
			while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName === 'RUBY' && !curr.hasAttribute(this.translatedAttribute)) {
				group.push(curr);
				// 先不加入 processedInThisRun，等 group 處理完畢
				let nextSibling = curr.nextSibling;
				while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent.trim() === '') {
					nextSibling = nextSibling.nextSibling;
				}
				curr = (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.tagName === 'RUBY') ? nextSibling : null;
			}

			if (group.length < 2) { // merge 是為了合併多個，所以至少需要2個
				group.forEach(n => processedInThisRun.add(n)); // 標記已檢查，避免在本輪中重複作為 group 開頭
				continue;
			}

			group.forEach(n => processedInThisRun.add(n)); // 將 group 內所有元素標記為本輪已處理

			const combined = group.map(n => n.textContent.trim()).join(' ');
			// 使用 spanDict 保持一致性，因為 spanDict 是基於 Dictionary.data 初始化的
			const exactTrans = spanDict.findExact(combined);
			const fuzzyTrans = exactTrans ? null : spanDict.findFuzzy(combined);
			const translated = exactTrans || fuzzyTrans;

			if (translated) {
				group.forEach((n, idx) => {
					if (idx === 0) {
						n.textContent = translated;
					} else {
						n.textContent = ""; // 清空其他 ruby 節點
					}
					n.setAttribute(this.translatedAttribute, 'true');
				});
			}
		}
	},

	async mergeAdjacentSpanNodes() {
		const spanNodes = Array.from(document.querySelectorAll(`span:not([${this.translatedAttribute}="true"])`));
		const processedInThisRun = new Set(); // 用於追蹤在本輪 mergeAdjacentSpanNodes 調用中已處理的節點
		const numericSlashRe = /^[0-9.%\/]+$/;

		for (const span of spanNodes) {
			// 如果節點已在本輪處理過，或者已不在DOM中，或者已被標記為已翻譯，則跳過
			if (processedInThisRun.has(span) || !span.isConnected || span.hasAttribute(this.translatedAttribute)) continue;

			const group = [];
			let curr = span;
			// 收集連續的、未被標記的 SPAN 節點
			while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName === 'SPAN' && !curr.hasAttribute(this.translatedAttribute)) {
				const txt = curr.textContent.trim();
				if (txt) { // 只添加有實質內容的 span
					group.push(curr);
				}
				// 先不將 curr 加入 processedInThisRun，等 group 形成並處理後再決定
				let nextSibling = curr.nextSibling;
				// 跳過 SPAN 之間可能存在的空白文本節點
				while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent.trim() === '') {
					nextSibling = nextSibling.nextSibling;
				}
				curr = (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.tagName === 'SPAN') ? nextSibling : null;
			}

			// 如果 group 不符合翻譯條件 (少于2个，或全是數字符號)
			if (group.length < 2 || group.every(n => numericSlashRe.test(n.textContent.trim()))) {
				group.forEach(n => processedInThisRun.add(n)); // 這些節點在本輪中不再作為新 group 的起點
				continue;
			}

			// 將 group 內所有元素標記為本輪已處理，避免它們在後續循環中成為新 group 的起點
			group.forEach(n => processedInThisRun.add(n));

			const merged = group.map(n => n.textContent).join('') // 保持原樣，不 trim 各部分
				.replace(/\s+/g, ' ').trim(); // 最後整體清理空格

			const exactTrans = spanDict.findExact(merged);
			const fuzzyTrans = exactTrans ? null : spanDict.findFuzzy(merged);
			const translated = exactTrans || fuzzyTrans;

			if (translated) {
				group.forEach((n, idx) => {
					if (idx === 0) {
						n.textContent = translated;
					} else {
						n.textContent = ''; // 清空其他 span 的內容
					}
					n.setAttribute(this.translatedAttribute, 'true'); // 為成功翻譯的組打上標記
				});
			}
			// 注意：即使沒有翻譯成功，processedInThisRun 也已經包含了 group 中的節點，
			// 所以它們在本輪 mergeAdjacentSpanNodes 的後續循環中不會被重新用作新 group 的開頭。
			// data-translated 標記則用於跨越多個翻譯周期的持久化。
		}
	}
};

function handleAronaSite() { // ... (handleAronaSite 保持不變) ...
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

function debounce(func, delay) { // ... (debounce 保持不變) ...
	let timeout;
	return function (...args) {
		const context = this;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), delay);
	};
}

async function initialize() { // ... (initialize 保持不變，除了 spanDict 初始化位置) ...
	handleAronaSite();
	await Config.load();
	await WorkerManager.init();
	await Dictionary.loadLanguage(Config.current.language);

	// spanDict 初始化移到這裡，確保 Dictionary.data 和 Config.current 已載入
	if (spanDict) {
		spanDict.updateConfig(Dictionary.data, Config.current.fuzzyMatchThreshold);
	} else {
		spanDict = new SpanDictionary(
			Dictionary.data,
			Config.current.fuzzyMatchThreshold
		);
	}

	DOMTranslator.init();

	if (Config.current.translationEnabled) {
		DOMTranslator.translatePage();
		window.addEventListener('load', () => {
			DOMTranslator.translatePage();
		});
		[300, 800, 1500].forEach(delay =>
			setTimeout(() => {
				if (Config.current.translationEnabled) {
					DOMTranslator.translatePage();
				}
			}, delay)
		);
	}

	window.addEventListener('load', () => {
		if (Config.current.translationEnabled) {
			DOMTranslator.translatePage();
		}
		_skipInitialMutations = false;
	});

	if (document.readyState === 'interactive' || document.readyState === 'complete') {
		_skipInitialMutations = false;
	}

	browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.action === 'clearCache') {
			const req = indexedDB.deleteDatabase('translation_cache');
			req.onsuccess = () => {
				if (spanDict && spanDict.data) { // 清理内存中的 spanDict.data
					spanDict.updateConfig({}, Config.current.fuzzyMatchThreshold);
				}
				Dictionary.data = {}; // 清理内存中的 Dictionary.data
				Dictionary.sortedEntries = [];
				Dictionary.compiledPatterns = [];
				Dictionary.loadedFiles = [];
				sendResponse({ success: true });
			};
			req.onerror = () => sendResponse({ success: false });
			return true;
		}

		(async () => {
			if (request.action === 'enableTranslation') {
				await Config.save('translationEnabled', true);
				if (!DOMTranslator.observer) DOMTranslator.init(); // 確保 observer 已初始化
				DOMTranslator.translatePage();
			} else if (request.action === 'disableTranslation') {
				await Config.save('translationEnabled', false);
				if (DOMTranslator.observer) {
					DOMTranslator.observer.disconnect();
					DOMTranslator.observer = null; // 釋放 observer
				}
				location.reload(); // 重載以清除已翻譯內容和狀態
			} else if (request.action === 'toggleDebugMode') {
				await Config.save('debugMode', !Config.current.debugMode); // 直接切換狀態
				console.log(Config.current.debugMode ? 'Debug Mode is ON.' : 'Debug Mode is OFF.');
			} else if (request.action === 'setLanguage') {
				await Config.save('language', request.language);
				location.reload(); // 重新載入以應用新語言
			}
		})();
	});

	document.addEventListener('DOMContentLoaded', () => {
		if (Config.current.translationEnabled && !DOMTranslator.isTranslating) { // 避免在 initialize 中的 translatePage 未完成時重複調用
			DOMTranslator.translatePage();
		}
	});
}

class SpanDictionary { // ... (SpanDictionary class 保持不變) ...
	constructor(entries = {}, fuzzyMatchThreshold = 0.95) {
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

// 啟動初始化
initialize();
