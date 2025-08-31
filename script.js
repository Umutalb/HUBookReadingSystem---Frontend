// API Base URL
const API_BASE = 'https://hubookreadingsystem-production.up.railway.app/api';
const APP_VERSION = 'frontend-v1.0.3';

// Oturum bilgileri
let currentUser = { id: null, name: null, targetCount: null, currentRound: null };

// Dinamik ID eşlemeleri (isim -> id)
let readerIdMap = { hazal: null, umut: null };

// Protected sayfalar için hemen gizle (parsedan önce bile)
(function() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('main.html') || path.includes('history.html') || 
        path.endsWith('/main') || path.endsWith('/history')) {
        
    // Arka plan hazır olsun
    document.documentElement.style.background = 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #0f0f23 100%)';
    document.documentElement.classList.add('pre-auth');
    }
})();

// Sayfa yükleme
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = getCurrentPage();
    if (currentPage === 'index') {
        // Index sayfası için loading overlay kullanmıyoruz, görünür bırak
        document.documentElement.classList.remove('pre-auth');
        document.documentElement.classList.add('auth-ready');
        initLoginPage();
    } else {
        // Protected pages: auth doğrulanana kadar overlay gösterilecek
        document.documentElement.classList.add('pre-auth');
        checkAuthAndInit();
    }
});

// Back/forward cache'den (bfcache) dönüldüğünde oturumu tekrar doğrula
window.addEventListener('pageshow', function() {
    const page = getCurrentPage();
    if (page === 'main' || page === 'history') {
    // Sadece sınıfları kullan
    document.documentElement.classList.add('pre-auth');
    document.documentElement.classList.remove('auth-ready');
        
        const overlay = document.getElementById('app-loading');
        if (overlay) overlay.classList.remove('fade-out');
        
        // Auth kontrolü - hızlı
        fetchCurrentSession().then(ok => {
            if (!ok) {
                currentUser = { id: null, name: null };
                window.location.replace('index.html');
            } else {
                // Content yüklenme bekle + smooth göster
                authVisualDone();
            }
        });
    }
});

function getCurrentPage() {
    // Önce URL üzerinden dene
    const path = window.location.pathname.toLowerCase();
    if (path.includes('main.html') || path.endsWith('/main') || path.endsWith('/main/')) return 'main';
    if (path.includes('history.html') || path.endsWith('/history') || path.endsWith('/history/')) return 'history';
    // URL tutmuyorsa DOM işaretçileri ile tespit et (daha güvenli)
    if (document.getElementById('history-content')) return 'history';
    if (document.getElementById('dashboard-content')) return 'main';
    return 'index';
}

function initLoginPage() {
    loadReaderAvatars();
    setupLoginEvents();
}

function checkAuthAndInit() {
    fetchCurrentSession().then(ok => {
        if (!ok) {
            // Oturum yoksa geçmişte geri dönülebilir bir kayıt oluşturmadan login'e gönder
            window.location.replace('index.html');
            return;
        }
        const currentPage = getCurrentPage();
        if (currentPage === 'main') {
            initMainPage();
        } else if (currentPage === 'history') {
            initHistoryPage();
        }
        setupCommonEvents();
        updateUserInfo();
        authVisualDone();
    });
}

function authVisualDone() {
    // Yumuşak geçiş için content hazırlık + fade-in
    setTimeout(() => {
        const overlay = document.getElementById('app-loading');
        
    // Class değişimi - smooth transition
    document.documentElement.classList.remove('pre-auth');
    document.documentElement.classList.add('auth-ready');

    // Güvenlik: varsa inline gizleme temizle
    document.documentElement.style.visibility = '';
    document.documentElement.style.opacity = '';
    if (document.body) document.body.style.visibility = '';
        
        // Overlay yumuşak çıkış
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => { 
                if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); 
            }, 600);
        }
    }, 200); // Kısa bekleme - content hazırlık
}

// Giriş sayfası fonksiyonları
function loadReaderAvatars() {
    const hazal = document.getElementById('hazal-avatar');
    const umut = document.getElementById('umut-avatar');
    if (hazal) hazal.src = 'images/Hazal.jpg';
    if (umut) umut.src = 'images/Umut.jpeg';
}

