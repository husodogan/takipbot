// =============================================
// AMAZON FİYAT TAKİP - BACKGROUND SERVICE WORKER (V3.2)
// Anti-Ban + CAPTCHA Toggle + Oto Sepet + Gelişmiş Fallback
// =============================================

const ICON_URL = chrome.runtime.getURL('icon.png');

const ANTI_BAN = {
    minCheckInterval: 1,
    pageLoadWait: 5000,
    randomDelayMin: 10000,
    randomDelayMax: 40000,
    maxDailyChecks: 150,
    maxRetries: 3,
    quietHours: { start: 0, end: 7 },
    userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ]
};

const KEEP_ALIVE_ALARM = 'keepAliveAlarm';

chrome.alarms.create(KEEP_ALIVE_ALARM, {
    periodInMinutes: 0.4
});

// =============================================
// YAŞAM DÖNGÜSÜ
// =============================================

chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 Amazon Fiyat Takipçisi V3.2 yüklendi');
    loadAndStartTracking();
    createOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Sistem başlatıldı, takipler yükleniyor...');
    loadAndStartTracking();
    createOffscreenDocument();
});

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
    
    const intervalMinutes = Math.max(product.checkInterval || 15, 1);
    
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
            dailyLimit: 150,
            randomDelay: true,
            captchaDetection: true
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
        
        await checkProductPriceSafe(product, settings);
        
    } catch (error) {
        console.error('❌ Güvenli kontrol hatası:', error);
    }
}

// ✅ Fetch ile fiyat kontrolü (İyileştirilmiş)
async function checkProductPriceSafe(product, settings) {
    try {
        const userAgent = ANTI_BAN.userAgents[
            Math.floor(Math.random() * ANTI_BAN.userAgents.length)
        ];
        
        console.log(`🔍 Fiyat kontrol ediliyor: ${product.title.substring(0, 30)}...`);
        
        // ✅ Fetch ile dene (timeout ile)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
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
            credentials: 'include',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 503) {
                console.warn('⚠️ Amazon bot koruması (503) - Sekme ile denenecek');
                throw new Error('Bot koruması tespit edildi');
            }
            if (response.status === 403) {
                console.warn('⚠️ Erişim engellendi (403) - Sekme ile denenecek');
                throw new Error('Erişim engellendi');
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        // CAPTCHA kontrolü
        const captchaEnabled = settings.captchaDetection !== false;
        
        if (captchaEnabled && (
            html.toLowerCase().includes('captcha') || 
            html.toLowerCase().includes('robot') || 
            html.includes('Type the characters you see in this image')
        )) {
            console.warn(`🤖 CAPTCHA tespit edildi: ${product.title.substring(0, 30)}`);
            
            chrome.notifications.create(`captcha-${product.id}-${Date.now()}`, {
                type: 'basic',
                iconUrl: ICON_URL,
                title: '🤖 CAPTCHA Tespit Edildi',
                message: `Amazon güvenlik kontrolü istiyor.\n\n${product.title.substring(0, 50)}...\n\nLütfen sayfayı açıp CAPTCHA'yı çözün.`,
                priority: 2,
                requireInteraction: true
            });
            
            await chrome.storage.local.set({
                [`notification_captcha-${product.id}`]: { productUrl: product.url }
            });
            
            return;
        }
        
        const priceData = parsePriceFromHTML(html, product.includeUsed);
        
        if (!priceData.price || priceData.price <= 0) {
            console.warn('⚠️ Fetch ile fiyat bulunamadı - Sekme ile denenecek');
            throw new Error('Fiyat parse edilemedi');
        }
        
        console.log(`💰 Fiyat (Fetch): ${priceData.price} TL (${priceData.source})`);
        
        await updateProductPrice(product.id, priceData.price, priceData.source);
        
        if (priceData.price <= product.targetPrice) {
            console.log(`🎉 HEDEF FİYATA ULAŞILDI!`);
            await handlePriceTarget(product, priceData.price, priceData.source);
        }
        
    } catch (error) {
        // ✅ Fetch başarısız - fallback: sekme aç
        console.warn(`⚠️ Fetch hatası: ${error.message} - Fallback aktif`);
        
        // Sadece kritik hataları logla
        if (!error.message.includes('Failed to fetch') && 
            !error.message.includes('NetworkError') &&
            !error.message.includes('aborted') &&
            !error.message.includes('Bot koruması') &&
            !error.message.includes('Erişim engellendi') &&
            !error.message.includes('Fiyat parse')) {
            console.error(`❌ Beklenmeyen hata: ${error.message}`);
        }
        
        // Sekme ile kontrol et
        await checkProductPriceWithTab(product);
    }
}

