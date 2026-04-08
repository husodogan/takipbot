// =============================================
// AMAZON FİYAT TAKİP - CONTENT SCRIPT (V3.1)
// =============================================

function injectIntegratedButton() {
    if (document.getElementById('at-track-container')) return;
    const buyBox = document.querySelector('#rightCol #desktop_buybox') || document.querySelector('#buybox');
    if (!buyBox) return;

    const div = document.createElement('div');
    div.id = 'at-track-container';
    
    div.innerHTML = `
        <div style="
            margin: 12px 0;
            background: white;
            border-radius: 12px;
            border: 2px solid #FF9900;
            box-shadow: 0 4px 15px rgba(255,153,0,0.15);
            overflow: hidden;
            font-family: 'Segoe UI', Arial, sans-serif;
        ">
            <!-- Başlık Bandı -->
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 6px 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            ">
                <span style="font-size:13px;">⭐</span>
                <span style="color:white; font-size:12px; font-weight:700; letter-spacing:0.5px;">
                    AMAZON FİYAT TAKİP
                </span>
            </div>

            <!-- İçerik -->
            <div style="padding: 12px;">

                <!-- Fiyat Göstergesi -->
                <div id="at-price-display" style="
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 8px 12px;
                    margin-bottom: 10px;
                    font-size: 12px;
                    color: #555;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span>💰 Güncel Fiyat:</span>
                    <span id="at-price-val" style="font-weight:700; color:#e74c3c; font-size:14px;">-</span>
                </div>

                <!-- Hedef Fiyat Input -->
                <div style="margin-bottom: 10px;">
                    <div style="
                        font-size: 11px;
                        font-weight: 600;
                        color: #666;
                        margin-bottom: 5px;
                    ">🎯 Hedef Fiyat (TL)</div>
                    <input 
                        type="number" 
                        id="at-target-price" 
                        placeholder="Hedef fiyat girin..."
                        style="
                            width: 100%;
                            padding: 9px 12px;
                            border: 2px solid #e9ecef;
                            border-radius: 8px;
                            font-size: 13px;
                            outline: none;
                            box-sizing: border-box;
                            transition: border-color 0.2s;
                            font-family: 'Segoe UI', Arial, sans-serif;
                        "
                        onfocus="this.style.borderColor='#667eea'"
                        onblur="this.style.borderColor='#e9ecef'"
                    >
                    <!-- Hızlı Seçim Chipleri -->
                    <div id="at-chips" style="
                        display: flex;
                        gap: 5px;
                        margin-top: 6px;
                        flex-wrap: wrap;
                    "></div>
                </div>

                <!-- Kontrol Aralığı -->
                <div style="margin-bottom: 10px;">
                    <div style="
                        font-size: 11px;
                        font-weight: 600;
                        color: #666;
                        margin-bottom: 5px;
                    ">⏱️ Kontrol Aralığı</div>
                    <select id="at-interval" style="
                        width: 100%;
                        padding: 9px 12px;
                        border: 2px solid #e9ecef;
                        border-radius: 8px;
                        font-size: 13px;
                        outline: none;
                        background: white;
                        box-sizing: border-box;
                        font-family: 'Segoe UI', Arial, sans-serif;
                        cursor: pointer;
                    ">
                        <option value="1">Her 1 dakika ⚠️</option>
                        <option value="3">Her 3 dakika ⚠️</option>
                        <option value="5">Her 5 dakika ⚠️</option>
                        <option value="10">Her 10 dakika</option>
                        <option value="15" selected>Her 15 dakika ✅</option>
                        <option value="20">Her 20 dakika</option>
                        <option value="30">Her 30 dakika</option>
                        <option value="60">Her 1 saat</option>
                        <option value="120">Her 2 saat</option>
                        <option value="360">Her 6 saat</option>
                        <option value="720">Her 12 saat</option>
                        <option value="1440">Her 24 saat</option>
                    </select>
                </div>

                <!-- Checkboxlar -->
                <div style="
                    display: flex;
                    gap: 8px;
                    margin-bottom: 12px;
                ">
                    <!-- 2. El -->
                    <label style="
                        flex: 1;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 9px 12px;
                        background: #f8f9fa;
                        border: 2px solid #e9ecef;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.borderColor='#667eea'; this.style.background='#eef0ff'"
                    onmouseout="this.style.borderColor='#e9ecef'; this.style.background='#f8f9fa'"
                    >
                        <input 
                            type="checkbox" 
                            id="at-check-used"
                            style="
                                width: 15px;
                                height: 15px;
                                margin: 0;
                                cursor: pointer;
                                accent-color: #667eea;
                                flex-shrink: 0;
                            "
                        >
                        <span style="
                            font-size: 12px;
                            font-weight: 600;
                            color: #444;
                            line-height: 1;
                        ">♻️ 2.El Dahil</span>
                    </label>

                    <!-- Oto Sipariş -->
                    <label style="
                        flex: 1;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 9px 12px;
                        background: #f8f9fa;
                        border: 2px solid #e9ecef;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.borderColor='#667eea'; this.style.background='#eef0ff'"
                    onmouseout="this.style.borderColor='#e9ecef'; this.style.background='#f8f9fa'"
                    >
                        <input 
                            type="checkbox" 
                            id="at-check-auto"
                            style="
                                width: 15px;
                                height: 15px;
                                margin: 0;
                                cursor: pointer;
                                accent-color: #667eea;
                                flex-shrink: 0;
                            "
                        >
                        <span style="
                            font-size: 12px;
                            font-weight: 600;
                            color: #444;
                            line-height: 1;
                        ">🤖 Oto Sipariş</span>
                    </label>
                </div>

                <!-- Takibe Ekle Butonu -->
                <button id="at-main-btn" style="
                    width: 100%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 13px;
                    border-radius: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 14px;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(102,126,234,0.3);
                "
                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 16px rgba(102,126,234,0.4)'"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.3)'"
                >
                    <span style="font-size:16px;">⭐</span>
                    <span>Takibe Ekle</span>
                </button>

                <!-- Mesaj Alanı -->
                <div id="at-message" style="display:none; margin-top:8px;"></div>

            </div>
        </div>
    `;

    buyBox.prepend(div);

    // Fiyatı göster ve chip'leri oluştur
    const data = extractProductInfo();
    if (data.price > 0) {
        document.getElementById('at-price-val').textContent = `${data.price} TL`;
        
        const chips = [
            { label: '%-5', value: Math.floor(data.price * 0.95) },
            { label: '%-10', value: Math.floor(data.price * 0.90) },
            { label: '%-15', value: Math.floor(data.price * 0.85) },
            { label: '%-20', value: Math.floor(data.price * 0.80) },
        ];

        const chipsContainer = document.getElementById('at-chips');
        chips.forEach(chip => {
            const el = document.createElement('span');
            el.textContent = `${chip.label} → ${chip.value}₺`;
            el.style.cssText = `
                font-size: 10px;
                padding: 3px 8px;
                background: #eef0ff;
                border: 1px solid #667eea;
                border-radius: 12px;
                cursor: pointer;
                color: #667eea;
                font-weight: 600;
                transition: all 0.2s;
                white-space: nowrap;
            `;
            el.onmouseover = () => { el.style.background = '#667eea'; el.style.color = 'white'; };
            el.onmouseout = () => { el.style.background = '#eef0ff'; el.style.color = '#667eea'; };
            el.onclick = () => {
                document.getElementById('at-target-price').value = chip.value;
            };
            chipsContainer.appendChild(el);
        });
    }

    // Buton click
    document.getElementById('at-main-btn').addEventListener('click', async () => {
        const data = extractProductInfo();
        const targetPrice = parseFloat(document.getElementById('at-target-price').value);
        const includeUsed = document.getElementById('at-check-used').checked;
        const autoOrder = document.getElementById('at-check-auto').checked;
        const interval = parseInt(document.getElementById('at-interval').value) || 15;

        if (!targetPrice || targetPrice <= 0) {
            showMessage('at-message', '⚠️ Lütfen hedef fiyat girin!', 'warning');
            return;
        }

        const storage = await chrome.storage.local.get(['trackedProducts']);
        let products = storage.trackedProducts || [];

        const existing = products.find(p => 
            p.url === data.url && p.status === 'active'
        );
        
        if (existing) {
            showMessage('at-message', '⚠️ Bu ürün zaten takipte!', 'warning');
            return;
        }

        const newProd = {
            id: Date.now().toString(),
            url: data.url,
            title: data.title,
            image: data.image,
            currentPrice: data.price,
            targetPrice: targetPrice,
            includeUsed: includeUsed,
            autoOrder: autoOrder,
            checkInterval: interval,
            status: 'active',
            variant: data.variant || null,
            addedAt: new Date().toISOString()
        };

        products.push(newProd);
        await chrome.storage.local.set({ trackedProducts: products });
        chrome.runtime.sendMessage({ action: 'startTracking', product: newProd });

        const btn = document.getElementById('at-main-btn');
        btn.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
        btn.style.boxShadow = '0 4px 12px rgba(40,167,69,0.3)';
        btn.innerHTML = '<span style="font-size:16px;">✅</span><span>Takibe Eklendi!</span>';
        btn.disabled = true;

        showMessage('at-message', '✅ Ürün başarıyla takibe eklendi!', 'success');
    });
}