function setupLoginEvents() {
    const readerCards = document.querySelectorAll('.reader-card');
    const pinModal = document.getElementById('pin-modal');
    const nameInput = document.getElementById('name-input');
    const pinInput = document.getElementById('pin-input');
    const loginForm = document.getElementById('login-form');
    const cancelBtn = document.getElementById('cancel-btn');
    const selectedReaderInfo = document.getElementById('selected-reader-info');
    const errorMessage = document.getElementById('error-message');

    // Eğer login sayfası elementleri yoksa (yanlış tespit) güvenli çık
    if (!loginForm || !pinModal) return;

    readerCards.forEach(card => {
        card.addEventListener('click', function() {
            const readerId = this.dataset.readerId;
            const readerName = this.dataset.readerName;

            currentUser.id = parseInt(readerId);

            selectedReaderInfo.textContent = `${readerName} olarak giriş yapıyorsunuz`;
            nameInput.value = readerName;
            pinModal.style.display = 'flex';
            nameInput.focus();
            errorMessage.textContent = '';
        });
    });

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            pinModal.style.display = 'none';
            nameInput.value = '';
            pinInput.value = '';
            errorMessage.textContent = '';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            attemptLogin();
        });
    }
}

async function attemptLogin() {
    const nameInput = document.getElementById('name-input');
    const pinInput = document.getElementById('pin-input');
    const errorMessage = document.getElementById('error-message');

    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();

    if (!name) {
        errorMessage.textContent = 'İsim gereklidir.';
        nameInput.focus();
        return;
    }

    if (!pin || pin.length < 4) {
        errorMessage.textContent = 'PIN en az 4 haneli olmalıdır.';
        pinInput.focus();
        return;
    }

    currentUser.name = name;
    const payload = { name, pin };
    // debug kaldırıldı

    try {
        const loginResp = await apiCall('POST', '/Account/login', payload);
    // debug kaldırıldı
        currentUser = { 
            id: loginResp.id, 
            name: loginResp.name,   
            targetCount: loginResp.targetCount, 
            currentRound: loginResp.currentRound 
        };
        window.location.href = 'main.html';
    } catch (error) {
        if (error.status === 401) {
            errorMessage.textContent = 'Geçersiz bilgiler!';
        } else if (error.status === 400) {
            errorMessage.textContent = 'Bilgileri kontrol edin.';
        } else {
            errorMessage.textContent = 'Sunucu hatası. Tekrar deneyin.';
        }
        pinInput.focus();
    }
}

// Ana sayfa fonksiyonları
function initMainPage() {
    // Avatarlar başlangıçta boş görünmesin diye hemen ayarla
    try { loadReaderAvatars(); } catch(_) {}
    loadAllUsersData();
    setupMainPageEvents();
    showCurrentUserActions();
}

async function loadAllUsersData() {
    try {
        const readers = await apiCall('GET', '/Readers');
        readers.forEach(r => {
            const key = (r.name || '').toLowerCase();
            if (key === 'hazal') readerIdMap.hazal = r.id;
            if (key === 'umut') readerIdMap.umut = r.id;
        });
        
    // debug kaldırıldı
        if (readerIdMap.hazal) {
            // debug kaldırıldı
            await loadUserData(readerIdMap.hazal, 'hazal');
        } else {
            console.warn('readerIdMap.hazal is missing!');
        }
        if (readerIdMap.umut) {
            // debug kaldırıldı
            await loadUserData(readerIdMap.umut, 'umut');
        } else {
            console.warn('readerIdMap.umut is missing!');
        }
    } catch (err) {
        console.error('Kullanıcı listesi yüklenemedi:', err);
    }
}