function parsePriceFromHTML(html, includeUsed = false) {
    const allPrices = [];
    
    // ✅ Ana fiyatları bul
    const pricePatterns = [
        /<span class="a-offscreen">([^<]+)<\/span>/gi,
        /<span class="a-price-whole">([^<]+)<\/span>/gi,
        /<span id="priceblock_ourprice"[^>]*>([^<]+)<\/span>/gi,
        /<span id="priceblock_dealprice"[^>]*>([^<]+)<\/span>/gi,
    ];
    
    for (let pattern of pricePatterns) {
        const matches = html.matchAll(pattern);
        for (let match of matches) {
            const priceText = match[1];
            if (!priceText) continue;
            
            const cleanPrice = priceText
                .replace(/[^\d,]/g, '')
                .replace(',', '.');
            
            const price = parseFloat(cleanPrice);
            
            if (price > 0 && price < 1000000) {
                allPrices.push({ price, source: 'normal' });
            }
        }
    }
    
    // ✅ 2. El fiyatları
    if (includeUsed) {
        const usedPatterns = [
            /usedAccordionRow[\s\S]{0,500}?<span class="a-offscreen">([^<]+)<\/span>/gi,
            /2\.\s*El[\s\S]{0,200}?₺\s*([\d.,]+)/gi,
        ];
        
        for (let pattern of usedPatterns) {
            const matches = html.matchAll(pattern);
            for (let match of matches) {
                if (!match[1]) continue;
                
                const cleanPrice = match[1]
                    .replace(/[^\d,]/g, '')
                    .replace(',', '.');
                
                const usedPrice = parseFloat(cleanPrice);
                
                if (usedPrice > 0 && usedPrice < 1000000) {
                    allPrices.push({ price: usedPrice, source: 'used' });
                }
            }
        }
    }
    
    // ✅ En düşük fiyatı seç
    if (allPrices.length === 0) {
        return { price: 0, source: 'normal' };
    }
    
    allPrices.sort((a, b) => a.price - b.price);
    const lowest = allPrices[0];
    
    console.log(`💰 ${allPrices.length} fiyat bulundu, en düşük: ${lowest.price} TL (${lowest.source})`);
    
    return lowest;
}

