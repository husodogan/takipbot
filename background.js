// =============================================
// AMAZON FİYAT TAKİP - BACKGROUND SERVICE WORKER (V3.1 - SAFE)
// Anti-Ban Korumalı Versiyon + CAPTCHA İyileştirmesi
// =============================================

const ICON_URL = chrome.runtime.getURL('icon.png');

// ✅ SAFE MODE: Anti-Ban Ayarları
const ANTI_BAN = {
    minCheckInterval: 1,             // Kullanıcı kararı (uyarı ile)
    pageLoadWait: 5000,
    randomDelayMin: 10000,
    randomDelayMax: 40000,
    maxDailyChecks: 80,
    maxRetries: 2,
    quietHours: { start: 0, end: 7 },
    userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ]
};

// ✅ Keep-Alive Alarm
const KEEP_ALIVE_ALARM = 'keepAliveAlarm';

chrome.alarms.create(KEEP_ALIVE_ALARM, {
    periodInMinutes: 0.4
});

// =============================================
// YAŞAM DÖNGÜSÜ
// =============================================

chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 Amazon Fiyat Takipçisi V3.1 (Safe Mode) yüklendi');
    loadAndStartTracking();
    createOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Sistem başlatıldı, takipler yükleniyor...');
    loadAndStartTracking();
    createOffscreenDocument();
});

// ✅ Offscreen document oluştur
async function createOffscreenDocument() {
    try {
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });
        if (existingContexts.length > 0) return;

        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['BLOBS'],
            justification: 'Keep-alive için gerekli'
        });
        console.log('✅ Offscreen document oluşturuldu');
    } catch (e) {
        // Zaten varsa hata vermesi normal
    }
}

// =============================================
// MESAJ DİNLEYİCİ
// =============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'keepAlive') {
        sendResponse({ alive: true, timestamp: Date.now() });
        return true;
    }
    
    if (request.action === 'startTracking') {
        startProductTracking(request.product);
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'stopTracking') {
        stopProductTracking(request.productId);
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === 'updateSettings') {
        console.log('⚙️ Ayarlar güncellendi:', request.settings);
        sendResponse({ success: true });
        return true;
    }
    
    return true;
});

// =============================================
// ALARM SİSTEMİ
// =============================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === KEEP_ALIVE_ALARM) {
        console.log('💓 Keep-alive:', new Date().toLocaleTimeString('tr-TR'));
        await createOffscreenDocument();
        return;
    }

    if (alarm.name.startsWith('track_')) {
        const productId = alarm.name.replace('track_', '');
        const result = await chrome.storage.local.get(['trackedProducts']);
        const products = result.trackedProducts || [];
        const product = products.find(p => p.id === productId);
        
        if (product && product.status === 'active') {
            console.log(`⏰ Kontrol ediliyor: ${product.title.substring(0, 30)}...`);
            await safeCheckPrice(product);
        } else {
            stopProductTracking(productId);
        }
    }
});

// =============================================
// TAKİP YÖNETİMİ
// =============================================

async function loadAndStartTracking() {
    try {
        const result = await chrome.storage.local.get(['trackedProducts']);
        const products = result.trackedProducts || [];
        
        console.log(`📦 ${products.length} ürün yüklendi`);
        
        for (let product of products) {
            if (product.status === 'active') {
                startProductTracking(product);
            }
        }
    } catch (error) {
        console.error('❌ Takip yükleme hatası:', error);
    }
}

function startProductTracking(product) {
    stopProductTracking(product.id);
    
    const variantText = product.variant ? ` (${product.variant})` : '';
    console.log(`✅ Takip başladı: ${product.title.substring(0, 30)}${variantText}`);
    
    // ✅ Kullanıcının seçtiği aralığı kullan
    const intervalMinutes = Math.max(product.checkInterval || 15, 1);
    
    // ⚠️ Sadece uyarı (zorlamaz)
    if (product.checkInterval < 15) {
        console.warn(`⚠️ DİKKAT: ${product.checkInterval} dakika çok kısa - ban riski var!`);
    }
    
    setTimeout(() => safeCheckPrice(product), 3000);
    
    chrome.alarms.create(`track_${product.id}`, {
        delayInMinutes: intervalMinutes,
        periodInMinutes: intervalMinutes
    });
}