async function loadUserData(userId, userPrefix) {
    // debug kaldırıldı
    
    try {
        // İstatistikleri yükle
        const stats = await apiCall('GET', `/Readers/${userId}/stats`);
        document.getElementById(`${userPrefix}-target`).textContent = stats.target;
        document.getElementById(`${userPrefix}-done`).textContent = stats.done;
        document.getElementById(`${userPrefix}-remaining`).textContent = stats.remaining;
        document.getElementById(`${userPrefix}-progress`).textContent = `${stats.progressPct}%`;
        
        // İlerleme çubuğunu güncelle
        const progressFill = document.getElementById(`${userPrefix}-progress-bar`);
        if (progressFill) progressFill.style.width = `${stats.progressPct}%`;

        // Statik avatar kullan
        const avatarImg = document.getElementById(`${userPrefix}-avatar`);
        if (avatarImg) avatarImg.src = userPrefix === 'hazal' ? 'images/Hazal.jpg' : 'images/Umut.jpeg';
        
        // Kitapları yükle
        const books = await apiCall('GET', `/readers/${userId}/items`);
        const booksContainer = document.getElementById(`${userPrefix}-books`);

        if (books.length === 0) {
            booksContainer.innerHTML = '<div class="no-data"><p>Henüz kitap bulunmuyor.</p></div>';
            return;
        }

        const canEdit = currentUser.id === userId;

        booksContainer.innerHTML = books.map(book => {
            const actions = canEdit ? `
                <div class="flex gap-2 pl-2 pb-2 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="px-4 py-2 bg-dark-card border border-dark-border-light rounded hover:bg-dark-border transition-colors text-sm font-medium" data-action="toggle" data-user-id="${userId}" data-book-id="${book.id}" aria-label="${book.isDone ? 'Kitabı yeniden aç' : 'Kitabı bitir'}">${book.isDone ? '⟳ Aç' : '✔️ Bitir'}</button>
                    <button class="px-4 py-2 bg-dark-card border border-dark-border-light rounded hover:bg-dark-border transition-colors text-sm" data-action="edit" data-user-id="${userId}" data-book-id="${book.id}" data-title="${escapeAttr(book.title)}" data-started-at="${escapeAttr(book.startedAt || '')}" aria-label="Kitabı düzenle: ${escapeAttr(book.title)}">✏️</button>
                    <button class="px-4 py-2 bg-dark-card border border-dark-border-light rounded hover:bg-red-600/60 transition-colors text-sm" data-action="delete" data-user-id="${userId}" data-book-id="${book.id}" data-title="${escapeAttr(book.title)}" aria-label="Kitabı sil: ${escapeAttr(book.title)}">🗑️</button>
                </div>` : '';
            return `
                <div class="book-item group" data-status="${getStatusClass(book.isDone, book.startedAt).replace('status-','')}" data-id="${book.id}">
                    <h4 class="pr-2 flex items-start justify-between gap-2">
                        <span class="text-dark-text flex-1">${escapeHtml(book.title)}</span>
                        <span class="book-status ${getStatusClass(book.isDone, book.startedAt)}">${getStatusText(book.isDone, book.startedAt)}</span>
                    </h4>
                    <div class="flex items-center gap-2 pl-2 pb-1">
                        <div class="round-info round-color-${book.round % 5}">Tur ${book.round}</div>
                    </div>
                    <div class="book-dates pl-2 mb-2">
                        ${book.startedAt ? `Başlangıç: ${formatDate(book.startedAt)}` : ''}
                        ${book.finishedAt ? `<br>Bitiş: ${formatDate(book.finishedAt)}` : ''}
                        <br>Oluşturulma: ${formatDate(book.createdAt)}
                    </div>
                    ${actions}
                </div>`;
        }).join('');

    } catch (error) {
        console.error(`${userPrefix} veri yükleme hatası:`, error);
    }
}