// ✅ Fallback: Sekme ile kontrol (İyileştirilmiş)
async function checkProductPriceWithTab(product) {
    let tabId = null;
    
    try {
        console.log(`🔄 Sekme ile kontrol: ${product.title.substring(0, 30)}...`);
        
        const tab = await chrome.tabs.create({ 
            url: product.url, 
            active: false 
        });
        tabId = tab.id;
        
        await waitForTabLoad(tabId);
        
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
            console.warn('Script inject hatası:', e.message);
        }
        
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
        
        // ✅ Tüm satıcılardan en düşük fiyatı al
        if (response.data.sellers && response.data.sellers.length > 0) {
            const validSellers = response.data.sellers.filter(s => s.price > 0);
            
            if (validSellers.length > 0) {
                const lowest = validSellers.reduce((min, s) => 
                    s.price < min.price ? s : min
                );
                
                finalPrice = lowest.price;
                source = lowest.type;
                
                console.log(`📊 ${validSellers.length} satıcı, en düşük: ${finalPrice} TL (${lowest.name})`);
            }
        }
        
        // 2. El kontrolü
        if (product.includeUsed && response.data.usedPrice && 
            response.data.usedPrice > 0 && response.data.usedPrice < finalPrice) {
            finalPrice = response.data.usedPrice;
            source = 'used';
        }
        
        if (!finalPrice || finalPrice <= 0) {
            console.warn('⚠️ Geçerli fiyat bulunamadı');
            await closeTab(tabId);
            return;
        }
        
        console.log(`💰 En Düşük Fiyat: ${finalPrice} TL (${source})`);
        
        await updateProductPrice(product.id, finalPrice, source);
        
        if (finalPrice <= product.targetPrice) {
            console.log(`🎉 HEDEF FİYATA ULAŞILDI!`);
            await handlePriceTarget(product, finalPrice, source);
        } else {
            await closeTab(tabId);
        }
        
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
// HEDEF FİYAT + OTO SİPARİŞ
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
        
        const sourceText = source === 'used' ? ' ♻️ 2.El' : '';
        const notifId = `price-${product.id}-${Date.now()}`;
        
        // ✅ Oto sipariş aktifse
        if (product.autoOrder) {
            console.log('🤖 Oto sipariş aktif - sepete ekleniyor...');
            await autoOrderProduct(product, currentPrice, sourceText, notifId);
        } else {
            // Sadece bildir ve sekmeyi aç
            const tab = await chrome.tabs.create({ 
                url: product.url, 
                active: true 
            });
            
            chrome.notifications.create(notifId, {
                type: 'basic',
                iconUrl: ICON_URL,
                title: '🎯 Hedef Fiyata Ulaşıldı!',
                message: `${product.title.substring(0, 60)}...\n\n💰 Güncel: ${currentPrice} TL${sourceText}\n🎯 Hedef: ${product.targetPrice} TL\n\nÜrün sayfası açıldı!`,
                priority: 2,
                requireInteraction: true
            });
            
            await chrome.storage.local.set({
                [`notification_${notifId}`]: {
                    productUrl: product.url,
                    tabId: tab.id
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Hedef fiyat işleme hatası:', error);
    }
}

// ✅ Otomatik sipariş (İyileştirilmiş)
async function autoOrderProduct(product, currentPrice, sourceText, notifId) {
    let tabId = null;
    
    try {
        const tab = await chrome.tabs.create({ 
            url: product.url, 
            active: true 
        });
        tabId = tab.id;
        
        // Sayfa yüklenene kadar bekle
        await waitForTabLoad(tabId);
        
        // ✅ Content script inject et
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
        } catch (e) {
            console.warn('Content script zaten yüklü:', e.message);
        }
        
        // Content script'in hazır olmasını bekle
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Sepete ekleme dene
        let addedToCart = false;
        for (let attempt = 1; attempt <= ANTI_BAN.maxRetries; attempt++) {
            console.log(`🛒 Sepete ekleme denemesi ${attempt}/${ANTI_BAN.maxRetries}...`);
            
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            
            const response = await sendMessageToTab(tabId, { action: 'addToCart' });
            
            if (response && response.success) {
                addedToCart = true;
                console.log('✅ Sepete eklendi!');
                break;
            } else {
                console.warn(`⚠️ Deneme ${attempt} başarısız`);
            }
        }
        
        if (addedToCart) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            console.log('💳 Ödeme sayfasına yönlendiriliyor...');
            const checkoutResponse = await sendMessageToTab(tabId, { action: 'checkout' });
            
            chrome.notifications.create(notifId, {
                type: 'basic',
                iconUrl: ICON_URL,
                title: '🛒 Sepete Eklendi!',
                message: `${product.title.substring(0, 50)}...\n\n💰 Fiyat: ${currentPrice} TL${sourceText}\n\n⚠️ LÜTFEN SİPARİŞİ MANUEL OLARAK ONAYLAYIN!`,
                priority: 2,
                requireInteraction: true
            });
        } else {
            chrome.notifications.create(notifId, {
                type: 'basic',
                iconUrl: ICON_URL,
                title: '🎯 Hedef Fiyat + ⚠️ Sepet Hatası',
                message: `${product.title.substring(0, 50)}...\n\n💰 Fiyat: ${currentPrice} TL${sourceText}\n\n⚠️ Sepete otomatik eklenemedi.\nLütfen manuel olarak ekleyin!`,
                priority: 2,
                requireInteraction: true
            });
        }
        
        await chrome.storage.local.set({
            [`notification_${notifId}`]: {
                productUrl: product.url,
                tabId: tabId
            }
        });
        
    } catch (error) {
        console.error('❌ Oto sipariş hatası:', error);
        
        chrome.notifications.create('error-' + Date.now(), {
            type: 'basic',
            iconUrl: ICON_URL,
            title: '❌ Oto Sipariş Hatası',
            message: `${product.title.substring(0, 50)}...\n\nOtomatik sipariş başarısız.\nManuel kontrol edin.`,
            priority: 2
        });
    }
}

// =============================================
// BİLDİRİM OLAYLARI
// =============================================

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
                    chrome.tabs.create({ 
                        url: data.productUrl || 'https://www.amazon.com.tr/gp/cart/view.html' 
                    });
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

console.log('✅ Background script hazır (V3.2 - Final)');