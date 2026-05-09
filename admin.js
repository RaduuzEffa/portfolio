let rootDirHandle = null;
let dataFileHandle = null;
let db = { collections: [], galleries: [], photos: [] };
let hasUnsavedChanges = false;

const authView = document.getElementById('auth-view');
const dashView = document.getElementById('dashboard-view');
const statusText = document.getElementById('status-text');
const btnSave = document.getElementById('btn-save');

const modal = document.getElementById('crud-modal');
const modalContent = document.getElementById('crud-modal-content');
const crudForm = document.getElementById('crud-form');

// Elements
const jsonEditor = document.getElementById('json-editor');

// Inicializace
document.getElementById('btn-select-dir').addEventListener('click', async () => {
    try {
        rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        
        try {
            dataFileHandle = await rootDirHandle.getFileHandle('data.js', { create: true });
            const file = await dataFileHandle.getFile();
            let text = await file.text();
            
            // Odstraníme "window.LOCAL_DB =" prefix pokud existuje
            if (text.startsWith('window.LOCAL_DB =')) {
                text = text.replace('window.LOCAL_DB =', '').trim();
                if (text.endsWith(';')) text = text.slice(0, -1);
            }
            
            db = text ? JSON.parse(text) : { collections: [], galleries: [], photos: [] };
            if(!db.collections) db.collections = [];
            if(!db.galleries) db.galleries = [];
            if(!db.photos) db.photos = [];
        } catch (e) {
            alert('Chyba při čtení data.js: ' + e.message);
            return;
        }

        authView.classList.add('hidden');
        dashView.classList.remove('hidden');
        btnSave.classList.remove('hidden');
        statusText.textContent = 'Aktivní složka: ' + rootDirHandle.name;
        
        jsonEditor.value = JSON.stringify(db, null, 2);
        jsonEditor.addEventListener('input', () => markUnsaved());

        renderAll();

    } catch (err) {
        if (err.name !== 'AbortError') alert('Nelze otevřít složku.');
    }
});

function markUnsaved() {
    hasUnsavedChanges = true;
    btnSave.classList.remove('bg-green-600', 'hover:bg-green-500');
    btnSave.classList.add('bg-red-600', 'hover:bg-red-500', 'animate-pulse');
}

function clearUnsaved() {
    hasUnsavedChanges = false;
    btnSave.classList.add('bg-green-600', 'hover:bg-green-500');
    btnSave.classList.remove('bg-red-600', 'hover:bg-red-500', 'animate-pulse');
    jsonEditor.value = JSON.stringify(db, null, 2);
}

btnSave.addEventListener('click', async () => {
    if (!dataFileHandle) return;
    try {
        // Zkusíme vzít změny z RAW editoru jestli je aktivní
        const rawTabActive = document.getElementById('tab-raw').classList.contains('tab-active');
        if (rawTabActive) {
            db = JSON.parse(jsonEditor.value);
            renderAll(); // Aktualizuj GUI
        }

        const writable = await dataFileHandle.createWritable();
        const jsonContent = JSON.stringify(db, null, 2);
        await writable.write('window.LOCAL_DB = ' + jsonContent + ';');
        await writable.close();
        clearUnsaved();
        
        const orig = btnSave.innerHTML;
        btnSave.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Uloženo!';
        lucide.createIcons();
        setTimeout(() => { btnSave.innerHTML = orig; lucide.createIcons(); }, 2000);
    } catch (err) {
        alert('Chyba ukládání nebo špatný formát JSON: ' + err.message);
    }
});

// UI TABS
window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    
    document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('tab-active', 'font-semibold', 'bg-white/10');
    });
    document.getElementById(`tab-${tabId}`).classList.add('tab-active', 'font-semibold', 'bg-white/10');
};

// RENDERERS
function renderAll() {
    renderCollections();
    renderGalleries();
    renderPhotos();
    updateFilters();
}

function updateFilters() {
    const parentSelectGal = document.getElementById('f-parent');
    const filterGal = document.getElementById('filter-gallery');
    
    // Pro filter photos
    filterGal.innerHTML = '<option value="all">Všechny galerie</option>' + db.galleries.map(g => `<option value="${g.id}">${g.title}</option>`).join('');
}