function extractProductInfo() {
    const title = document.querySelector('#productTitle')?.textContent.trim() || 'Ürün';
    
    // ✅ Ana fiyat (buybox)
    let price = 0;
    const priceSelectors = [
        '.a-price .a-offscreen',
        '.a-price-whole',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price[data-a-color="price"] .a-offscreen'
    ];
    
    for (let selector of priceSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
            const text = elem.textContent || elem.getAttribute('content') || '';
            const parsed = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
            if (parsed > 0) {
                price = parsed;
                break;
            }
        }
    }
    
    const image = document.querySelector('#landingImage')?.src || 
                  document.querySelector('#imgBlkFront')?.src || '';
    
    const variant = getSelectedVariant();
    
    // ✅ Tüm satıcıları çek
    const allSellers = getAllSellerPrices();
    
    return { 
        url: window.location.href.split('?')[0], 
        title, 
        price, 
        image,
        variant,
        sellers: allSellers  // ✅ YENİ
    };
}

function getSelectedVariant() {
    const variants = [];
    
    const colorElem = document.querySelector('#variation_color_name .selection');
    if (colorElem) variants.push(colorElem.textContent.trim());
    
    const sizeElem = document.querySelector('#variation_size_name .selection');
    if (sizeElem) variants.push(sizeElem.textContent.trim());
    
    const styleElem = document.querySelector('#variation_style_name .selection');
    if (styleElem) variants.push(styleElem.textContent.trim());
    
    return variants.length > 0 ? variants.join(' - ') : null;
}

