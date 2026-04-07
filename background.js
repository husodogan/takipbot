// =============================================
// AMAZON FİYAT TAKİP - BACKGROUND SERVICE WORKER (V3.0 - SAFE)
// Anti-Ban Korumalı Versiyon
// =============================================

const ICON_URL = chrome.runtime.getURL('icon.png');

// ✅ SAFE MODE: Anti-Ban Ayarları
const ANTI_BAN = {
    minCheckInterval: 15,        // Minimum 15 dakika
    pageLoadWait: 5000,          // Sayfa yükleme bekleme
    randomDelayMin: 10000,       // Min rastgele gecikme (10sn)
    randomDelayMax: 40000,       // Max rastgele gecikme (40sn)
    maxDailyChecks: 80,          // Günlük max kontrol sayısı
    maxRetries: 2,               // Max yeniden deneme
    quietHours: { start: 0, end: 7 },  // Gece modu (00:00-07:00)
    userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ]
};

// ✅ Keep-Alive Alarm
const KEEP_ALIVE_ALARM = 'keepAliveAlarm';

chrome.alarms.create(KEEP_ALIVE_ALARM, {
    periodInMinutes: 0.4 // 24 saniyede bir
});

// =============================================
// YAŞAM DÖNGÜSÜ
// =============================================

chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 Amazon Fiyat Takipçisi V3.0 (Safe Mode) yüklendi');
    loadAndStartTracking();
    createOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Sistem başlatıldı, takipler yükleniyor...');
    loadAndStartTracking();
    createOffscreenDocument();
});

// ✅ Offscreen document oluştur (keep-alive için)
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
        // Offscreen zaten varsa hata vermesi normal
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
    
    // ✅ YENİ: Ayarları güncelle
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
    // Keep alive alarmı
    if (alarm.name === KEEP_ALIVE_ALARM) {
        console.log('💓 Keep-alive:', new Date().toLocaleTimeString('tr-TR'));
        await createOffscreenDocument();
        return;
    }

    // Ürün takip alarmları
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
    // Eski alarmı temizle
    stopProductTracking(product.id);
    
    const variantText = product.variant ? ` (${product.variant})` : '';
    console.log(`✅ Takip başladı: ${product.title.substring(0, 30)}${variantText}`);
    
    // ✅ Minimum aralık kontrolü
    const intervalMinutes = Math.max(
        product.checkInterval || 15, 
        ANTI_BAN.minCheckInterval
    );
    
    if (product.checkInterval < ANTI_BAN.minCheckInterval) {
        console.warn(`⚠️ Kontrol aralığı ${ANTI_BAN.minCheckInterval} dakikaya yükseltildi (Ban koruması)`);
    }
    
    // İlk kontrolü hemen yap
    setTimeout(() => safeCheckPrice(product), 3000);
    
    // Periyodik kontroller için alarm kur
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
        // ✅ Ayarları yükle
        const result = await chrome.storage.local.get(['appSettings']);
        const settings = result.appSettings || {
            nightMode: true,
            dailyLimit: 80,
            randomDelay: true
        };
        
        // ✅ Gece saati kontrolü (eğer aktifse)
        if (settings.nightMode) {
            const hour = new Date().getHours();
            if (hour >= ANTI_BAN.quietHours.start && hour < ANTI_BAN.quietHours.end) {
                console.log(`🌙 Gece modu aktif (${hour}:00) - kontrol atlandı`);
                return;
            }
        }
        
        // ✅ Günlük limit kontrolü (ayarlardan al)
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
        
        // ✅ Rastgele gecikme (eğer aktifse)
        if (settings.randomDelay) {
            const randomDelay = Math.floor(
                Math.random() * (ANTI_BAN.randomDelayMax - ANTI_BAN.randomDelayMin) + 
                ANTI_BAN.randomDelayMin
            );
            console.log(`⏳ ${Math.floor(randomDelay/1000)}sn rastgele bekleme...`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
        }
        
        // ✅ Fiyat kontrolü yap
        await checkProductPriceSafe(product);
        
    } catch (error) {
        console.error('❌ Güvenli kontrol hatası:', error);
    }
}

// ✅ Fetch ile fiyat kontrolü (sekme açmadan)
async function checkProductPriceSafe(product) {
    try {
        // Rastgele User-Agent seç
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
                console.warn('⚠️ Amazon bot koruması aktif - kontrol atlandı');
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // CAPTCHA kontrolü
        if (html.includes('captcha') || html.includes('robot')) {
            console.warn('🤖 CAPTCHA tespit edildi - sekme açılıyor (manuel çözüm gerekli)');
            await chrome.tabs.create({ url: product.url, active: true });
            return;
        }
        
        const priceData = parsePriceFromHTML(html, product.includeUsed);
        
        if (!priceData.price || priceData.price <= 0) {
            console.warn('⚠️ Fiyat bulunamadı');
            return;
        }
        
        console.log(`💰 Fiyat: ${priceData.price} TL (Kaynak: ${priceData.source})`);
        
        // Fiyatı güncelle
        await updateProductPrice(product.id, priceData.price, priceData.source);
        
        // ✅ Hedef fiyat kontrolü
        if (priceData.price <= product.targetPrice) {
            console.log(`🎉 HEDEF FİYATA ULAŞILDI!`);
            await handlePriceTarget(product, priceData.price, priceData.source);
        }
        
    } catch (error) {
        console.error(`❌ Fiyat kontrol hatası: ${error.message}`);
        
        // Hata durumunda fallback: Sekme aç
        if (error.message.includes('Failed to fetch')) {
            console.log('🔄 Fallback: Sekme ile kontrol ediliyor...');
            await checkProductPriceWithTab(product);
        }
    }
}

// ✅ HTML'den fiyat parse et
function parsePriceFromHTML(html, includeUsed = false) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let bestPrice = 0;
    let source = 'normal';
    
    // Yeni ürün fiyatı
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
    
    // ✅ 2. El fiyatı (eğer aktifse)
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

// ✅ Fallback: Sekme ile kontrol (fetch başarısızsa)
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
            
            // Fiyat geçmişi
            if (!products[productIndex].priceHistory) {
                products[productIndex].priceHistory = [];
            }
            products[productIndex].priceHistory.unshift({
                price: newPrice,
                source: source,
                date: new Date().toISOString()
            });
            products[productIndex].priceHistory = 
                products[productIndex].priceHistory.slice(0, 20); // Son 20 kayıt
            
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
        
        // ✅ Kullanıcıya sekme aç
        const tab = await chrome.tabs.create({ 
            url: product.url, 
            active: true 
        });
        
        // ✅ Bildirim (Butonlu - Kullanıcı karar verir)
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
        
        // Bildirim verilerini sakla (buton click için)
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
        // Sepete git butonu
        const key = `notification_${notificationId}`;
        const result = await chrome.storage.local.get([key]);
        const data = result[key];
        
        if (data && data.tabId) {
            try {
                // Mevcut sekmeyi aktif et
                await chrome.tabs.update(data.tabId, { active: true });
            } catch {
                // Sekme kapatılmışsa yeni aç
                chrome.tabs.create({ 
                    url: 'https://www.amazon.com.tr/gp/cart/view.html' 
                });
            }
        }
        
        // Notification verisini temizle
        chrome.storage.local.remove([key]);
    }
    
    chrome.notifications.clear(notificationId);
});

// ✅ Bildirime tıklama (genel)
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

console.log('✅ Background script hazır (Safe Mode aktif)');