function renderCollections() {
    const list = document.getElementById('list-collections');
    list.innerHTML = db.collections.map(c => `
        <div class="glass p-4 rounded-xl flex gap-4 items-center group">
            <img src="${c.coverUrl || 'https://via.placeholder.com/150'}" class="w-16 h-16 rounded-lg object-cover">
            <div class="flex-1">
                <h3 class="font-bold">${c.title}</h3>
                <p class="text-xs text-white/40">ID: ${c.id} | NSFW: ${c.isNsfw?'Ano':'Ne'}</p>
            </div>
            <div class="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onclick="moveItem('col', '${c.id}', -1)" class="text-white/40 hover:text-white p-1" title="Posunout nahoru"><i data-lucide="arrow-up" class="w-4 h-4"></i></button>
                <button onclick="moveItem('col', '${c.id}', 1)" class="text-white/40 hover:text-white p-1" title="Posunout dolů"><i data-lucide="arrow-down" class="w-4 h-4"></i></button>
                <button onclick="openModal('col', '${c.id}')" class="text-blue-400 hover:text-white p-1 ml-2"><i data-lucide="edit" class="w-4 h-4"></i></button>
                <button onclick="deleteItem('col', '${c.id}')" class="text-red-400 hover:text-white p-1"><i data-lucide="trash" class="w-4 h-4"></i></button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function renderGalleries() {
    const list = document.getElementById('list-galleries');
    list.innerHTML = db.galleries.map(g => {
        const col = db.collections.find(c => c.id === g.collectionId) || {title: 'Neznámá'};
        return `
        <div class="glass p-4 rounded-xl flex gap-4 items-center group">
            <img src="${g.coverUrl || 'https://via.placeholder.com/150'}" class="w-16 h-16 rounded-lg object-cover">
            <div class="flex-1">
                <h3 class="font-bold">${g.title}</h3>
                <p class="text-xs text-white/40">Kolekce: ${col.title}</p>
            </div>
            <div class="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onclick="moveItem('gal', '${g.id}', -1)" class="text-white/40 hover:text-white p-1" title="Posunout nahoru"><i data-lucide="arrow-up" class="w-4 h-4"></i></button>
                <button onclick="moveItem('gal', '${g.id}', 1)" class="text-white/40 hover:text-white p-1" title="Posunout dolů"><i data-lucide="arrow-down" class="w-4 h-4"></i></button>
                <button onclick="openModal('gal', '${g.id}')" class="text-blue-400 hover:text-white p-1 ml-2"><i data-lucide="edit" class="w-4 h-4"></i></button>
                <button onclick="deleteItem('gal', '${g.id}')" class="text-red-400 hover:text-white p-1"><i data-lucide="trash" class="w-4 h-4"></i></button>
            </div>
        </div>
    `}).join('');
    lucide.createIcons();
}

window.renderPhotos = () => {
    const list = document.getElementById('list-photos');
    const filter = document.getElementById('filter-gallery').value;
    
    let filtered = db.photos;
    if (filter !== 'all') filtered = filtered.filter(p => p.galleryId === filter);

    list.innerHTML = filtered.map(p => {
        const gal = db.galleries.find(g => g.id === p.galleryId) || {title: 'Neznámá'};
        return `
        <div class="glass p-2 rounded-xl group relative">
            <img src="${p.url}" class="w-full h-32 object-cover rounded-lg mb-2">
            <h3 class="font-bold text-sm truncate">${p.title || 'Bez názvu'}</h3>
            <p class="text-xs text-white/40 truncate">${gal.title}</p>
            <div class="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition bg-black/50 p-1 rounded-lg backdrop-blur">
                <button onclick="moveItem('photo', '${p.id}', -1)" class="text-white/40 hover:text-white p-1" title="Posunout doleva"><i data-lucide="arrow-left" class="w-4 h-4"></i></button>
                <button onclick="moveItem('photo', '${p.id}', 1)" class="text-white/40 hover:text-white p-1" title="Posunout doprava"><i data-lucide="arrow-right" class="w-4 h-4"></i></button>
                <button onclick="deleteItem('photo', '${p.id}')" class="text-red-400 hover:text-white p-1 ml-2"><i data-lucide="trash" class="w-4 h-4"></i></button>
            </div>
        </div>
    `}).join('');
    lucide.createIcons();
}

// CRUD ACTIONS
window.openModal = (type, id = null) => {
    crudForm.reset();
    document.getElementById('f-type').value = type;
    document.getElementById('f-id').value = id || '';
    
    const isEdit = !!id;
    document.getElementById('modal-title').textContent = isEdit ? 'Upravit položku' : 'Nová položka';
    
    const groupParent = document.getElementById('f-group-parent');
    const groupNsfw = document.getElementById('f-group-nsfw');
    const groupFile = document.getElementById('f-group-file');
    const parentSelect = document.getElementById('f-parent');
    const parentLabel = document.getElementById('f-parent-label');
    const fileLabel = document.getElementById('f-file-label');

    groupParent.classList.add('hidden');
    groupNsfw.classList.remove('hidden');
    groupFile.classList.remove('hidden');
    fileLabel.textContent = 'Úvodní fotografie z disku (Cover)';

    let item = null;

    if (type === 'col') {
        if (isEdit) item = db.collections.find(x => x.id === id);
    } else if (type === 'gal') {
        groupParent.classList.remove('hidden');
        parentLabel.textContent = 'Zařadit do Kolekce';
        parentSelect.innerHTML = db.collections.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        if (isEdit) item = db.galleries.find(x => x.id === id);
    } else if (type === 'photo') {
        groupParent.classList.remove('hidden');
        groupNsfw.classList.add('hidden');
        fileLabel.textContent = 'Fotografie z disku';
        parentLabel.textContent = 'Zařadit do Galerie';
        parentSelect.innerHTML = db.galleries.map(g => `<option value="${g.id}">${g.title}</option>`).join('');
        // U fotky zatím edit nepodporujeme (jen smazat/přidat)
    }

    if (item) {
        document.getElementById('f-title').value = item.title || '';
        document.getElementById('f-titleEn').value = item.titleEn || '';
        document.getElementById('f-nsfw').checked = !!item.isNsfw;
        if (type === 'gal') document.getElementById('f-parent').value = item.collectionId;
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        modalContent.classList.remove('scale-95', 'opacity-0');
    }, 10);
};

window.closeModal = () => {
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.deleteItem = (type, id) => {
    if(!confirm('Opravdu smazat?')) return;
    
    if (type === 'col') {
        db.collections = db.collections.filter(x => x.id !== id);
    } else if (type === 'gal') {
        db.galleries = db.galleries.filter(x => x.id !== id);
    } else if (type === 'photo') {
        db.photos = db.photos.filter(x => x.id !== id);
    }
    
    markUnsaved();
    renderAll();
};

window.moveItem = (type, id, dir) => {
    let arr = type === 'col' ? db.collections : type === 'gal' ? db.galleries : db.photos;
    const idx = arr.findIndex(x => x.id === id);
    if (idx < 0) return;

    let targetIdx = idx + dir;
    
    if (type === 'gal' || type === 'photo') {
        const parentField = type === 'gal' ? 'collectionId' : 'galleryId';
        const parentVal = arr[idx][parentField];
        
        let found = -1;
        if (dir === -1) {
            for (let i = idx - 1; i >= 0; i--) {
                if (arr[i][parentField] === parentVal) { found = i; break; }
            }
        } else {
            for (let i = idx + 1; i < arr.length; i++) {
                if (arr[i][parentField] === parentVal) { found = i; break; }
            }
        }
        targetIdx = found;
    }

    if (targetIdx >= 0 && targetIdx < arr.length) {
        const temp = arr[idx];
        arr[idx] = arr[targetIdx];
        arr[targetIdx] = temp;
        markUnsaved();
        renderAll();
    }
};

crudForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('f-type').value;
    const id = document.getElementById('f-id').value;
    
    const btn = document.getElementById('f-submit-btn');
    btn.textContent = 'Zpracovávám...';
    btn.disabled = true;

    try {
        let newItem = {
            id: id || (type + '_' + Date.now()),
            title: document.getElementById('f-title').value,
            titleEn: document.getElementById('f-titleEn').value,
        };

        if (type === 'col' || type === 'gal') {
            newItem.isNsfw = document.getElementById('f-nsfw').checked;
            if (id) {
                const oldItem = type === 'col' ? db.collections.find(x=>x.id===id) : db.galleries.find(x=>x.id===id);
                if (oldItem) newItem.coverUrl = oldItem.coverUrl;
            }
        }

        if (type === 'gal' || type === 'photo') {
            const parentField = type === 'gal' ? 'collectionId' : 'galleryId';
            newItem[parentField] = document.getElementById('f-parent').value;
        }

        const fileInput = document.getElementById('f-file');
        
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const uploadsHandle = await rootDirHandle.getDirectoryHandle('uploads', { create: true });
            const photosHandle = await uploadsHandle.getDirectoryHandle('photos', { create: true });
            
            const safeName = Date.now() + '_' + file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            const fileHandle = await photosHandle.getFileHandle(safeName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(file);
            await writable.close();

            const savedPath = 'uploads/photos/' + safeName;
            
            if (type === 'photo') {
                newItem.url = savedPath;
            } else {
                newItem.coverUrl = savedPath;
            }
        } else if (type === 'photo') {
            alert('Musíte vybrat fotografii!');
            throw new Error('No file');
        }

        // Uložení do DB
        if (type === 'col') {
            if (id) { const i = db.collections.findIndex(x=>x.id===id); db.collections[i] = newItem; }
            else db.collections.push(newItem);
        } else if (type === 'gal') {
            if (id) { const i = db.galleries.findIndex(x=>x.id===id); db.galleries[i] = newItem; }
            else db.galleries.push(newItem);
        } else if (type === 'photo') {
            db.photos.push(newItem); // Edit fotky není
        }

        markUnsaved();
        renderAll();
        closeModal();

    } catch (err) {
        console.error(err);
    } finally {
        btn.textContent = 'Uložit';
        btn.disabled = false;
    }
});