function getUsedPrice() {
    // ✅ Tüm 2. el fiyatları
    const usedPrices = [];
    
    const usedBox = document.querySelector('#usedAccordionRow .a-price .a-offscreen');
    if (usedBox) {
        const text = usedBox.textContent;
        const price = parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
        if (price > 0) usedPrices.push(price);
    }
    
    // En düşüğünü döndür
    return usedPrices.length > 0 ? Math.min(...usedPrices) : null;
}

// ✅ Sepete ekleme fonksiyonu
async function addToCart() {
    try {
        const addButtons = [
            '#add-to-cart-button',
            '#buy-now-button', 
            'input[name="submit.add-to-cart"]',
            '#addToCart'
        ];
        
        for (let selector of addButtons) {
            const btn = document.querySelector(selector);
            if (btn && !btn.disabled) {
                btn.click();
                console.log('✅ Sepete ekleme butonu tıklandı');
                return true;
            }
        }
        
        console.warn('⚠️ Sepete ekleme butonu bulunamadı');
        return false;
    } catch (error) {
        console.error('❌ Sepete ekleme hatası:', error);
        return false;
    }
}

function getAllSellerPrices() {
    const sellers = [];
    
    try {
        // ✅ 1. Buybox'taki satıcı
        const buyboxSeller = document.querySelector('#sellerProfileTriggerId')?.textContent.trim() ||
                            document.querySelector('#bylineInfo')?.textContent.trim() ||
                            'Amazon';
        
        const buyboxPrice = parseFloat(
            (document.querySelector('.a-price .a-offscreen')?.textContent || '0')
            .replace(/[^\d,]/g, '').replace(',', '.')
        );
        
        if (buyboxPrice > 0) {
            sellers.push({
                name: buyboxSeller,
                price: buyboxPrice,
                type: 'new',
                isBuybox: true
            });
        }
        
        // ✅ 2. "Diğer Satıcılar" bölümü
        const otherSellersLink = document.querySelector('#mbc-sold-by-line a[href*="offer-listing"]');
        if (otherSellersLink) {
            // Burada manuel olarak link'e tıklamadan fiyatları çekemeyiz
            // Ama link var, bu bilgiyi saklayalım
            sellers.push({
                name: 'Diğer Satıcılar Mevcut',
                price: 0,
                type: 'other',
                link: otherSellersLink.href
            });
        }
        
        // ✅ 3. 2. El ürünler
        const usedAccordion = document.querySelector('#usedAccordionRow');
        if (usedAccordion) {
            const usedPriceText = usedAccordion.querySelector('.a-price .a-offscreen')?.textContent || '';
            const usedPrice = parseFloat(usedPriceText.replace(/[^\d,]/g, '').replace(',', '.'));
            
            if (usedPrice > 0) {
                sellers.push({
                    name: '2. El Satıcılar',
                    price: usedPrice,
                    type: 'used',
                    isBuybox: false
                });
            }
        }
        
        // ✅ 4. "Fiyat Öneri Özeti" bölümü (varsa)
        const offerSummary = document.querySelectorAll('#aod-offer-list .aod-offer');
        offerSummary.forEach((offer, index) => {
            const sellerName = offer.querySelector('.a-size-small.a-color-base')?.textContent.trim() || `Satıcı ${index + 1}`;
            const priceText = offer.querySelector('.a-price .a-offscreen')?.textContent || '';
            const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'));
            
            if (price > 0) {
                sellers.push({
                    name: sellerName,
                    price: price,
                    type: 'new',
                    isBuybox: false
                });
            }
        });
        
        console.log('📊 Bulunan satıcılar:', sellers);
        
    } catch (e) {
        console.warn('Satıcı bilgisi alınamadı:', e);
    }
    
    return sellers;
}

