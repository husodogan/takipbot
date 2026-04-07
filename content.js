// =============================================
// AMAZON FİYAT TAKİP - CONTENT SCRIPT (V2.3)
// =============================================

function injectIntegratedButton() {
    if (document.getElementById('at-track-container')) return;
    const buyBox = document.querySelector('#rightCol #desktop_buybox') || 
                   document.querySelector('#buybox') ||
                   document.querySelector('#desktop_buybox_group_1');
    if (!buyBox) return;

    const div = document.createElement('div');
    div.id = 'at-track-container';
    
    div.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%);
            padding: 12px;
            border-radius: 10px;
            border: 2px solid #FF9900;
            margin: 12px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            font-family: 'Segoe UI', Arial, sans-serif;
        ">
            <!-- Ana Buton -->
            <button id="at-main-btn" style="
                width: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 11px 16px;
                border-radius: 8px;
                font-weight: 700;
                cursor: pointer;
                font-size: 14px;
                letter-spacing: 0.3px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                box-shadow: 0 3px 8px rgba(102, 126, 234, 0.35);
                transition: all 0.2s ease;
            ">
                <span style="font-size:16px;">⭐</span>
                <span>Takibe Ekle</span>
            </button>

            <!-- Seçenekler -->
            <div style="
                display: flex;
                gap: 8px;
                margin-top: 8px;
            ">
                <!-- 2.El Dahil -->
                <label id="at-label-used" style="
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 7px 8px;
                    background: white;
                    border: 1.5px solid #ddd;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    color: #444;
                    transition: all 0.2s;
                    user-select: none;
                    white-space: nowrap;
                ">
                    <input type="checkbox" id="at-check-used" style="
                        margin: 0;
                        width: 14px;
                        height: 14px;
                        accent-color: #667eea;
                        cursor: pointer;
                        flex-shrink: 0;
                    ">
                    <span>♻️ 2.El Dahil</span>
                </label>

                <!-- Oto Sipariş -->
                <label id="at-label-auto" style="
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 7px 8px;
                    background: white;
                    border: 1.5px solid #ddd;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    color: #444;
                    transition: all 0.2s;
                    user-select: none;
                    white-space: nowrap;
                ">
                    <input type="checkbox" id="at-check-auto" style="
                        margin: 0;
                        width: 14px;
                        height: 14px;
                        accent-color: #667eea;
                        cursor: pointer;
                        flex-shrink: 0;
                    ">
                    <span>🤖 Oto Sipariş</span>
                </label>
            </div>

            <!-- Durum mesajı alanı -->
            <div id="at-status-msg" style="display:none; margin-top:8px;"></div>
        </div>
    `;

    buyBox.prepend(div);

    // ✅ Checkbox hover efektleri
    const labelUsed = document.getElementById('at-label-used');
    const labelAuto = document.getElementById('at-label-auto');
    const checkUsed = document.getElementById('at-check-used');
    const checkAuto = document.getElementById('at-check-auto');

    function updateLabelStyle(label, checkbox) {
        if (checkbox.checked) {
            label.style.borderColor = '#667eea';
            label.style.background = '#f0f0ff';
            label.style.color = '#667eea';
        } else {
            label.style.borderColor = '#ddd';
            label.style.background = 'white';
            label.style.color = '#444';
        }
    }

    checkUsed.addEventListener('change', () => updateLabelStyle(labelUsed, checkUsed));
    checkAuto.addEventListener('change', () => updateLabelStyle(labelAuto, checkAuto));

    // Hover efektleri
    [labelUsed, labelAuto].forEach(label => {
        label.addEventListener('mouseenter', () => {
            if (!label.querySelector('input').checked) {
                label.style.borderColor = '#aaa';
                label.style.background = '#fafafa';
            }
        });
        label.addEventListener('mouseleave', () => {
            updateLabelStyle(label, label.querySelector('input'));
        });
    });

    // ✅ Buton hover efekti
    const mainBtn = document.getElementById('at-main-btn');
    mainBtn.addEventListener('mouseenter', () => {
        mainBtn.style.transform = 'translateY(-1px)';
        mainBtn.style.boxShadow = '0 5px 12px rgba(102, 126, 234, 0.45)';
    });
    mainBtn.addEventListener('mouseleave', () => {
        mainBtn.style.transform = 'translateY(0)';
        mainBtn.style.boxShadow = '0 3px 8px rgba(102, 126, 234, 0.35)';
    });

    // ✅ Takibe ekleme
    mainBtn.addEventListener('click', async () => {
        // Buton loading durumu
        mainBtn.innerHTML = '<span style="font-size:14px;">⏳</span> <span>Ekleniyor...</span>';
        mainBtn.style.opacity = '0.7';
        mainBtn.style.pointerEvents = 'none';

        const data = extractProductInfo();
        const includeUsed = checkUsed.checked;
        const autoOrder = checkAuto.checked;

        const storage = await chrome.storage.local.get(['trackedProducts']);
        let products = storage.trackedProducts || [];

        // Aynı ürün kontrolü
        const existing = products.find(p => p.url === data.url && p.status === 'active');
        if (existing) {
            mainBtn.innerHTML = '<span style="font-size:14px;">⚠️</span> <span>Zaten Takipte</span>';
            mainBtn.style.background = 'linear-gradient(135deg, #ffc107 0%, #ffb300 100%)';
            mainBtn.style.color = '#333';
            mainBtn.style.opacity = '1';
            
            showStatusMsg('Bu ürün zaten takip listenizde!', '#856404', '#fff3cd');

            setTimeout(() => {
                resetButton(mainBtn);
            }, 3000);
            return;
        }

        const newProd = {
            id: Date.now().toString(),
            url: data.url,
            title: data.title,
            image: data.image,
            currentPrice: data.price,
            targetPrice: Math.floor(data.price * 0.90),
            includeUsed: includeUsed,
            autoOrder: autoOrder,
            checkInterval: 5,
            status: 'active',
            variant: data.variant,
            addedAt: new Date().toISOString(),
            priceHistory: [{
                price: data.price,
                source: 'normal',
                date: new Date().toISOString()
            }]
        };

        products.push(newProd);
        await chrome.storage.local.set({ trackedProducts: products });
        chrome.runtime.sendMessage({ action: 'startTracking', product: newProd });

        // Başarı durumu
        mainBtn.innerHTML = '<span style="font-size:14px;">✅</span> <span>Takibe Alındı!</span>';
        mainBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        mainBtn.style.boxShadow = '0 3px 8px rgba(40, 167, 69, 0.35)';
        mainBtn.style.opacity = '1';

        const targetPrice = Math.floor(data.price * 0.90);
        showStatusMsg(
            `✅ Hedef: ${targetPrice} TL | Kontrol: 5 dk | Popup'tan düzenleyebilirsiniz`,
            '#155724', '#d4edda'
        );
    });
}