function showCurrentUserActions() {
    const nameLower = (currentUser.name || '').toLowerCase();
    let userPrefix;
    if (nameLower === 'hazal') userPrefix = 'hazal';
    else if (nameLower === 'umut') userPrefix = 'umut';
    else {
        ['hazal-actions','umut-actions'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        return;
    }
    
    ['hazal-actions','umut-actions'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    const actionsDiv = document.getElementById(`${userPrefix}-actions`);
    if (actionsDiv) actionsDiv.style.display = 'flex';
}

function setupMainPageEvents() {
    const updateModal = document.getElementById('update-modal');
    const updateForm = document.getElementById('update-form');
    const closeUpdateModal = document.getElementById('close-update-modal');

    if (closeUpdateModal) {
        closeUpdateModal.addEventListener('click', function() {
            updateModal.style.display = 'none';
        });
    }

    if (updateForm) {
        updateForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const updateData = {
                name: document.getElementById('new-name').value || null,
                targetCount: parseInt(document.getElementById('new-target').value) || null,
                currentRound: parseInt(document.getElementById('new-round').value) || null
            };

            try {
                await apiCall('PUT', `/Readers/${currentUser.id}`, updateData);
                updateModal.style.display = 'none';

                loadAllUsersData();

                if (updateData.name) {
                    currentUser.name = updateData.name;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    updateUserInfo();
                }

            } catch (error) {
                const errorDiv = document.getElementById('update-error-message');
                errorDiv.textContent = 'Update error: ' + (error.message || 'Unknown error');
            }
        });
    }

    // Round confirm modal events
    const roundConfirmModal = document.getElementById('round-confirm-modal');
    const roundConfirmYes = document.getElementById('round-confirm-yes');
    const roundConfirmNo = document.getElementById('round-confirm-no');
    const roundResultModal = document.getElementById('round-result-modal');
    const roundResultOk = document.getElementById('round-result-ok');

    // Delete confirm modal events
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const deleteConfirmYes = document.getElementById('delete-confirm-yes');
    const deleteConfirmNo = document.getElementById('delete-confirm-no');

    // Info modal events
    const infoModal = document.getElementById('info-modal');
    const infoModalOk = document.getElementById('info-modal-ok');

    if (roundConfirmYes) {
        roundConfirmYes.addEventListener('click', confirmRoundIncrease);
    }
    
    if (roundConfirmNo) {
        roundConfirmNo.addEventListener('click', hideRoundConfirmModal);
    }
    
    if (roundResultOk) {
        roundResultOk.addEventListener('click', hideRoundResultModal);
    }

    if (deleteConfirmYes) {
        deleteConfirmYes.addEventListener('click', confirmBookDelete);
    }
    
    if (deleteConfirmNo) {
        deleteConfirmNo.addEventListener('click', hideDeleteConfirmModal);
    }

    if (infoModalOk) {
        infoModalOk.addEventListener('click', hideInfoModal);
    }

    // Modal backdrop click to close
    if (roundConfirmModal) {
        roundConfirmModal.addEventListener('click', function(e) {
            if (e.target === roundConfirmModal) {
                hideRoundConfirmModal();
            }
        });
    }
    
    if (roundResultModal) {
        roundResultModal.addEventListener('click', function(e) {
            if (e.target === roundResultModal) {
                hideRoundResultModal();
            }
        });
    }

    if (deleteConfirmModal) {
        deleteConfirmModal.addEventListener('click', function(e) {
            if (e.target === deleteConfirmModal) {
                hideDeleteConfirmModal();
            }
        });
    }

    if (infoModal) {
        infoModal.addEventListener('click', function(e) {
            if (e.target === infoModal) {
                hideInfoModal();
            }
        });
    }

    // Delegated UI actions (profile/update/add book/round)
    document.addEventListener('click', function(e) {
        const uiBtn = e.target.closest('[data-ui-action]');
        if (!uiBtn) return;
        const action = uiBtn.getAttribute('data-ui-action');
        if (action === 'update-profile') {
            updateProfile();
        } else if (action === 'open-add-book') {
            openAddBookModal();
        } else if (action === 'increase-round') {
            increaseRound();
        } else if (action === 'close-add-book-modal') {
            closeAddBookModal();
        } else if (action === 'close-edit-book-modal') {
            closeEditBookModal();
        }
    });

    // Form submit delegation (avoid inline onsubmit)
    const addBookForm = document.getElementById('add-book-form');
    if (addBookForm) {
        addBookForm.addEventListener('submit', function(ev) {
            ev.preventDefault();
            addNewBook();
        });
    }
    const editBookForm = document.getElementById('edit-book-form');
    if (editBookForm) {
        editBookForm.addEventListener('submit', function(ev) {
            ev.preventDefault();
            submitEditBook();
        });
    }

    // Delegated book action buttons (toggle/edit/delete)
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const userId = parseInt(btn.getAttribute('data-user-id'), 10);
        const bookId = parseInt(btn.getAttribute('data-book-id'), 10);
        if (!userId || !bookId) return;
        if (action === 'toggle') {
            toggleBook(userId, bookId);
        } else if (action === 'edit') {
            openEditBookModal(bookId, btn.getAttribute('data-title') || '', btn.getAttribute('data-started-at') || '');
        } else if (action === 'delete') {
            deleteBook(userId, bookId, btn.getAttribute('data-title') || '');
        }
    });
}

