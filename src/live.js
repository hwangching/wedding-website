import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { gsap } from 'gsap';
import QRCode from 'qrcode';
// Config
const IS_DEMO = new URLSearchParams(window.location.search).has('demo');
const DANMAKU_DURATION_MIN = 38;
const DANMAKU_DURATION_MAX = 42;
const MARQUEE_SPEED_BASE = 80;

// State
let allWishes = [];
let tracksEls = [
    document.getElementById('track-1'),
    document.getElementById('track-2'),
    document.getElementById('track-3')
];
const danmakuLayer = document.getElementById('danmaku-layer');
const marqueeContainer = document.getElementById('marquee-container');
const emptyState = document.getElementById('empty-state');

let reloadTimer = null; // Timer for auto-refresh on new content

const DANMAKU_TRACKS = 7;
let danmakuTrackAvailability = new Array(DANMAKU_TRACKS).fill(0);
let danmakuTrackOccupied = new Array(DANMAKU_TRACKS).fill(false); // true = a bubble is currently on this track
let danmakuSequentialIndex = 0;

// Mock Data
// Mock Data
let MOCK_KV_DATA = []; // Stores { name: "...", message: "..." } from JSON

let MOCK_MESSAGES = [
    "恭喜你們！百年好合！", "一定要幸福喔！ ❤️", "Happy Wedding! 💍", "今天的婚禮太美了！",
    "早生貴子 👶", "郎才女貌，天生一對！", "Cheers! 🥂", "永遠甜蜜蜜～",
    "最美的新娘 👰‍♀️", "帥氣的新郎！👍", "這首歌好好聽～", "感動哭了 QAQ",
    "新婚快樂！！！", "白頭偕老", "永浴愛河"
];
let MOCK_NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"];
// avatarForName: derive a unique, deterministic avatar URL from the guest's name.
// Alternates between DiceBear styles so different people also get different shapes.
const AVATAR_STYLES = ['shapes', 'identicon', 'bottts-neutral', 'rings', 'pixel-art-neutral'];
function avatarForName(name) {
    // Simple hash to pick a stable style index for this name
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const style = AVATAR_STYLES[hash % AVATAR_STYLES.length];
    const seed = encodeURIComponent(name);
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}


