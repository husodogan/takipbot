// =============================================
// OFFSCREEN DOCUMENT - KEEP ALIVE
// =============================================

// Background'u her 25 saniyede bir uyandır
setInterval(() => {
    chrome.runtime.sendMessage({ action: 'keepAlive' }).catch(() => {
        // Hata olursa sessizce devam et
    });
}, 25000);

console.log('🔄 Keep-alive başlatıldı');