import { db, storage } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import liff from '@line/liff';
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

let selectedFiles = [];

// Initialize LIFF
const initLIFF = async () => {
    try {
        const liffId = import.meta.env.VITE_LIFF_ID;
        if (liffId) {
            await liff.init({ liffId });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                nameInput.value = profile.displayName;
            } else {
                // Should we force login? Requirement says "若 false：欄位留空"
                // liff.login(); 
            }
        }
    } catch (error) {
        console.error('LIFF init failed', error);
    }
};

// Handle File Selection
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);

    // Enforce strictly 1 photo
    if (files.length > 1) {
        alert('一次只能上傳 1 張照片');
        fileInput.value = '';
        return;
    }

    if (files.length === 0) return;

    // Reset previous selection (User wants only 1 photo total)
    selectedFiles = [];
    previewArea.innerHTML = '';

    loadingOverlay.style.display = 'flex';

    // Process the single file
    const file = files[0];

    try {
        const options = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1920,
            useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);
        selectedFiles.push(compressedFile);

        // Render Preview
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

// Submit Form
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

        // Upload images to Storage in Parallel
        const uploadPromises = selectedFiles.map(async (file) => {
            const fileName = `wishes/${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
            const storageRef = ref(storage, fileName);
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        });

        const uploadedUrls = await Promise.all(uploadPromises);
        photoUrls.push(...uploadedUrls);

        // Save metadata to Firestore
        await addDoc(collection(db, 'wishes'), {
            guestName: name,
            message: message,
            photoUrls: photoUrls,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
        });

        // Show success
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
