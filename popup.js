// =============================================
// AMAZON FİYAT TAKİP - POPUP SCRIPT (V3.0)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    loadTrackedProducts();
    checkCurrentPage();
    loadSettings();
    updateStats();
});

// =============================================
// SAYFA KONTROLÜ
// =============================================

async function checkCurrentPage() {
    const section = document.getElementById('currentProductSection');
    const titleEl = document.getElementById('productTitle');
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];

        if (!tab || !tab.url) {
            section.style.display = 'none';
            return;
        }

        const isProductPage = tab.url.includes('amazon.com.tr') && 
                              tab.url.includes('/dp/');

        if (!isProductPage) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        titleEl.textContent = 'Ürün bilgisi alınıyor...';

        const response = await sendMessageWithTimeout(tab.id, { 
            action: 'getProductInfo' 
        }, 5000);

        if (!response || !response.success) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            await new Promise(resolve => setTimeout(resolve, 1500));
            const retryResponse = await sendMessageWithTimeout(tab.id, { 
                action: 'getProductInfo' 
            }, 5000);

            if (!retryResponse || !retryResponse.success) {
                titleEl.textContent = '⚠️ Ürün bilgisi alınamadı';
                return;
            }

            displayCurrentProduct(retryResponse.data);
            return;
        }

        displayCurrentProduct(response.data);

    } catch (error) {
        console.error('❌ Sayfa tanıma hatası:', error);
        section.style.display = 'none';
    }
}

function sendMessageWithTimeout(tabId, message, timeout = 5000) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve(null);
        }, timeout);

        chrome.tabs.sendMessage(tabId, message, (response) => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
                console.warn('Mesaj hatası:', chrome.runtime.lastError.message);
                resolve(null);
                return;
            }
            resolve(response);
        });
    });
}

function displayCurrentProduct(data) {
    const section = document.getElementById('currentProductSection');
    
    if (!data.price || data.price <= 0) {
        document.getElementById('productTitle').textContent = '⚠️ Fiyat bulunamadı';
        document.getElementById('currentPriceDisplay').textContent = 'Fiyat bilgisi alınamadı';
        return;
    }

    section.style.display = 'block';
    
    document.getElementById('productTitle').textContent = 
        data.title.length > 80 ? data.title.substring(0, 80) + '...' : data.title;
    
    document.getElementById('productImage').src = data.image || '';
    
    document.getElementById('currentPriceDisplay').textContent = 
        `💰 Güncel Fiyat: ${data.price} TL`;

    const usedEl = document.getElementById('usedPriceDisplay');
    if (data.usedPrice && data.usedPrice > 0) {
        usedEl.textContent = `♻️ 2. El Fiyat: ${data.usedPrice} TL`;
    } else {
        usedEl.textContent = '';
    }

    const suggestedPrice = Math.floor(data.price * 0.90);
    document.getElementById('targetPrice').placeholder = `Önerilen: ${suggestedPrice}`;

    document.getElementById('addTrackBtn').onclick = () => addProduct(data);
}

// =============================================
// ÜRÜN EKLEME
// =============================================

async function addProduct(data) {
    const targetInput = document.getElementById('targetPrice');
    const target = parseFloat(targetInput.value);
    const used = document.getElementById('checkUsed').checked;
    const auto = document.getElementById('checkAuto').checked;
    const interval = parseInt(document.getElementById('checkInterval').value) || 15;

    if (!target || target <= 0) {
        showToast('⚠️ Lütfen geçerli bir hedef fiyat girin!', 'warning');
        targetInput.focus();
        return;
    }

    if (target >= data.price) {
        const confirmed = window.confirm(
            `Hedef fiyat (${target} TL) güncel fiyattan (${data.price} TL) yüksek.\n\nDevam etmek istiyor musunuz?`
        );
        if (!confirmed) return;
    }

    try {
        const storage = await chrome.storage.local.get(['trackedProducts']);
        let products = storage.trackedProducts || [];

        const existingProduct = products.find(p => 
            p.url === data.url.split('?')[0] && p.status === 'active'
        );
        
        if (existingProduct) {
            const update = window.confirm(
                'Bu ürün zaten takipte!\n\nMevcut takibi güncellemek ister misiniz?'
            );
            if (update) {
                await updateProduct(existingProduct.id, target, used, auto, interval);
            }
            return;
        }

        const newProduct = {
            id: Date.now().toString(),
            title: data.title,
            url: data.url.split('?')[0],
            image: data.image,
            currentPrice: data.price,
            targetPrice: target,
            includeUsed: used,
            autoOrder: auto,
            checkInterval: interval,
            status: 'active',
            variant: data.variant || null,
            addedAt: new Date().toISOString(),
            priceHistory: [{
                price: data.price,
                source: 'normal',
                date: new Date().toISOString()
            }]
        };

        products.push(newProduct);
        await chrome.storage.local.set({ trackedProducts: products });

        chrome.runtime.sendMessage({
            action: 'startTracking',
            product: newProduct
        });

        loadTrackedProducts();
        targetInput.value = '';
        showToast('✅ Ürün takibe eklendi!', 'success');

    } catch (error) {
        console.error('❌ Ürün ekleme hatası:', error);
        showToast('❌ Ürün eklenirken hata oluştu!', 'error');
    }
}

