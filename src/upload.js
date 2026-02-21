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
const displayName = document.getElementById('display-name');
const liffBadge = document.getElementById('liff-badge');

let selectedFiles = [];
let lineAvatarUrl = ''; // 儲存 LINE 頭像URL（Firestore 用）

// ── 頭像工具：依名字生成 DiceBear 幾何圖案（與 live.js 一致）────────────
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

// 名字欄位變動時，即時更新預設頭像（只在非LINE模式下）
nameInput.addEventListener('input', () => {
    if (!lineAvatarUrl) {
        setAvatar(defaultAvatarUrl(nameInput.value || 'guest'));
    }
    displayName.textContent = nameInput.value || '訪客';
});

// ── LIFF 初始化 ──────────────────────────────────────────────────────────
const initLIFF = async () => {
    const liffId = import.meta.env.VITE_LIFF_ID;

    // 先設好預設頭像（LIFF 成功後會覆蓋）
    setAvatar(defaultAvatarUrl('guest'));

    // 如果沒設定 LIFF ID，直接用預設模式
    if (!liffId || liffId === 'your_liff_id') {
        console.log('未設定 LIFF ID，使用一般模式');
        return;
    }

    try {
        // liff 由 CDN 掛在 window 上
        const liffSDK = window.liff;
        if (!liffSDK) throw new Error('LIFF SDK 未載入');

        await liffSDK.init({ liffId });

        if (liffSDK.isLoggedIn()) {
            // ✅ LINE 模式：取得 LINE 個人資料
            const profile = await liffSDK.getProfile();

            nameInput.value = profile.displayName;
            displayName.textContent = profile.displayName;
            lineAvatarUrl = profile.pictureUrl || '';

            if (lineAvatarUrl) {
                setAvatar(lineAvatarUrl);
            } else {
                setAvatar(defaultAvatarUrl(profile.displayName));
            }

            // 顯示 LINE 徽章
            liffBadge.style.display = 'inline-block';
            console.log('✅ LIFF 登入成功：', profile.displayName);
        } else {
            // 在 LINE APP 內但未登入（理論上圖文選單不會發生，但保險起見）
            if (liffSDK.isInClient()) {
                liffSDK.login();
            }
        }
    } catch (error) {
        // LIFF 初始化失敗 → 靜默降級到預設頭像模式
        console.error('LIFF init failed, fallback to default mode.', error);
    }
};

// ── 照片選擇 ──────────────────────────────────────────────────────────────
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);

    if (files.length > 1) {
        alert('一次只能上傳 1 張照片');
        fileInput.value = '';
        return;
    }
    if (files.length === 0) return;

    selectedFiles = [];
    previewArea.innerHTML = '';
    loadingOverlay.style.display = 'flex';

    const file = files[0];
    try {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1080, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        selectedFiles.push(compressedFile);

        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `<img src="${e.target.result}">`;
            previewArea.appendChild(div);
        };
        reader.readAsDataURL(compressedFile);
    } catch (error) {
        console.error('Compression failed', error);
        alert('照片處理失敗，請重試');
    }

    loadingOverlay.style.display = 'none';
    fileInput.value = '';
});

// ── 送出表單 ──────────────────────────────────────────────────────────────
window.submitForm = async () => {
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!name) {
        alert('請輸入您的名字');
        return;
    }
    if (selectedFiles.length === 0 && !message) {
        alert('請至少上傳照片或寫下祝福');
        return;
    }

    loadingOverlay.style.display = 'flex';
    submitBtn.disabled = true;

    try {
        const photoUrls = [];

        const uploadPromises = selectedFiles.map(async (file) => {
            const fileName = `wishes/${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
            const storageRef = ref(storage, fileName);
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        });

        const uploadedUrls = await Promise.all(uploadPromises);
        photoUrls.push(...uploadedUrls);

        // 計算最終頭像 URL（LINE 頭像 > 依名字生成的 DiceBear）
        const finalAvatarUrl = lineAvatarUrl || defaultAvatarUrl(name);

        await addDoc(collection(db, 'wishes'), {
            guestName: name,
            message: message,
            photoUrls: photoUrls,
            lineAvatarUrl: finalAvatarUrl,  // 供 danmaku 使用
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