function stopProductTracking(productId) {
    chrome.alarms.clear(`track_${productId}`);
    console.log(`⏹️ Takip durduruldu: ${productId}`);
}

// =============================================
// GÜVENLİ FİYAT KONTROLÜ
// =============================================

async function safeCheckPrice(product) {
    try {
        const result = await chrome.storage.local.get(['appSettings']);
        const settings = result.appSettings || {
            nightMode: true,
            dailyLimit: 80,
            randomDelay: true
        };
        
        // Gece saati kontrolü
        if (settings.nightMode) {
            const hour = new Date().getHours();
            if (hour >= ANTI_BAN.quietHours.start && hour < ANTI_BAN.quietHours.end) {
                console.log(`🌙 Gece modu aktif (${hour}:00) - kontrol atlandı`);
                return;
            }
        }
        
        // Günlük limit kontrolü
        const today = new Date().toDateString();
        const checksResult = await chrome.storage.local.get(['dailyChecks']);
        let checks = checksResult.dailyChecks || { date: today, count: 0 };
        
        if (checks.date !== today) {
            checks.date = today;
            checks.count = 0;
        }
        
        if (checks.count >= settings.dailyLimit) {
            console.log(`⛔ Günlük limit doldu (${checks.count}/${settings.dailyLimit})`);
            return;
        }
        
        checks.count++;
        await chrome.storage.local.set({ dailyChecks: checks });
        
        // Rastgele gecikme
        if (settings.randomDelay) {
            const randomDelay = Math.floor(
                Math.random() * (ANTI_BAN.randomDelayMax - ANTI_BAN.randomDelayMin) + 
                ANTI_BAN.randomDelayMin
            );
            console.log(`⏳ ${Math.floor(randomDelay/1000)}sn rastgele bekleme...`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
        }
        
        await checkProductPriceSafe(product);
        
    } catch (error) {
        console.error('❌ Güvenli kontrol hatası:', error);
    }
}

// ✅ Fetch ile fiyat kontrolü
async function checkProductPriceSafe(product) {
    try {
        const userAgent = ANTI_BAN.userAgents[
            Math.floor(Math.random() * ANTI_BAN.userAgents.length)
        ];
        
        console.log(`🔍 Fiyat kontrol ediliyor: ${product.title.substring(0, 30)}...`);
        
        const response = await fetch(product.url, {
            method: 'GET',
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 503) {
                console.warn('⚠️ Amazon bot koruması aktif (503) - kontrol atlandı');
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // ✅ CAPTCHA kontrolü (iyileştirilmiş)
        if (html.toLowerCase().includes('captcha') || 
            html.toLowerCase().includes('robot') || 
            html.includes('Type the characters you see in this image')) {
            
            console.warn(`🤖 CAPTCHA tespit edildi: ${product.title.substring(0, 30)}`);
            
            // Bildirim gönder
            chrome.notifications.create(`captcha-${product.id}`, {
                type: 'basic',
                iconUrl: ICON_URL,
                title: '🤖 CAPTCHA Tespit Edildi',
                message: `Amazon güvenlik kontrolü istiyor.\n\n${product.title.substring(0, 50)}...\n\nLütfen sayfayı açıp CAPTCHA'yı çözün.`,
                buttons: [{ title: 'Sayfayı Aç' }],
                priority: 2,
                requireInteraction: true
            });
            
            // Notification verisini sakla
            await chrome.storage.local.set({
                [`notification_captcha-${product.id}`]: { productUrl: product.url }
            });
            
            return;
        }
        
        const priceData = parsePriceFromHTML(html, product.includeUsed);
        
        if (!priceData.price || priceData.price <= 0) {
            console.warn('⚠️ Fiyat bulunamadı');
            return;
        }
        
        console.log(`💰 Fiyat: ${priceData.price} TL (Kaynak: ${priceData.source})`);
        
        await updateProductPrice(product.id, priceData.price, priceData.source);
        
        if (priceData.price <= product.targetPrice) {
            console.log(`🎉 HEDEF FİYATA ULAŞILDI!`);
            await handlePriceTarget(product, priceData.price, priceData.source);
        }
        
    } catch (error) {
        console.error(`❌ Fiyat kontrol hatası: ${error.message}`);
        
        if (error.message.includes('Failed to fetch')) {
            console.log('🔄 Fallback: Sekme ile kontrol ediliyor...');
            await checkProductPriceWithTab(product);
        }
    }
}

function parsePriceFromHTML(html, includeUsed = false) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let bestPrice = 0;
    let source = 'normal';
    
    const selectors = [
        '.a-price[data-a-color="price"] .a-offscreen',
        '.a-price .a-offscreen',
        '.a-price-whole',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-color-price'
    ];
    
    for (let selector of selectors) {
        const elem = doc.querySelector(selector);
        if (elem) {
            const text = elem.textContent || elem.getAttribute('content') || '';
            const price = parseFloat(
                text.replace(/[^\d,]/g, '').replace(',', '.')
            );
            if (price > 0) {
                bestPrice = price;
                break;
            }
        }
    }
    
    if (includeUsed) {
        const usedSelectors = [
            '#usedAccordionRow .a-price .a-offscreen',
            '#usedBuySection .a-price .a-offscreen'
        ];
        
        for (let selector of usedSelectors) {
            const elem = doc.querySelector(selector);
            if (elem) {
                const text = elem.textContent;
                const usedPrice = parseFloat(
                    text.replace(/[^\d,]/g, '').replace(',', '.')
                );
                
                if (usedPrice > 0 && (bestPrice === 0 || usedPrice < bestPrice)) {
                    bestPrice = usedPrice;
                    source = 'used';
                    console.log(`♻️ 2. El fiyat daha ucuz: ${usedPrice} TL`);
                }
            }
        }
    }
    
    return { price: bestPrice, source };
}

async function checkProductPriceWithTab(product) {
    let tabId = null;
    
    try {
        const tab = await chrome.tabs.create({ 
            url: product.url, 
            active: false 
        });
        tabId = tab.id;
        
        await waitForTabLoad(tabId);
        
        const response = await sendMessageToTab(tabId, { 
            action: 'getProductInfo' 
        });
        
        if (!response || !response.success) {
            console.warn('⚠️ Sekme ile de fiyat alınamadı');
            await closeTab(tabId);
            return;
        }
        
        let finalPrice = response.data.price;
        let source = 'normal';
        
        if (product.includeUsed && response.data.usedPrice && 
            response.data.usedPrice > 0 && response.data.usedPrice < finalPrice) {
            finalPrice = response.data.usedPrice;
            source = 'used';
        }
        
        await updateProductPrice(product.id, finalPrice, source);
        
        if (finalPrice > 0 && finalPrice <= product.targetPrice) {
            await handlePriceTarget(product, finalPrice, source);
        }
        
        await closeTab(tabId);
        
    } catch (error) {
        console.error('❌ Tab kontrol hatası:', error);
        if (tabId) await closeTab(tabId);
    }
}

// =============================================
// YARDIMCI FONKSİYONLAR
// =============================================

function waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
        let timeout;
        
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                clearTimeout(timeout);
                setTimeout(() => resolve(), ANTI_BAN.pageLoadWait);
            }
        };
        
        chrome.tabs.onUpdated.addListener(listener);
        
        timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error('Tab yükleme timeout'));
        }, 30000);
    });
}