// =============================================
// LİSTE YÖNETİMİ
// =============================================

async function loadTrackedProducts() {
    try {
        const result = await chrome.storage.local.get(['trackedProducts']);
        const list = document.getElementById('trackedList');
        const products = result.trackedProducts || [];

        if (products.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span>📦</span>
                    Henüz takip edilen ürün yok.<br>
                    <small>Amazon ürün sayfasından ekleyebilirsiniz.</small>
                </div>
            `;
            return;
        }

        products.sort((a, b) => {
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            return new Date(b.addedAt) - new Date(a.addedAt);
        });

        list.innerHTML = products.map(p => renderProductCard(p)).join('');
        attachEventListeners();

    } catch (error) {
        console.error('❌ Liste yükleme hatası:', error);
    }
}

function renderProductCard(p) {
    const intervalText = p.checkInterval >= 60
        ? `${p.checkInterval / 60} saat`
        : `${p.checkInterval || 15} dk`;

    const statusClass = p.status === 'triggered' ? 'triggered' : '';
    const statusBadge = p.status === 'triggered'
        ? '<span class="status status-triggered">🎉 Tetiklendi</span>'
        : '<span class="status status-active">🟢 Aktif</span>';

    return `
        <div class="tracked-product-item ${statusClass}">
            <div style="display:flex; gap:10px; margin-bottom:8px;">
                <img src="${p.image || ''}" 
                     style="width:50px; height:50px; object-fit:contain; border-radius:5px; background:white; border:1px solid #eee; flex-shrink:0;"
                     onerror="this.style.display='none'">
                <div style="flex:1; min-width:0;">
                    <div class="product-title-text" style="font-size:12px; margin-bottom:4px;">
                        ${p.title.substring(0, 70)}${p.title.length > 70 ? '...' : ''}
                    </div>
                    ${p.variant ? `<div style="font-size:10px; color:#667eea;">📦 ${p.variant}</div>` : ''}
                </div>
            </div>

            <div class="price-info">
                💰 Güncel: <b>${p.currentPrice || '?'} TL</b> &nbsp;|&nbsp; 
                🎯 Hedef: <b>${p.targetPrice} TL</b>
                ${p.currentPrice && p.currentPrice <= p.targetPrice 
                    ? ' &nbsp;<span style="color:#28a745; font-weight:bold;">✅ Hedefe ulaştı!</span>' 
                    : ''}
            </div>

            <div class="status-badges">
                ${statusBadge}
                ${p.includeUsed ? '<span class="status status-used">♻️ 2.El</span>' : ''}
                ${p.autoOrder ? '<span class="status status-auto">🤖 Oto Sipariş</span>' : ''}
                <span class="status" style="background:#e3f2fd; color:#1565c0;">⏱️ ${intervalText}</span>
            </div>

            <div class="last-checked">
                🕐 Son kontrol: ${p.lastChecked ? formatDate(p.lastChecked) : 'Henüz kontrol edilmedi'}
            </div>

            <div style="display:flex; gap:6px; margin-top:10px;">
                <button class="btn btn-edit edit-trigger" data-id="${p.id}">✏️ Düzenle</button>
                <button class="btn btn-remove remove-trigger" data-id="${p.id}">🗑️ Sil</button>
                <a href="${p.url}" target="_blank" 
                   class="btn btn-link" 
                   style="text-decoration:none; text-align:center;">🔗 Aç</a>
            </div>

            <div class="edit-panel" id="panel-${p.id}">
                <div class="form-row" style="display:flex; gap:8px; margin-bottom:8px;">
                    <div style="flex:1;">
                        <label style="font-size:11px; font-weight:600;">🎯 Yeni Hedef Fiyat:</label>
                        <input type="number" id="input-${p.id}" value="${p.targetPrice}">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:11px; font-weight:600;">⏱️ Kontrol Aralığı:</label>
                        <select id="interval-${p.id}">
                            <option value="15"  ${p.checkInterval==15?'selected':''}>15 dk</option>
                            <option value="20"  ${p.checkInterval==20?'selected':''}>20 dk</option>
                            <option value="30"  ${p.checkInterval==30?'selected':''}>30 dk</option>
                            <option value="45"  ${p.checkInterval==45?'selected':''}>45 dk</option>
                            <option value="60"  ${p.checkInterval==60?'selected':''}>1 saat</option>
                            <option value="120" ${p.checkInterval==120?'selected':''}>2 saat</option>
                            <option value="180" ${p.checkInterval==180?'selected':''}>3 saat</option>
                            <option value="360" ${p.checkInterval==360?'selected':''}>6 saat</option>
                            <option value="720" ${p.checkInterval==720?'selected':''}>12 saat</option>
                            <option value="1440" ${p.checkInterval==1440?'selected':''}>24 saat</option>
                        </select>
                    </div>
                </div>

                <div class="edit-checkbox-row">
                    <label>
                        <input type="checkbox" id="editUsed-${p.id}" ${p.includeUsed ? 'checked' : ''}>
                        ♻️ 2.El Dahil
                    </label>
                    <label>
                        <input type="checkbox" id="editAuto-${p.id}" ${p.autoOrder ? 'checked' : ''}>
                        🤖 Oto Sipariş
                    </label>
                </div>

                <button class="btn btn-save save-trigger" data-id="${p.id}">💾 Kaydet</button>
            </div>
        </div>
    `;
}

function formatDate(isoString) {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Az önce';
        if (diffMins < 60) return `${diffMins} dakika önce`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} saat önce`;
        return `${Math.floor(diffMins / 1440)} gün önce`;
    } catch {
        return 'Bilinmiyor';
    }
}

function attachEventListeners() {
    document.querySelectorAll('.edit-trigger').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-id');
            const panel = document.getElementById(`panel-${id}`);
            const isVisible = panel.style.display === 'block';
            document.querySelectorAll('.edit-panel').forEach(p => p.style.display = 'none');
            panel.style.display = isVisible ? 'none' : 'block';
        };
    });

    document.querySelectorAll('.save-trigger').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            const newPrice = parseFloat(document.getElementById(`input-${id}`).value);
            const newUsed = document.getElementById(`editUsed-${id}`).checked;
            const newAuto = document.getElementById(`editAuto-${id}`).checked;
            const newInterval = parseInt(document.getElementById(`interval-${id}`).value) || 15;

            if (!newPrice || newPrice <= 0) {
                showToast('⚠️ Geçerli bir fiyat girin!', 'warning');
                return;
            }

            await updateProduct(id, newPrice, newUsed, newAuto, newInterval);
        };
    });

    document.querySelectorAll('.remove-trigger').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Bu ürünü takipten çıkarmak istediğinize emin misiniz?')) {
                await deleteProduct(btn.getAttribute('data-id'));
            }
        };
    });
}