// Kitap ekleme fonksiyonu
async function addBook(readerId, title, startedAt = null) {
    if (!currentUser.id) { 
        showInfoModal('warning', 'Login Required', 'Please log in first!');
        return false; 
    }

    const body = {
        title: title.trim()
    };

    if (startedAt) {
        body.startedAt = startedAt;
    }

    try {
        const response = await apiCall('POST', `/ReadingItems/${readerId}`, body);
    // debug kaldırıldı
        return response;
    } catch (error) {
        console.error('Kitap ekleme hatası:', error);
        throw error;
    }
}

// Global fonksiyonlar - HTML'den çağrılacak
window.updateProfile = async function() {
    if (!currentUser.id) {
        showInfoModal('warning', 'Oturum Hatası', 'Oturum bulunamadı. Lütfen yeniden giriş yapın.');
        return;
    }
    try {
        const reader = await apiCall('GET', `/Readers/${currentUser.id}`);
        document.getElementById('new-name').value = reader.name || '';
        document.getElementById('new-target').value = reader.targetCount || '';
        document.getElementById('new-round').value = reader.currentRound || '';
        document.getElementById('update-modal').style.display = 'flex';
    } catch (error) {
        console.error('Profil yükleme hatası:', error);
        showInfoModal('error', 'Profil Hatası', 'Profil verisi alınamadı. Lütfen tekrar deneyin.');
    }
}