function sendMessageToTab(tabId, message) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Mesaj hatası:', chrome.runtime.lastError.message);
                resolve(null);
            } else {
                resolve(response);
            }
        });
    });
}

async function closeTab(tabId) {
    try {
        if (tabId) {
            await chrome.tabs.remove(tabId);
        }
    } catch (error) {
        console.warn('⚠️ Sekme kapatma hatası:', error.message);
    }
}

async function updateProductPrice(productId, newPrice, source = 'normal') {
    try {
        const result = await chrome.storage.local.get(['trackedProducts']);
        const products = result.trackedProducts || [];
        const productIndex = products.findIndex(p => p.id === productId);
        
        if (productIndex !== -1) {
            products[productIndex].currentPrice = newPrice;
            products[productIndex].priceSource = source;
            products[productIndex].lastChecked = new Date().toISOString();
            
            if (!products[productIndex].priceHistory) {
                products[productIndex].priceHistory = [];
            }
            products[productIndex].priceHistory.unshift({
                price: newPrice,
                source: source,
                date: new Date().toISOString()
            });
            products[productIndex].priceHistory = 
                products[productIndex].priceHistory.slice(0, 20);
            
            await chrome.storage.local.set({ trackedProducts: products });
        }
    } catch (error) {
        console.error('❌ Fiyat güncelleme hatası:', error);
    }
}

