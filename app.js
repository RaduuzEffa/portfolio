document.addEventListener('DOMContentLoaded', async () => {

    // Service Worker Registration for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(reg => {
                console.log('ServiceWorker registrován:', reg.scope);
            }).catch(err => {
                console.error('Registrace ServiceWorker selhala:', err);
            });
        });
    }

    // Nastavení aktuálního roku v patičce
    document.getElementById('year').textContent = new Date().getFullYear();

    // ============================================
    // I18N — PŘEKLADY UI TEXTŮ
    // ============================================
    const i18n = {
        cs: {
            sectionGalleries: 'Exkluzivní Kolekce',
            nsfwTitle: 'Galerie Aktů (18+)',
            nsfwText: 'Tato fotogalerie ukrývá estetické fotografie a jemné odhalení krásy. Pokračujte, pouze pokud jste oslavili 18. narozeniny.',
            nsfwEnter: 'Vstoupit k dílům',
            nsfwLeave: 'Odejít zpět',
            emptyCollections: 'Zatím nebyly založeny žádné kolekce.',
            emptyGallery: 'Zatím prázdná kolekce.',
            emptyPhotos: 'Fotky se teprve vyvolávají...',
            close: 'Zavřít',
            heroPhotoSubtitle: 'Intimní umění optikou umělé\u00a0inteligence',
            heroPhotoTitle: 'AI<br class="sm:hidden"> FOTOGRAFIE',
            heroBrandSubtitle: 'Digitální alchymista 21. století',
        },
        en: {
            sectionGalleries: 'Exclusive Collections',
            nsfwTitle: 'Nude Gallery (18+)',
            nsfwText: 'This gallery contains aesthetic nude photography and subtle beauty. Continue only if you are 18 years or older.',
            nsfwEnter: 'Enter the Gallery',
            nsfwLeave: 'Go back',
            emptyCollections: 'No collections have been created yet.',
            emptyGallery: 'This collection is empty.',
            emptyPhotos: 'Photos are still developing...',
            close: 'Close',
            heroPhotoSubtitle: 'Intimate art through the lens of AI',
            heroPhotoTitle: 'AI<br class="sm:hidden"> PHOTOGRAPHY',
            heroBrandSubtitle: 'Digital Alchemist of the 21st Century',
        }
    };

    let currentLang = localStorage.getItem('lang') || 'cs';
    let globalData = { collections: [], galleries: [], photos: [] };
    let currentGalleryPhotos = [];
    let currentPhotoIndex = 0;

    function t(key) {
        return (i18n[currentLang] && i18n[currentLang][key]) || i18n.cs[key] || key;
    }
    function getLangTitle(item) {
        return (currentLang === 'en' && item.titleEn) ? item.titleEn : item.title;
    }
    function getLangDesc(item) {
        return (currentLang === 'en' && item.descriptionEn) ? item.descriptionEn : (item.description || '');
    }
    function getLangCategory(item) {
        return (currentLang === 'en' && item.categoryEn) ? item.categoryEn : (item.category || '');
    }

    // ============================================
    // PŘEPÍNAČ JAZYKA
    // ============================================
    window.setLang = (lang) => {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        updateLangUI();
        updateStaticTexts();
        renderCollections(globalData.collections);
        // Překreslit modal pokud je otevřený
        if (modal.classList.contains('active')) {
            const hash = window.location.hash;
            if (hash.startsWith('#collection-')) window.openCollection(hash.replace('#collection-', ''));
            else if (hash.startsWith('#gallery-')) window.openGallery(hash.replace('#gallery-', ''));
        }
    };

    function updateLangUI() {
        const btnCs = document.getElementById('lang-cs');
        const btnEn = document.getElementById('lang-en');
        if (btnCs) btnCs.classList.toggle('lang-active', currentLang === 'cs');
        if (btnEn) btnEn.classList.toggle('lang-active', currentLang === 'en');
    }

    function updateStaticTexts() {
        const el = (sel) => document.querySelector(sel);

        const photoSub = el('#hero-photo-subtitle');
        if (photoSub) photoSub.innerHTML = t('heroPhotoSubtitle');

        const nsfwH3 = el('#modal-nsfw h3');
        if (nsfwH3) nsfwH3.textContent = t('nsfwTitle');

        const nsfwP = el('#modal-nsfw p');
        if (nsfwP) nsfwP.textContent = t('nsfwText');

        const btnReveal = el('#modal-reveal');
        if (btnReveal) btnReveal.textContent = t('nsfwEnter');

        const nsfwLeave = el('#modal-nsfw .nsfw-leave-btn');
        if (nsfwLeave) nsfwLeave.textContent = t('nsfwLeave');

        const closeSpan = el('#modal-close span');
        if (closeSpan) closeSpan.textContent = t('close');

        const photoTitle = el('#hero-photo-title');
        if (photoTitle) photoTitle.innerHTML = t('heroPhotoTitle');

        const brandSubtitle = el('#hero-brand-subtitle');
        if (brandSubtitle) brandSubtitle.textContent = t('heroBrandSubtitle');
    }

    // ============================================
    // MODÁLNÍ PRVKY
    // ============================================
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalCloseBtn = document.getElementById('modal-close');
    const modalPhotoGrid = document.getElementById('modal-photo-grid');
    const modalNsfwOverlay = document.getElementById('modal-nsfw');
    const modalRevealBtn = document.getElementById('modal-reveal');

    const lightbox = document.getElementById('fullscreen-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCounter = document.getElementById('lightbox-counter');
    let isLightboxOpen = false;

    // ============================================
    // ZAVÍRÁNÍ A BROWSER HISTORY
    // ============================================
    function closeGalleryInternal() {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        setTimeout(() => { modalPhotoGrid.innerHTML = ''; }, 500);
    }

    modalCloseBtn.addEventListener('click', () => { window.location.hash = ''; });

    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (!hash.startsWith('#gallery') && !hash.startsWith('#collection')) {
            closeGalleryInternal();
            if (isLightboxOpen) window.closeLightbox();
        } else if (hash.startsWith('#collection-') && modal.classList.contains('active')) {
            window.openCollection(hash.replace('#collection-', ''));
        }
    });

    modalRevealBtn.addEventListener('click', () => {
        sessionStorage.setItem('nsfw_verified', 'true');
        modalNsfwOverlay.classList.add('hidden');
        modalPhotoGrid.classList.remove('nsfw-blur');
    });

    // ============================================
    // NAČTENÍ DAT
    // ============================================
    try {
        // Dynamické načtení data.js s cache-bustingem (obejde agresivní paměť prohlížeče)
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'data.js?t=' + Date.now();
            script.onload = resolve;
            script.onerror = () => reject(new Error('Nepodařilo se načíst data.js'));
            document.head.appendChild(script);
        });

        globalData = window.LOCAL_DB || { collections: [], galleries: [], photos: [] };
        if (!globalData.collections) globalData.collections = [];
        if (!globalData.galleries)   globalData.galleries = [];
        if (!globalData.photos)      globalData.photos = [];

        updateLangUI();
        updateStaticTexts();
        renderCollections(globalData.collections);

        const hash = window.location.hash;
        if (hash.startsWith('#collection-')) window.openCollection(hash.replace('#collection-', ''));
        else if (hash.startsWith('#gallery-')) window.openGallery(hash.replace('#gallery-', ''));

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Nepodařilo se natáhnout obsah webu:', err);
    }

    // ============================================
    // RENDEROVÁNÍ
    // ============================================
    function renderCollections(collections) {
        const grid = document.getElementById('gallery-grid');
        if (collections.length === 0) {
            grid.innerHTML = `<p class="text-white/30 font-outfit col-span-3 text-center uppercase tracking-[4px]">${t('emptyCollections')}</p>`;
            return;
        }
        grid.innerHTML = collections.map(col => {
            const cover = col.coverUrl || 'https://via.placeholder.com/600x800/111/333?text=NO+IMAGE';
            return `
            <div class="album-card group relative" onclick="openCollection('${col.id}')">
                <div class="album-card-img-wrapper">
                    <img src="${cover}" alt="${getLangTitle(col)}" loading="lazy">
                </div>
                <div class="album-card-footer">
                    <h3 class="album-title">${getLangTitle(col)}</h3>
                </div>
            </div>`;
        }).join('');
        if (window.lucide) lucide.createIcons();
    }


    // LOGIKA GALERIÍ
    // ============================================
    window.openCollection = (colId) => {
        const collection = globalData.collections.find(c => c.id === colId);
        if (!collection) return;

        window.location.hash = 'collection-' + colId;
        modalTitle.textContent = getLangTitle(collection);
        document.body.style.overflow = 'hidden';

        const galleryGrid = document.getElementById('modal-gallery-grid');
        const photoGrid   = document.getElementById('modal-photo-grid');
        const backBtn     = document.getElementById('modal-back-btn');

        backBtn.classList.add('hidden');
        galleryGrid.classList.remove('hidden');
        photoGrid.classList.add('hidden');

        const galleries = globalData.galleries.filter(g => g.collectionId === colId);
        if (galleries.length === 0) {
            galleryGrid.innerHTML = `<p class="text-white/30 col-span-full text-center uppercase tracking-[3px]">${t('emptyGallery')}</p>`;
        } else {
            const nsfwBadge = (item) => item.isNsfw
                ? '<div class="absolute top-4 right-4 bg-red-600/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full z-20">18+</div>'
                : '';
            galleryGrid.innerHTML = galleries.map(gal => `
                <div class="album-card group relative" onclick="openGallery('${gal.id}')">
                    ${nsfwBadge(gal)}
                    <div class="album-card-img-wrapper">
                        <img src="${gal.coverUrl}" alt="${getLangTitle(gal)}" loading="lazy">
                    </div>
                    <div class="album-card-footer">
                        <h3 class="album-title">${getLangTitle(gal)}</h3>
                    </div>
                </div>`).join('');
        }

        modalNsfwOverlay.classList.add('hidden');
        galleryGrid.classList.remove('nsfw-blur');
        modal.classList.add('active');
        if (window.lucide) lucide.createIcons();
    };

    window.openGallery = (galleryId) => {
        const gallery = globalData.galleries.find(g => g.id === galleryId);
        if (!gallery) return;

        window.location.hash = 'gallery-' + galleryId;
        modalTitle.textContent = getLangTitle(gallery);
        document.body.style.overflow = 'hidden';

        const galleryGrid = document.getElementById('modal-gallery-grid');
        const photoGrid   = document.getElementById('modal-photo-grid');
        const backBtn     = document.getElementById('modal-back-btn');

        backBtn.classList.remove('hidden');
        backBtn.onclick = () => openCollection(gallery.collectionId);
        galleryGrid.classList.add('hidden');
        photoGrid.classList.remove('hidden');
        photoGrid.innerHTML = '';

        currentGalleryPhotos = globalData.photos.filter(p => p.galleryId === galleryId);

        if (currentGalleryPhotos.length === 0) {
            photoGrid.innerHTML = `<p class="text-white/30 col-span-3 text-center uppercase py-20 tracking-[3px]">${t('emptyPhotos')}</p>`;
        } else {
            photoGrid.innerHTML = currentGalleryPhotos.map((photo, index) => {
                const caption = photo.title
                    ? `<p class="mt-4 text-white font-cinzel text-lg tracking-[3px] opacity-90 drop-shadow-lg">${photo.title}</p>`
                    : '';
                return `
                <div class="masonry-item relative group cursor-pointer" onclick="openLightbox(${index})">
                    <img src="${photo.url}" alt="${photo.title || ''}" loading="lazy" class="w-full h-auto transition-transform duration-700 hover:scale-[1.03]" />
                    <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center pointer-events-none p-4 text-center border border-white/10">
                        <i data-lucide="zoom-in" class="w-10 h-10 opacity-70 text-white"></i>
                        ${caption}
                    </div>
                </div>`;
            }).join('');
        }

        if (gallery.isNsfw && sessionStorage.getItem('nsfw_verified') !== 'true') {
            photoGrid.classList.add('nsfw-blur');
            modalNsfwOverlay.classList.remove('hidden');
            updateStaticTexts();
        } else {
            photoGrid.classList.remove('nsfw-blur');
            modalNsfwOverlay.classList.add('hidden');
        }

        modal.classList.add('active');
        if (window.lucide) lucide.createIcons();
    };

    // ============================================
    // LIGHTBOX
    // ============================================
    function updateLightboxImage() {
        if (!currentGalleryPhotos[currentPhotoIndex]) return;
        const photo = currentGalleryPhotos[currentPhotoIndex];
        lightboxImg.style.opacity = 0;
        setTimeout(() => {
            lightboxImg.src = photo.url;
            lightboxImg.onload = () => { lightboxImg.style.opacity = 1; };
        }, 150);
        lightboxCounter.textContent = `${currentPhotoIndex + 1} / ${currentGalleryPhotos.length}`;
    }

    window.openLightbox = (index) => {
        currentPhotoIndex = index;
        updateLightboxImage();
        isLightboxOpen = true;
        lightbox.classList.remove('pointer-events-none', 'opacity-0');
    };

    window.closeLightbox = () => {
        isLightboxOpen = false;
        lightbox.classList.add('pointer-events-none', 'opacity-0');
        setTimeout(() => { lightboxImg.src = ''; }, 500);
    };

    window.nextPhoto = (e) => {
        if (e) e.stopPropagation();
        currentPhotoIndex = (currentPhotoIndex < currentGalleryPhotos.length - 1) ? currentPhotoIndex + 1 : 0;
        updateLightboxImage();
    };

    window.prevPhoto = (e) => {
        if (e) e.stopPropagation();
        currentPhotoIndex = (currentPhotoIndex > 0) ? currentPhotoIndex - 1 : currentGalleryPhotos.length - 1;
        updateLightboxImage();
    };

    document.addEventListener('keydown', (e) => {
        if (!isLightboxOpen) return;
        if (e.key === 'ArrowRight') window.nextPhoto();
        else if (e.key === 'ArrowLeft') window.prevPhoto();
        else if (e.key === 'Escape') window.closeLightbox();
    });

});