async function updateProduct(id, price, used, auto, interval = 15) {
    try {
        const result = await chrome.storage.local.get(['trackedProducts']);
        let products = result.trackedProducts || [];
        const idx = products.findIndex(p => p.id === id);

        if (idx !== -1) {
            products[idx].targetPrice = price;
            products[idx].includeUsed = used;
            products[idx].autoOrder = auto;
            products[idx].checkInterval = interval;
            products[idx].status = 'active';

            await chrome.storage.local.set({ trackedProducts: products });

            chrome.runtime.sendMessage({
                action: 'startTracking',
                product: products[idx]
            });

            loadTrackedProducts();
            showToast('✅ Güncellendi!', 'success');
        }
    } catch (error) {
        console.error('❌ Güncelleme hatası:', error);
        showToast('❌ Güncelleme başarısız!', 'error');
    }
}

async function deleteProduct(id) {
    try {
        const result = await chrome.storage.local.get(['trackedProducts']);
        const filtered = result.trackedProducts.filter(p => p.id !== id);

        await chrome.storage.local.set({ trackedProducts: filtered });
        chrome.runtime.sendMessage({ action: 'stopTracking', productId: id });

        loadTrackedProducts();
        showToast('🗑️ Ürün takipten kaldırıldı', 'info');

    } catch (error) {
        console.error('❌ Silme hatası:', error);
        showToast('❌ Silme başarısız!', 'error');
    }
}

// =============================================
// EXPORT / IMPORT
// =============================================