async function loadGoogleSheetMessages() {
    const SHEET_ID = '1PXMpKRGtniLKp8jbFQdYAsfRfg91ZKXfERiUgQ7qpBM';
    const GID = '0'; // usually the first tab "表單回應 1"
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&tq&gid=${GID}`;
        const response = await fetch(url);
        if (!response.ok) return false;

        let text = await response.text();

        // Strip out the wrapping callback from visualizer API
        const prefix = "/*O_o*/\n";
        if (text.startsWith(prefix)) {
            text = text.substring(prefix.length);
        }
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);

        if (jsonMatch && jsonMatch[1]) {
            const data = JSON.parse(jsonMatch[1]);
            if (data.status === 'ok' && data.table && data.table.rows) {
                const rows = data.table.rows;
                const cols = data.table.cols;

                let nameIdx = -1;
                let msgIdx = -1;
                cols.forEach((c, idx) => {
                    if (!c.label) return;
                    const l = c.label.toLowerCase();
                    if (l.includes('name') || l.includes('名字') || l.includes('姓名')) nameIdx = idx;
                    if (l.includes('message') || l.includes('祝福') || l.includes('留言')) msgIdx = idx;
                });

                // Fallback to col 1 (Name) and 2 (Message) if no labels
                if (nameIdx === -1) nameIdx = 1;
                if (msgIdx === -1) msgIdx = 2;

                const sheetsData = [];
                rows.forEach(r => {
                    const name = r.c[nameIdx] ? r.c[nameIdx].v : '';
                    const message = r.c[msgIdx] ? r.c[msgIdx].v : '';
                    if (name && message) {
                        sheetsData.push({ name: String(name).trim(), message: String(message).trim() });
                    }
                });

                if (sheetsData.length > 0) {
                    MOCK_KV_DATA = sheetsData;
                    console.log("Loaded Google Sheet messages:", MOCK_KV_DATA.length);
                    return true;
                }
            }
        }
    } catch (error) {
        console.warn("Could not load Google Sheet data.", error);
    }
    return false;
}

async function init() {
    generateQRCode(); // Generate QR Code first

    // Try Google Sheet first
    const sheetLoaded = await loadGoogleSheetMessages();

    // Fallback to custom messages from JSON file if available and sheet failed
    if (!sheetLoaded) {
        try {
            const response = await fetch('/images_webp/live_init/messages.json');
            if (response.ok) {
                const data = await response.json();

                // Check for Key-Value pair array: [{name, message}, ...]
                if (Array.isArray(data) && data.length > 0 && data[0].name && data[0].message) {
                    MOCK_KV_DATA = data;
                    console.log("Loaded Key-Value messages:", MOCK_KV_DATA.length);
                }
                // Handle Legacy formats (just in case)
                else if (Array.isArray(data)) {
                    MOCK_MESSAGES = data;
                } else if (data.messages) {
                    MOCK_MESSAGES = data.messages;
                    if (data.names) MOCK_NAMES = data.names;
                }
            }
        } catch (error) {
            console.warn("Could not load messages.json, using defaults.", error);
        }
    }

    if (IS_DEMO) {
        console.log("✨ Demo Mode: 3 Rows & High Gap ✨");
        await generateMockData();
        startApp();
        startMockDanmakuLoop();
    } else {
        initFirebaseListener();
    }

    initResizeObserver();
}

function initResizeObserver() {
    const ro = new ResizeObserver(entries => {
        entries.forEach(entry => {
            const track = entry.target;
            // Debounce restart
            if (track.resizeTimer) clearTimeout(track.resizeTimer);

            // Only restart if significant change to avoid jitter
            // Or just debounce.

            // Get index from ID track-1, track-2, track-3
            const id = track.id;
            const index = parseInt(id.split('-')[1]) - 1;
            const speed = MARQUEE_SPEED_BASE + (index * 15);

            track.resizeTimer = setTimeout(() => {
                // Determine if we need to restart animation
                // Check if current animation is "stuck" or width changed
                // Simply restarting is safe if debounced
                if (track.scrollWidth > 100) {
                    animateTrackLeftToRight(track, speed);
                }
            }, 500);
        });
    });

    tracksEls.forEach(track => {
        if (track) ro.observe(track);
    });
}


function generateQRCode() {
    const qrContainer = document.querySelector('.qr-code');
    if (!qrContainer) return;

    const currentUrl = new URL(window.location.href);
    let uploadUrl = currentUrl.origin + '/upload.html';

    if (currentUrl.pathname.includes('live.html')) {
        uploadUrl = currentUrl.href.replace('live.html', 'upload.html');
    }

    uploadUrl = uploadUrl.split('?')[0];

    const imgPlaceholder = qrContainer.querySelector('img');
    if (imgPlaceholder) imgPlaceholder.remove();

    const canvas = document.createElement('canvas');
    qrContainer.insertBefore(canvas, qrContainer.firstChild);

    QRCode.toCanvas(canvas, uploadUrl, {
        width: 100,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    }, function (error) {
        if (error) console.error(error);
        console.log('QRCode generated for:', uploadUrl);
    });
}


async function generateMockData() {
    // ... (keep same)
    for (let i = 1; i <= 26; i++) {
        const num = i < 10 ? `0${i}` : i;
        const imageUrl = `/images_webp/gallery-${num}.webp`;
        pushWishToMemory({
            id: `mock_${i}`,
            guestName: MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)],
            message: MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)],
            photoUrls: [imageUrl],
            timestamp: Date.now()
        });
    }
    allWishes = [...allWishes, ...allWishes];
    distributeToTracks();
}

function pushWishToMemory(wish) {
    allWishes.push(wish);
}

async function distributeToTracks() {
    // Distribute to tracks logic
    // Dedup photos first
    const uniquePhotosSet = new Set();
    allWishes.forEach(wish => {
        if (wish.photoUrls && wish.photoUrls.length > 0) {
            wish.photoUrls.forEach(url => uniquePhotosSet.add(url));
        }
    });

    const uniquePhotos = Array.from(uniquePhotosSet);

    // User wants "latest 20~30 photos"
    // We strictly limit to 30 photos for the wall
    const latestPhotos = uniquePhotos.slice(0, 30);

    // User wants "Each photo appears only once" (ideally).
    // But we have 3 tracks.
    // If we have very few photos (e.g. 1), we can't fill 3 tracks uniquely.
    // We will distribute round-robin. Track 1 gets 0, 3, 6... Track 2 gets 1, 4, 7...

    tracksEls.forEach((track, i) => {
        track.innerHTML = '';
        let photosForTrack = [];

        // Strict Round-Robin Distribution
        photosForTrack = latestPhotos.filter((_, index) => index % 3 === i);

        // If a track ends up empty (e.g. only 1 photo total, so Track 2 & 3 empty),
        // we might want to leave it empty to respect "appear once"?
        // Or if the user prefers fullness, we'd reuse.
        // User said: "每張上傳的照片我只想在畫面出現一張" (I only want one copy of each photo to appear).
        // This strongly suggests NO duplication across tracks.
        // So if Track 2 is empty, let it be empty?
        // But marquee will look broken.
        // Let's assume if total photos < 3, we MUST duplicate to fill at least one screen width of *something*?
        // But let's try strict unique first as requested. Only if count is 0 do we return.

        if (photosForTrack.length === 0) {
            // If total unique photos > 0 but this track is empty (e.g. 2 photos total),
            // maybe we can steal from others? But that violates uniqueness.
            // Let's just leave it empty for now or put a placeholder?
            // "Empty track" might be better than "Duplicate photo".
            return;
        }

        // Create cards
        photosForTrack.forEach(url => {
            const card = createPhotoCard(url);
            track.appendChild(card);
        });

        // Duplicate content WITHIN the track for seamless marquee loop
        // Ensure at least enough content to fill screen width + buffer
        // We clone the track content multiple times.
        // This duplication is TECHNICAL for marquee, not logical duplication of content.
        const content = track.innerHTML;
        // Repeat enough times. If we have 1 photo in track, we need many repeats.
        // If we have 10, fewer.
        // Let's always repeat 6 times to be safe and consistent with animation math.
        track.innerHTML = content.repeat(6);
    });

    // Wait for images to load then animate
    // Add a timeout race to prevent hanging forever
    await Promise.race([
        waitForImagesLoaded(tracksEls),
        new Promise(resolve => setTimeout(resolve, 3000))
    ]);

    tracksEls.forEach((track, i) => {
        const speed = MARQUEE_SPEED_BASE + (i * 15);
        animateTrackLeftToRight(track, speed);
    });
}

function createPhotoCard(url) {
    const div = document.createElement('div');
    div.className = 'photo-card';

    // Reset specific heights if we want uniform look or keep random
    // Keep random for now
    const heights = ['h-100', 'h-100', 'h-90', 'h-80', 'h-70', 'h-60'];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];
    div.classList.add(randomHeight);

    const aligns = ['align-center', 'align-center', 'align-start', 'align-end'];
    const randomAlign = aligns[Math.floor(Math.random() * aligns.length)];
    div.classList.add(randomAlign);

    const img = document.createElement('img');
    img.src = url;
    div.appendChild(img);
    return div;
}

async function generateInitData() {
    // Determine the number of init items to generate without duplications if there are enough KV configs
    const count = MOCK_KV_DATA.length > 0 ? MOCK_KV_DATA.length : 20;
    const initWishes = [];

    for (let i = 0; i < count; i++) {
        let msg = "";
        let name = "Wedding Team";

        // Use KV Data if available
        if (MOCK_KV_DATA.length > 0) {
            const kv = MOCK_KV_DATA[i];
            msg = kv.message;
            name = kv.name;
        } else {
            // Fallback
            msg = MOCK_MESSAGES[i % MOCK_MESSAGES.length];
            name = "Wedding Team";
        }

        initWishes.push({
            id: `init_${i}`,
            guestName: name,
            message: msg,
            photoUrls: [`/images_webp/live_init/init_${(i % 20) + 1}.jpg`],
            timestamp: 1000 + i
        });
    }
    return initWishes;
}

function initFirebaseListener() {
    const q = query(collection(db, 'wishes'), orderBy('timestamp', 'desc'), limit(30));

    // Safety belt REMOVED - User wants continuous smooth play
    // setInterval(() => window.location.reload(), 10 * 60 * 1000);

    let isFirstLoad = true;
    let initWishes = [];

    // 1. Load Init Data immediately
    console.log("Loading init data...");
    generateInitData().then(data => {
        console.log("Init data generated:", data.length);
        initWishes = data;
        // Initial render with ONLY Init Data (while waiting for Firebase)
        allWishes = [...initWishes];
        console.log("Distributing tracks...");
        distributeToTracks();
        console.log("Starting App...");
        startApp();
    }).catch(e => {
        console.error("Init failed:", e);
        alert("Init Error: " + e.message);
        startApp(); // Force start even if init fails
    });

    onSnapshot(q, (snapshot) => {
        let hasNew = false;
        const currentRealWishes = [];

        // We process the snapshot to get the latest REAL wishes
        snapshot.docs.forEach(doc => {
            currentRealWishes.push({ id: doc.id, ...doc.data() });
        });

        // 2. Merge Real + Init filters
        // Priority: Real Wishes > Init Wishes. Total 30.
        const combinedWishes = [...currentRealWishes];
        if (combinedWishes.length < 30) {
            const needed = 30 - combinedWishes.length;
            if (initWishes.length > 0) {
                combinedWishes.push(...initWishes.slice(0, needed));
            }
        }
        allWishes = combinedWishes;

        if (isFirstLoad) {
            console.log("Firebase loaded. Merging with Init data.");
            distributeToTracks();
            isFirstLoad = false;
        } else {
            // Live updates
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    hasNew = true;
                    const data = change.doc.data();

                    if (marqueeContainer.style.opacity === '1') {
                        if (data.message) {
                            fireDanmakuBox(data, 3);
                        }
                        if (data.photoUrls && data.photoUrls.length > 0) {
                            // LIVE SWAP: Replace a random existing photo with the new one
                            console.log("New photo received. Swapping dynamically.");
                            data.photoUrls.forEach(url => injectNewPhoto(url));
                        }
                    }
                }
            });
        }

        // Start Background Danmaku Loop
        if (!window.danmakuInterval) {
            window.danmakuInterval = setInterval(() => {
                if (allWishes.length > 0) {
                    const messageWishes = allWishes.filter(w => w.message);

                    if (messageWishes.length > 0) {
                        // Sequential Selection
                        const wish = messageWishes[danmakuSequentialIndex % messageWishes.length];
                        fireDanmaku(wish, false);
                        danmakuSequentialIndex++;
                    }
                }
            }, 6000);
        }
    });
}

function injectNewPhoto(url) {
    // 1. Preload image to avoid white flash
    const tempImg = new Image();
    tempImg.src = url;
    tempImg.onload = () => {
        performSafeSwap(url);
    };
}

function performSafeSwap(url) {
    // Try to find a "Safe Slot" where all clones are off-screen
    // Tracks are duplicated 6 times.
    const tracks = [...tracksEls].sort(() => Math.random() - 0.5); // Random order

    for (const track of tracks) {
        const cards = Array.from(track.children);
        if (cards.length === 0) continue;

        const setSize = Math.floor(cards.length / 6);
        if (setSize === 0) continue;

        // Try random slots
        const slots = Array.from({ length: setSize }, (_, i) => i).sort(() => Math.random() - 0.5);

        for (const slotIndex of slots) {
            // Check visibility of this slot and all its clones
            // Clones are at slotIndex, slotIndex + setSize, ...
            const clones = [];
            let isSafe = true;

            for (let i = 0; i < 6; i++) {
                const cardIndex = slotIndex + (i * setSize);
                if (cardIndex < cards.length) {
                    const card = cards[cardIndex];
                    clones.push(card);

                    const rect = card.getBoundingClientRect();
                    // Check if *strictly* visible
                    const isVisible = (
                        rect.right > 0 &&
                        rect.left < window.innerWidth
                    );

                    if (isVisible) {
                        isSafe = false;
                        // Don't break immediately, we might want to prioritize "partially safe"? 
                        // But for "Natural" look, we want strict safety.
                        break;
                    }
                }
            }

            if (isSafe) {
                // Found a hidden slot! Update all clones
                console.log(`Swapping photo in safe slot ${slotIndex} of track ${track.id}`);
                clones.forEach(card => {
                    const img = card.querySelector('img');
                    if (img) img.src = url;
                });
                return; // Done
            }
        }
    }

    // If strict safety failed (extremely rare if 6 sets), try looser strategy:
    // Change any slot where the *primary* instance (Set 1) is off-screen?
    // Or just ignore. With 30 photos, 3 tracks, fast movement... usually strict safety works.
    console.log("Could not find strictly safe slot for new photo. Queuing update?");
}

// Wrapper to fire danmaku N times sequentially
function fireDanmakuBox(wish, times) {
    if (times <= 0) return;

    // We pass a callback to fire the next one when this one finishes?
    // GSAP onComplete in fireDanmaku is ideal.
    // Let's modify fireDanmaku to accept a callback.
    fireDanmaku(wish, true, () => {
        // Wait a small delay before next loop?
        // Or immediate.
        // Let's wait 1s.
        setTimeout(() => {
            fireDanmakuBox(wish, times - 1);
        }, 1000);
    });
}

function startApp() {
    emptyState.style.display = 'none';
    marqueeContainer.style.opacity = 1;

    if (tracksEls[0].children.length === 0) {
        distributeToTracks();
    }
}

function waitForImagesLoaded(tracks) {
    const promises = [];
    tracks.forEach(track => {
        const imgs = track.querySelectorAll('img');
        imgs.forEach(img => {
            if (img.complete) return;
            promises.push(new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            }));
        });
    });
    return Promise.all(promises);
}

function animateTrackLeftToRight(track, speed) {
    gsap.killTweensOf(track);
    const totalWidth = track.scrollWidth;
    const singleSetWidth = totalWidth / 6;
    if (singleSetWidth < 10) return;

    gsap.fromTo(track,
        { x: 0 }, // Start from 0
        {
            x: -singleSetWidth, // Move left by one set width
            duration: speed,
            ease: "none",
            repeat: -1
        }
    );
}

// Returns a starting track index where `tracksNeeded` consecutive tracks are ALL unoccupied.
function getAvailableTrack(tracksNeeded = 1) {
    const startIndices = Array.from({ length: DANMAKU_TRACKS - tracksNeeded + 1 }, (_, i) => i)
        .sort(() => Math.random() - 0.5); // Randomize vertical position
    for (const start of startIndices) {
        let allFree = true;
        for (let j = 0; j < tracksNeeded; j++) {
            if (danmakuTrackOccupied[start + j]) {
                allFree = false;
                break;
            }
        }
        if (allFree) return start;
    }
    return -1; // Every track is busy
}

function occupyTracks(startTrack, count) {
    for (let j = 0; j < count; j++) {
        if (startTrack + j < DANMAKU_TRACKS) danmakuTrackOccupied[startTrack + j] = true;
    }
}

function freeTracks(startTrack, count) {
    for (let j = 0; j < count; j++) {
        if (startTrack + j < DANMAKU_TRACKS) danmakuTrackOccupied[startTrack + j] = false;
    }
}

function fireDanmaku(wishData, isImportant = false, onCompleteCallback = null) {
    const text = typeof wishData === 'string' ? wishData : wishData.message;
    const name = typeof wishData === 'string' ? "Guest" : wishData.guestName;
    const avatar = avatarForName(name); // Unique per name, consistent on repeats

    // Measure bubble height with an off-screen ghost element
    const ghost = document.createElement('div');
    ghost.className = `danmaku-item ${isImportant ? 'h1' : ''}`;
    ghost.style.cssText = 'position:fixed;visibility:hidden;top:-9999px;left:0;pointer-events:none;';
    ghost.innerHTML = `
        <img class="avatar" src="${avatar}" />
        <div class="content">
            <div class="name">${name}</div>
            <div class="message">${text}</div>
        </div>
    `;
    document.body.appendChild(ghost);
    const bubbleH = ghost.offsetHeight;
    document.body.removeChild(ghost);

    // How many tracks does this bubble physically span?
    const trackHeightPx = window.innerHeight * 0.85 / DANMAKU_TRACKS;
    const tracksNeeded = Math.max(1, Math.ceil(bubbleH / trackHeightPx));

    const trackIndex = getAvailableTrack(tracksNeeded);
    if (trackIndex === -1) {
        // All tracks full — skip and let loop try again next cycle
        if (onCompleteCallback) onCompleteCallback();
        return;
    }

    // Immediately mark tracks as occupied
    occupyTracks(trackIndex, tracksNeeded);

    const el = document.createElement('div');
    el.className = `danmaku-item ${isImportant ? 'h1' : ''}`;
    el.innerHTML = `
        <img class="avatar" src="${avatar}" />
        <div class="content">
            <div class="name">${name}</div>
            <div class="message">${text}</div>
        </div>
    `;

    danmakuLayer.appendChild(el);

    const trackHeightPct = 85 / DANMAKU_TRACKS;
    el.style.top = `${5 + trackIndex * trackHeightPct}%`;

    const duration = DANMAKU_DURATION_MIN + Math.random() * (DANMAKU_DURATION_MAX - DANMAKU_DURATION_MIN);
    const totalTravel = window.innerWidth + el.offsetWidth + 100;

    gsap.fromTo(el,
        { x: window.innerWidth + 50 },
        {
            x: -(el.offsetWidth + 50),
            duration: duration,
            ease: "none",
            onComplete: () => {
                el.remove();
                // FREE the tracks only when the bubble has fully exited
                freeTracks(trackIndex, tracksNeeded);
                if (onCompleteCallback) onCompleteCallback();
            }
        }
    );
}

function startMockDanmakuLoop() {
    setInterval(() => {
        let text, name;

        if (MOCK_KV_DATA.length > 0) {
            const kv = MOCK_KV_DATA[Math.floor(Math.random() * MOCK_KV_DATA.length)];
            text = kv.message;
            name = kv.name;
        } else {
            text = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
            name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
        }

        fireDanmaku({ message: text, guestName: name }, false);
    }, 2500);
}

init();