window.addNewBook = async function() {
    if (!currentUser.id) {
        showInfoModal('warning', 'Giriş Gerekli', 'Önce giriş yapmalısınız!');
        return;
    }

    const titleInput = document.getElementById('book-title-input');
    const startDateInput = document.getElementById('book-start-date-input');

    const title = titleInput.value.trim();

    if (!title) {
        showInfoModal('warning', 'Eksik Bilgi', 'Kitap adı boş olamaz!');
        return;
    }

    if (title.length > 200) {
        showInfoModal('warning', 'Uzun Başlık', 'Kitap adı 200 karakterden uzun olamaz!');
        return;
    }

    let startedAt = null;
    if (startDateInput.value) {
        startedAt = startDateInput.value; // Sadece YYYY-MM-DD formatında gönder
    }

    try {
        await addBook(currentUser.id, title, startedAt);

        showInfoModal('success', 'Kitap Eklendi', 'Kitap başarıyla eklendi!');

        const modal = document.getElementById('add-book-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        titleInput.value = '';
        startDateInput.value = '';

        await loadAllUsersData();

    } catch (error) {
        const errorMsg = error.message || 'Kitap eklenirken hata oluştu!';
        showInfoModal('error', 'Ekleme Hatası', errorMsg);
    }
};

window.openAddBookModal = function() {
    const modal = document.getElementById('add-book-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeAddBookModal = function() {
    const modal = document.getElementById('add-book-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('book-title-input').value = '';
    document.getElementById('book-start-date-input').value = '';
};

// Geçmiş sayfası fonksiyonları
function initHistoryPage() {
    loadAllUsersHistory();
    setupHistoryEvents();
}

// Round artırma
window.increaseRound = async function() {
    if (!currentUser.id) return;
    showRoundConfirmModal();
};

// Round confirm modal functions
function showRoundConfirmModal() {
    const modal = document.getElementById('round-confirm-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideRoundConfirmModal() {
    const modal = document.getElementById('round-confirm-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Delete confirm modal functions
let deleteBookData = { readerId: null, itemId: null, title: '' };

function showDeleteConfirmModal(readerId, itemId, title) {
    deleteBookData = { readerId, itemId, title };
    const modal = document.getElementById('delete-confirm-modal');
    const titleEl = document.getElementById('delete-book-title');
    titleEl.textContent = `"${title}"`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideDeleteConfirmModal() {
    const modal = document.getElementById('delete-confirm-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function confirmBookDelete() {
    // Verileri önce al, sonra modalı kapat; aksi halde reset edilip null oluyor
    const { readerId, itemId, title } = deleteBookData;
    hideDeleteConfirmModal();
    
    // debug kaldırıldı
    
    // Double validation
    if (readerId == null || itemId == null) {
        console.error('confirmBookDelete: Invalid data - readerId:', readerId, 'itemId:', itemId);
        showInfoModal('error', 'Hata', 'Silme işlemi için gerekli bilgiler eksik.');
        return;
    }
    
    try {
    // debug kaldırıldı
        await apiCall('DELETE', `/ReadingItems/${readerId}/${itemId}`);
        await loadAllUsersData();
        showInfoModal('success', 'Kitap Silindi', `"${title}" başarıyla silindi.`);
    } catch(e) { 
        console.error('Delete error:', e);
        showInfoModal('error', 'Silme Hatası', 'Kitap silinemedi. Lütfen tekrar deneyin.');
    }
    // İşlem bittiğinde resetle
    deleteBookData = { readerId: null, itemId: null, title: '' };
}

// General info modal functions
function showInfoModal(type, title, message) {
    const modal = document.getElementById('info-modal');
    const icon = document.getElementById('info-modal-icon');
    const titleEl = document.getElementById('info-modal-title');
    const messageEl = document.getElementById('info-modal-message');
    
    if (type === 'success') {
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-green-600/20 rounded-full flex items-center justify-center';
        icon.innerHTML = '<span class="text-2xl">✅</span>';
        titleEl.className = 'text-lg font-semibold text-green-400 mb-2';
    } else if (type === 'error') {
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-red-600/20 rounded-full flex items-center justify-center';
        icon.innerHTML = '<span class="text-2xl">❌</span>';
        titleEl.className = 'text-lg font-semibold text-red-400 mb-2';
    } else if (type === 'warning') {
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-yellow-600/20 rounded-full flex items-center justify-center';
        icon.innerHTML = '<span class="text-2xl">⚠️</span>';
        titleEl.className = 'text-lg font-semibold text-yellow-400 mb-2';
    } else { // info
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-blue-600/20 rounded-full flex items-center justify-center';
        icon.innerHTML = '<span class="text-2xl">ℹ️</span>';
        titleEl.className = 'text-lg font-semibold text-blue-400 mb-2';
    }
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideInfoModal() {
    const modal = document.getElementById('info-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showRoundResultModal(success, message) {
    const modal = document.getElementById('round-result-modal');
    const icon = document.getElementById('round-result-icon');
    const title = document.getElementById('round-result-title');
    const messageEl = document.getElementById('round-result-message');
    
    if (success) {
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-green-600/20 rounded-full flex items-center justify-center';
        icon.innerHTML = '<span class="text-2xl">✅</span>';
        title.textContent = 'Round Artırıldı';
        title.className = 'text-lg font-semibold text-green-400 mb-2';
    } else {
        icon.className = 'w-16 h-16 mx-auto mb-4 bg-red-600/20 rounded-full flex items-center justify-center';
        icon.innerHTML = '<span class="text-2xl">❌</span>';
        title.textContent = 'Hata Oluştu';
        title.className = 'text-lg font-semibold text-red-400 mb-2';
    }
    
    messageEl.textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function hideRoundResultModal() {
    const modal = document.getElementById('round-result-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function confirmRoundIncrease() {
    hideRoundConfirmModal();
    try {
        await apiCall('PATCH', `/Readers/${currentUser.id}/round`, { confirm: true });
        await loadAllUsersData();
        showRoundResultModal(true, 'Round başarıyla artırıldı. Yeni tur başladı!');
    } catch(e) { 
        showRoundResultModal(false, 'Round artırılamadı. Lütfen tekrar deneyin.');
    }
}

// Toggle done
window.toggleBook = async function(readerId, itemId) {
    try {
        await apiCall('PATCH', `/ReadingItems/${readerId}/${itemId}`);
        await loadAllUsersData();
    } catch(e) { 
        showInfoModal('error', 'Güncelleme Hatası', 'Kitap durumu güncellenemedi. Lütfen tekrar deneyin.');
    }
};

// Sil
window.deleteBook = async function(readerId, itemId, title = 'Bu kitap') {
    // debug kaldırıldı
    
    // Validation ekle
    if (!readerId || !itemId) {
        console.error('deleteBook: Invalid parameters - readerId:', readerId, 'itemId:', itemId);
        showInfoModal('error', 'Hata', 'Kitap silme işlemi için gerekli bilgiler eksik.');
        return;
    }
    
    showDeleteConfirmModal(readerId, itemId, title);
};

// Edit modal aç
window.openEditBookModal = function(id, title, startedAt) {
    const m = document.getElementById('edit-book-modal');
    document.getElementById('edit-book-id').value = id;
    document.getElementById('edit-book-title').value = title;
    const dt = document.getElementById('edit-book-start-date');
    dt.value = startedAt ? toLocalInputValue(startedAt) : '';
    m.classList.remove('hidden'); 
    m.classList.add('flex');
};

window.closeEditBookModal = function() {
    const m = document.getElementById('edit-book-modal');
    m.classList.add('hidden'); 
    m.classList.remove('flex');
};

window.submitEditBook = async function() {
    const id = document.getElementById('edit-book-id').value;
    const title = document.getElementById('edit-book-title').value.trim();
    const startedAt = document.getElementById('edit-book-start-date').value;
    const body = {};
    if (title) body.title = title;
    if (startedAt) body.startedAt = startedAt; // Sadece YYYY-MM-DD formatında gönder
    try {
        await apiCall('PATCH', `/ReadingItems/${currentUser.id}/${id}/edit`, body);
        closeEditBookModal();
        await loadAllUsersData();
    } catch(e) { 
        document.getElementById('edit-book-error').textContent = 'Güncellenemedi'; 
    }
};

// Yardımcı: XSS kaçış (hem HTML içerik hem attribute için kullanılabilir)
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[m]));
}

// Attribute özelinde ayrı fonksiyon (şimdilik escapeHtml ile aynı)
function escapeAttr(str) {
    return escapeHtml(str);
}

function toLocalInputValue(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

async function loadAllUsersHistory() {
    if (!readerIdMap.hazal || !readerIdMap.umut) {
        try {
            const readers = await apiCall('GET', '/Readers');
            readers.forEach(r => {
                const key = (r.name || '').toLowerCase();
                if (key === 'hazal') readerIdMap.hazal = r.id;
                if (key === 'umut') readerIdMap.umut = r.id;
            });
        } catch(e) { 
            console.error('Reader id haritalama hatası:', e); 
        }
    }
    if (readerIdMap.hazal) await loadUserHistory(readerIdMap.hazal, 'hazal');
    if (readerIdMap.umut) await loadUserHistory(readerIdMap.umut, 'umut');
}

async function loadUserHistory(userId, userPrefix) {
    try {
        const onlyDone = document.getElementById('only-done-filter').checked;
        const history = await apiCall('GET', `/Readers/${userId}/history?onlyDone=${onlyDone}`);
        const historyContainer = document.getElementById(`${userPrefix}-history`);
        const noHistory = document.getElementById(`${userPrefix}-no-history`);

        // Statik avatar
        const avatarImg = document.getElementById(`${userPrefix}-avatar`);
        if (avatarImg) avatarImg.src = userPrefix === 'hazal' ? 'images/Hazal.jpg' : 'images/Umut.jpeg';

        if (history.length === 0) {
            historyContainer.style.display = 'none';
            noHistory.style.display = 'block';
            return;
        }

        historyContainer.style.display = 'grid';
        noHistory.style.display = 'none';

        historyContainer.innerHTML = history.map(item => `
            <div class="history-item" data-status="${getStatusClass(item.isDone, item.startedAt).replace('status-','')}">
                <h3>${escapeHtml(item.title)}</h3>
                <div class="book-status ${getStatusClass(item.isDone, item.startedAt)}">
                    ${getStatusText(item.isDone, item.startedAt)}
                </div>
                <div class="round-info round-color-${item.round % 5}">Tur ${item.round}</div>
                <div class="history-dates">
                    ${item.startedAt ? `Başlangıç: ${formatDate(item.startedAt)}` : ''}
                    ${item.finishedAt ? `<br>Bitiş: ${formatDate(item.finishedAt)}` : ''}
                    <br>Oluşturulma: ${formatDate(item.createdAt)}
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error(`${userPrefix} geçmiş yükleme hatası:`, error);
    }
}

function setupHistoryEvents() {
    const onlyDoneFilter = document.getElementById('only-done-filter');
    onlyDoneFilter.addEventListener('change', loadAllUsersHistory);
}

// Ortak fonksiyonlar
function setupCommonEvents() {
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async function() {
        try { 
            await apiCall('POST', '/Account/logout'); 
        } catch(e) { 
            /* yoksay */ 
        }
        currentUser = { id: null, name: null };
        // LOGOUT - YUMUŞAK GİZLEME
        document.documentElement.classList.add('pre-auth');
        document.documentElement.classList.remove('auth-ready');
        
        // Style backup
        document.documentElement.style.opacity = '0';
        document.documentElement.style.visibility = 'hidden';
        if (document.body) document.body.style.visibility = 'hidden';
        
        if (getCurrentPage() !== 'index') {
            // protected page logout - overlay göster
            let overlay = document.getElementById('app-loading');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'app-loading';
                overlay.className = 'loading-overlay';
                overlay.innerHTML = '<div class="spinner" aria-hidden="true"></div><span class="loading-text">Çıkış yapılıyor...</span>';
                document.body.appendChild(overlay);
            } else {
                overlay.querySelector('.loading-text').textContent = 'Çıkış yapılıyor...';
                overlay.classList.remove('fade-out');
            }
        }
        
        // Kısa bekleme - smooth transition
        setTimeout(() => {
            window.location.replace('index.html');
        }, 300);
    });
}

async function updateUserInfo() {
    try {
        const reader = await apiCall('GET', `/Readers/${currentUser.id}`);
        const userNameSpan = document.getElementById('current-user-name');
        const userAvatar = document.getElementById('current-user-avatar');
        if (userNameSpan) userNameSpan.textContent = reader.name;
        if (userAvatar) userAvatar.src = reader.name.toLowerCase() === 'hazal' ? 'images/Hazal.jpg' : 'images/Umut.jpeg';
    } catch (error) {
        console.error('Kullanıcı bilgisi yükleme hatası:', error);
    }
}

// Yardımcı fonksiyonlar
async function apiCall(method, endpoint, data = null, isFormData = false, opts = {}) {
    const url = API_BASE + endpoint;
    const headers = {};

    // Kritik: Login için kesin JSON header ve body
    if (endpoint === '/Account/login' && data) {
        headers['Content-Type'] = 'application/json';
    // debug kaldırıldı
        const jsonBody = JSON.stringify(data);
    // debug kaldırıldı

        const config = {
            method: 'POST',
            headers,
            credentials: 'include',
            body: jsonBody
        };

    // debug kaldırıldı
        const response = await fetch(url, config);

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            try { 
                error.body = await response.json(); 
            } catch(_) {}
            throw error;
        }
        return await response.json();
    }

    // Diğer tüm istekler için normal akış
    if (opts.forceJson || (!isFormData && data && method !== 'GET')) {
        headers['Content-Type'] = 'application/json';
    }

    const config = { method, headers, credentials: 'include' };
    if (data) config.body = isFormData ? data : JSON.stringify(data);

    const response = await fetch(url, config);
    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        try { 
            error.body = await response.json(); 
        } catch(_) {}
        throw error;
    }
    if (response.status === 204) return null;
    return await response.json();
}

// Geçerli session var mı kontrol
async function fetchCurrentSession() {
    try {
        const me = await apiCall('GET', '/Account/me');
        currentUser = { 
            id: me.id, 
            name: me.name, 
            targetCount: me.targetCount, 
            currentRound: me.currentRound 
        };
        return true;
    } catch(e) {
        return false;
    }
}

function getStatusClass(isDone, startedAt) {
    if (isDone) return 'status-done';
    if (startedAt) return 'status-reading';
    return 'status-not-started';
}

function getStatusText(isDone, startedAt) {
    if (isDone) return 'Tamamlandı';
    if (startedAt) return 'Okunuyor';
    return 'Başlanmadı';
}

function formatDate(dateString) {
    if (!dateString) return '';
    // Orijinal tarih (genelde UTC olarak geliyor varsayımıyla)
    const original = new Date(dateString);
    if (isNaN(original.getTime())) return '';

    // İstanbul sabit UTC+3 (DST dikkate alınmıyor) – hızlı çözüm
    const IST_OFFSET_MS = 3 * 60 * 60 * 1000;
    const adjusted = new Date(original.getTime() + IST_OFFSET_MS);

    const hasTime = original.getUTCHours() !== 0 || original.getUTCMinutes() !== 0 || /T\d{2}:\d{2}/.test(dateString);

    // Saat bilgisi varsa HH:MM de göster
    if (hasTime) {
        return adjusted.toLocaleString('tr-TR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    // Yoksa sadece tarih
    return adjusted.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}