// ✅ Ödeme sayfasına git
async function proceedToCheckout() {
    try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const checkoutButtons = [
            '#hlb-ptc-btn-native',
            '#sc-buy-box-ptc-button',
            'input[name="proceedToRetailCheckout"]',
            'a[href*="checkout"]'
        ];
        
        for (let selector of checkoutButtons) {
            const btn = document.querySelector(selector);
            if (btn) {
                btn.click();
                console.log('✅ Ödeme sayfasına yönlendiriliyor');
                return true;
            }
        }
        
        window.location.href = 'https://www.amazon.com.tr/gp/cart/view.html';
        return true;
    } catch (error) {
        console.error('❌ Checkout hatası:', error);
        return false;
    }
}

function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const colors = {
        success: { bg: '#d4edda', border: '#c3e6cb', color: '#155724' },
        warning: { bg: '#fff3cd', border: '#ffeeba', color: '#856404' },
        error:   { bg: '#f8d7da', border: '#f5c6cb', color: '#721c24' }
    };

    const c = colors[type] || colors.success;
    el.style.cssText = `
        display: block;
        padding: 8px 12px;
        background: ${c.bg};
        border: 1px solid ${c.border};
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        color: ${c.color};
        text-align: center;
    `;
    el.textContent = text;

    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ✅ Mesaj dinleyici
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProductInfo') {
        try {
            const data = extractProductInfo();
            const usedPrice = getUsedPrice();
            sendResponse({ 
                success: true, 
                data: {
                    ...data,
                    usedPrice: usedPrice
                }
            });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
    
    if (request.action === 'addToCart') {
        addToCart().then(success => {
            sendResponse({ success });
        });
        return true;
    }
    
    if (request.action === 'checkout') {
        proceedToCheckout().then(success => {
            sendResponse({ success });
        });
        return true;
    }
    
    return true;
});

setTimeout(injectIntegratedButton, 1500);