// ✅ Durum mesajı göster
function showStatusMsg(text, color, bg) {
    const msgDiv = document.getElementById('at-status-msg');
    if (!msgDiv) return;
    msgDiv.style.display = 'block';
    msgDiv.style.cssText = `
        display: block;
        margin-top: 8px;
        padding: 6px 10px;
        background: ${bg};
        color: ${color};
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        font-family: 'Segoe UI', Arial, sans-serif;
        animation: at-fadeIn 0.3s ease;
    `;
    msgDiv.textContent = text;
}

// ✅ Butonu sıfırla
function resetButton(btn) {
    btn.innerHTML = '<span style="font-size:16px;">⭐</span> <span>Takibe Ekle</span>';
    btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    btn.style.boxShadow = '0 3px 8px rgba(102, 126, 234, 0.35)';
    btn.style.color = 'white';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    
    const msgDiv = document.getElementById('at-status-msg');
    if (msgDiv) msgDiv.style.display = 'none';
}

// ✅ Fiyat çıkartma
function extractProductInfo() {
    const title = document.querySelector('#productTitle')?.textContent.trim() || 'Ürün';
    
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
    
    return { url: window.location.href.split('?')[0], title, price, image, variant };
}

// ✅ Varyant bilgisi
function getSelectedVariant() {
    const variants = [];
    const selectors = [
        '#variation_color_name .selection',
        '#variation_size_name .selection',
        '#variation_style_name .selection'
    ];
    selectors.forEach(sel => {
        const elem = document.querySelector(sel);
        if (elem) variants.push(elem.textContent.trim());
    });
    return variants.length > 0 ? variants.join(' - ') : null;
}

// ✅ 2. El fiyat
function getUsedPrice() {
    const usedBox = document.querySelector('#usedAccordionRow .a-price .a-offscreen');
    if (usedBox) {
        const price = parseFloat(usedBox.textContent.replace(/[^\d,]/g, '').replace(',', '.'));
        return price > 0 ? price : null;
    }
    return null;
}

// ✅ Sepete ekle
async function addToCart() {
    try {
        const buttons = ['#add-to-cart-button', '#buy-now-button', 'input[name="submit.add-to-cart"]'];
        for (let sel of buttons) {
            const btn = document.querySelector(sel);
            if (btn && !btn.disabled) { btn.click(); return true; }
        }
        return false;
    } catch (e) { return false; }
}

// ✅ Checkout
async function proceedToCheckout() {
    try {
        await new Promise(r => setTimeout(r, 2000));
        const buttons = ['#hlb-ptc-btn-native', '#sc-buy-box-ptc-button', 'input[name="proceedToRetailCheckout"]'];
        for (let sel of buttons) {
            const btn = document.querySelector(sel);
            if (btn) { btn.click(); return true; }
        }
        window.location.href = 'https://www.amazon.com.tr/gp/cart/view.html';
        return true;
    } catch (e) { return false; }
}

// ✅ Mesaj dinleyici
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProductInfo') {
        try {
            const data = extractProductInfo();
            sendResponse({ success: true, data: { ...data, usedPrice: getUsedPrice() } });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
    if (request.action === 'addToCart') {
        addToCart().then(success => sendResponse({ success }));
        return true;
    }
    if (request.action === 'checkout') {
        proceedToCheckout().then(success => sendResponse({ success }));
        return true;
    }
    return true;
});

// ✅ Sayfa yüklenince butonu ekle
setTimeout(injectIntegratedButton, 1500);