// =============================================
// HEDEF FİYAT İŞLEMLERİ
// =============================================

async function handlePriceTarget(product, currentPrice, source) {
    stopProductTracking(product.id);
    
    try {
        const result = await chrome.storage.local.get(['trackedProducts']);
        const products = result.trackedProducts || [];
        const productIndex = products.findIndex(p => p.id === product.id);
        
        if (productIndex !== -1) {
            products[productIndex].status = 'triggered';
            products[productIndex].triggeredPrice = currentPrice;
            products[productIndex].triggeredSource = source;
            products[productIndex].triggeredAt = new Date().toISOString();
            await chrome.storage.local.set({ trackedProducts: products });
        }
        
        const tab = await chrome.tabs.create({ 
            url: product.url, 
            active: true 
        });
        
        const sourceText = source === 'used' ? ' ♻️ 2.El' : '';
        const notifId = `price-${product.id}-${Date.now()}`;
        
        chrome.notifications.create(notifId, {
            type: 'basic',
            iconUrl: ICON_URL,
            title: '🎯 Hedef Fiyata Ulaşıldı!',
            message: `${product.title.substring(0, 60)}...\n\n💰 Güncel: ${currentPrice} TL${sourceText}\n🎯 Hedef: ${product.targetPrice} TL\n\n${product.autoOrder ? '⚠️ Lütfen manuel olarak sepete ekleyin!' : 'Ürün sayfası açıldı'}`,
            buttons: product.autoOrder ? [
                { title: '🛒 Sepete Git' }
            ] : undefined,
            priority: 2,
            requireInteraction: true
        });
        
        await chrome.storage.local.set({
            [`notification_${notifId}`]: {
                productUrl: product.url,
                tabId: tab.id
            }
        });
        
    } catch (error) {
        console.error('❌ Hedef fiyat işleme hatası:', error);
    }
}

// ✅ Bildirim butonuna tıklama
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
        const key = `notification_${notificationId}`;
        const result = await chrome.storage.local.get([key]);
        const data = result[key];
        
        if (data) {
            if (data.tabId) {
                try {
                    await chrome.tabs.update(data.tabId, { active: true });
                } catch {
                    chrome.tabs.create({ url: data.productUrl || 'https://www.amazon.com.tr/gp/cart/view.html' });
                }
            } else if (data.productUrl) {
                chrome.tabs.create({ url: data.productUrl });
            }
        }
        
        chrome.storage.local.remove([key]);
    }
    
    chrome.notifications.clear(notificationId);
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
    const key = `notification_${notificationId}`;
    const result = await chrome.storage.local.get([key]);
    const data = result[key];
    
    if (data && data.productUrl) {
        chrome.tabs.create({ url: data.productUrl });
    }
    
    chrome.notifications.clear(notificationId);
    chrome.storage.local.remove([key]);
});

console.log('✅ Background script hazır (Safe Mode + CAPTCHA Handler aktif)');
