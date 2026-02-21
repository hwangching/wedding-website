import { db, storage } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

// DOM Elements
const nameInput = document.getElementById('name');
const messageInput = document.getElementById('message');
const fileInput = document.getElementById('file-input');
const previewArea = document.getElementById('preview-area');
const submitBtn = document.getElementById('submit-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const uploadForm = document.getElementById('upload-form');
const successView = document.getElementById('success-view');
const avatarImg = document.getElementById('avatar-img');
const avatarWrapper = document.getElementById('avatar-wrapper');
const avatarUploadInput = document.getElementById('avatar-upload');
const avatarHint = document.getElementById('avatar-hint');
const displayName = document.getElementById('display-name');
const liffBadge = document.getElementById('liff-badge');

let selectedFiles = [];
let lineAvatarUrl = '';    // LINE 頭像 URL（LIFF 模式）
let customAvatarBlob = null; // 使用者自訂頭像（Blob，送出時上傳）
let isLiffMode = false;

// ── 頭像工具：DiceBear 幾何圖案（與 live.js 一致）─────────────────────
const AVATAR_STYLES = ['shapes', 'identicon', 'rings', 'pixel-art-neutral'];
function defaultAvatarUrl(name) {
    let hash = 0;
    const str = name || 'guest';
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    const style = AVATAR_STYLES[hash % AVATAR_STYLES.length];
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(str)}`;
}

function setAvatar(url) {
    avatarImg.src = url;
}

// ── 頭像上傳（非 LIFF 模式）───────────────────────────────────────────────
function enableAvatarUpload() {
    avatarWrapper.classList.add('clickable');

    avatarWrapper.addEventListener('click', () => {
        avatarUploadInput.click();
    });

    avatarUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        loadingOverlay.style.display = 'flex';
        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: 0.3,
                maxWidthOrHeight: 400,
                useWebWorker: true
            });
            customAvatarBlob = compressed;

            // 預覽
            const reader = new FileReader();
            reader.onload = (ev) => setAvatar(ev.target.result);
            reader.readAsDataURL(compressed);

            // 隱藏提示（已選好圖了）
            if (avatarHint) avatarHint.style.display = 'none';
        } catch (err) {
            console.error('Avatar compression failed', err);
            alert('頭像處理失敗，請重試');
        }
        loadingOverlay.style.display = 'none';
        avatarUploadInput.value = '';
    });
}

// ── 名字欄位：即時更新顯示名稱 & 預設頭像（非 LIFF 且無自訂頭像時）────────
nameInput.addEventListener('input', () => {
    displayName.textContent = nameInput.value || '訪客';
    if (!isLiffMode && !customAvatarBlob) {
        setAvatar(defaultAvatarUrl(nameInput.value || 'guest'));
    }
});

// ── LIFF 初始化 ──────────────────────────────────────────────────────────
const initLIFF = async () => {
    const liffId = import.meta.env.VITE_LIFF_ID;

    // 預設頭像
    setAvatar(defaultAvatarUrl('guest'));

    if (!liffId || liffId === 'your_liff_id') {
        // 一般模式：啟用頭像上傳
        enableAvatarUpload();
        return;
    }

    try {
        const liffSDK = window.liff;
        if (!liffSDK) throw new Error('LIFF SDK 未載入');

        await liffSDK.init({ liffId });

        if (liffSDK.isLoggedIn()) {
            // ✅ LINE 模式
            isLiffMode = true;
            const profile = await liffSDK.getProfile();

            nameInput.value = profile.displayName;
            displayName.textContent = profile.displayName;
            lineAvatarUrl = profile.pictureUrl || '';

            setAvatar(lineAvatarUrl || defaultAvatarUrl(profile.displayName));
            liffBadge.style.display = 'inline-block';

            // LINE 模式：不開放點擊換頭像，隱藏提示文字
            if (avatarHint) avatarHint.style.display = 'none';

            console.log('✅ LIFF 登入成功：', profile.displayName);
        } else {
            if (liffSDK.isInClient()) liffSDK.login();
            else enableAvatarUpload();
        }
    } catch (error) {
        console.error('LIFF init failed, fallback to default mode.', error);
        enableAvatarUpload();
    }
};

// ── 祝福照片選擇 ──────────────────────────────────────────────────────────
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 1) { alert('一次只能上傳 1 張照片'); fileInput.value = ''; return; }
    if (files.length === 0) return;

    selectedFiles = [];
    previewArea.innerHTML = '';
    loadingOverlay.style.display = 'flex';

    try {
        const compressed = await imageCompression(files[0], {
            maxSizeMB: 0.5, maxWidthOrHeight: 1080, useWebWorker: true
        });
        selectedFiles.push(compressed);

        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `<img src="${e.target.result}">`;
            previewArea.appendChild(div);
        };
        reader.readAsDataURL(compressed);
    } catch (err) {
        console.error('Compression failed', err);
        alert('照片處理失敗，請重試');
    }

    loadingOverlay.style.display = 'none';
    fileInput.value = '';
});

// ── 送出表單 ──────────────────────────────────────────────────────────────
window.submitForm = async () => {
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!name) { alert('請輸入您的名字'); return; }
    if (selectedFiles.length === 0 && !message) { alert('請至少上傳照片或寫下祝福'); return; }

    loadingOverlay.style.display = 'flex';
    submitBtn.disabled = true;

    try {
        // 1. 上傳祝福照片
        const photoUrls = await Promise.all(
            selectedFiles.map(async (file) => {
                const fileName = `wishes/${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
                const snap = await uploadBytes(ref(storage, fileName), file);
                return getDownloadURL(snap.ref);
            })
        );

        // 2. 上傳自訂頭像（非 LIFF 模式且使用者有選圖）
        let finalAvatarUrl = lineAvatarUrl || defaultAvatarUrl(name);
        if (!isLiffMode && customAvatarBlob) {
            const avatarFileName = `avatars/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const snap = await uploadBytes(ref(storage, avatarFileName), customAvatarBlob);
            finalAvatarUrl = await getDownloadURL(snap.ref);
        }

        // 3. 寫入 Firestore
        await addDoc(collection(db, 'wishes'), {
            guestName: name,
            message,
            photoUrls,
            lineAvatarUrl: finalAvatarUrl,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
        });

        uploadForm.style.display = 'none';
        successView.style.display = 'block';

    } catch (error) {
        console.error('Upload failed', error);
        alert('上傳失敗，請檢查網路後重試');
        submitBtn.disabled = false;
    } finally {
        loadingOverlay.style.display = 'none';
    }
};

// Start
initLIFF();