async function exportData() {
    try {
        const result = await chrome.storage.local.get(['trackedProducts']);
        const products = result.trackedProducts || [];

        if (products.length === 0) {
            showToast('⚠️ Dışa aktarılacak ürün yok!', 'warning');
            return;
        }

        const data = {
            exportDate: new Date().toISOString(),
            version: '3.0',
            products: products
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `amazon-takip-${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast(`✅ ${products.length} ürün dışa aktarıldı!`, 'success');

    } catch (error) {
        console.error('Export hatası:', error);
        showToast('❌ Dışa aktarma başarısız!', 'error');
    }
}

async function importData(event) {
    try {
        const file = event.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.products || !Array.isArray(data.products)) {
            showToast('❌ Geçersiz dosya formatı!', 'error');
            return;
        }

        const result = await chrome.storage.local.get(['trackedProducts']);
        const existing = result.trackedProducts || [];
        const existingUrls = existing.map(p => p.url);
        const newProducts = data.products.filter(p => !existingUrls.includes(p.url));
        const duplicates = data.products.length - newProducts.length;

        if (newProducts.length === 0) {
            showToast('⚠️ Tüm ürünler zaten takipte!', 'warning');
            return;
        }

        const merged = [...existing, ...newProducts];
        await chrome.storage.local.set({ trackedProducts: merged });

        for (let product of newProducts) {
            if (product.status === 'active') {
                chrome.runtime.sendMessage({
                    action: 'startTracking',
                    product: product
                });
            }
        }

        loadTrackedProducts();

        let msg = `✅ ${newProducts.length} ürün içe aktarıldı!`;
        if (duplicates > 0) msg += ` (${duplicates} mükerrer atlandı)`;
        showToast(msg, 'success');

    } catch (error) {
        console.error('Import hatası:', error);
        showToast('❌ Dosya okunamadı!', 'error');
    }

    event.target.value = '';
}

// =============================================
// AYARLAR
// =============================================

async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['appSettings']);
        const settings = result.appSettings || getDefaultSettings();
        
        document.getElementById('nightModeToggle').checked = settings.nightMode;
        document.getElementById('dailyLimitSlider').value = settings.dailyLimit;
        document.getElementById('randomDelayToggle').checked = settings.randomDelay;
        
        updateDailyLimitLabel();
        
    } catch (error) {
        console.error('Ayar yükleme hatası:', error);
    }
}

async function saveSettings() {
    try {
        const settings = {
            nightMode: document.getElementById('nightModeToggle').checked,
            dailyLimit: parseInt(document.getElementById('dailyLimitSlider').value),
            randomDelay: document.getElementById('randomDelayToggle').checked,
            updatedAt: new Date().toISOString()
        };
        
        await chrome.storage.local.set({ appSettings: settings });
        
        chrome.runtime.sendMessage({ 
            action: 'updateSettings', 
            settings: settings 
        });
        
        showToast('✅ Ayarlar kaydedildi', 'success');
        updateStats();
        
    } catch (error) {
        console.error('Ayar kaydetme hatası:', error);
        showToast('❌ Ayarlar kaydedilemedi', 'error');
    }
}

function getDefaultSettings() {
    return {
        nightMode: true,
        dailyLimit: 80,
        randomDelay: true
    };
}

async function resetSettings() {
    if (!confirm('Tüm ayarları varsayılana döndürmek istediğinize emin misiniz?')) {
        return;
    }
    
    const defaults = getDefaultSettings();
    await chrome.storage.local.set({ appSettings: defaults });
    
    loadSettings();
    showToast('🔄 Ayarlar sıfırlandı', 'info');
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const arrow = document.getElementById('settingsArrow');
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        panel.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

function updateDailyLimitLabel() {
    const value = document.getElementById('dailyLimitSlider').value;
    document.getElementById('dailyLimitLabel').textContent = value;
    updateStats();
}

async function updateStats() {
    try {
        const result = await chrome.storage.local.get(['dailyChecks', 'appSettings']);
        const checks = result.dailyChecks || { date: new Date().toDateString(), count: 0 };
        const settings = result.appSettings || getDefaultSettings();
        
        const today = new Date().toDateString();
        const todayCount = checks.date === today ? checks.count : 0;
        const remaining = Math.max(0, settings.dailyLimit - todayCount);
        
        document.getElementById('todayChecks').textContent = todayCount;
        document.getElementById('remainingChecks').textContent = remaining;
        
        const remainingEl = document.getElementById('remainingChecks');
        if (remaining < 10) {
            remainingEl.style.color = '#dc3545';
        } else if (remaining < 30) {
            remainingEl.style.color = '#ffc107';
        } else {
            remainingEl.style.color = '#28a745';
        }
        
    } catch (error) {
        console.error('İstatistik güncelleme hatası:', error);
    }
}

setInterval(updateStats, 10000);

// =============================================
// TOAST BİLDİRİM
// =============================================

function showToast(message, type = 'info') {
    const colors = {
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8'
    };

    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 15px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colors[type]};
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        white-space: nowrap;
        animation: toastIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}