import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { gsap } from 'gsap';

// Config
const IS_DEMO = new URLSearchParams(window.location.search).has('demo');
const DANMAKU_DURATION_MIN = 35;
const DANMAKU_DURATION_MAX = 45;
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

const DANMAKU_TRACKS = 8;
let danmakuTrackAvailability = new Array(DANMAKU_TRACKS).fill(0);

// Mock Data
const MOCK_MESSAGES = [
    "恭喜你們！百年好合！", "一定要幸福喔！ ❤️", "Happy Wedding! 💍", "今天的婚禮太美了！",
    "早生貴子 👶", "郎才女貌，天生一對！", "Cheers! 🥂", "永遠甜蜜蜜～",
    "最美的新娘 👰‍♀️", "帥氣的新郎！👍", "這首歌好好聽～", "感動哭了 QAQ",
    "新婚快樂！！！", "白頭偕老", "永浴愛河"
];
const MOCK_NAMES = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"];
const MOCK_AVATARS = [
    "https://api.dicebear.com/7.x/notionists/svg?seed=Alice",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Bob",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Charlie",
    "https://api.dicebear.com/7.x/notionists/svg?seed=David",
    "https://api.dicebear.com/7.x/notionists/svg?seed=Eve"
];


async function init() {
    if (IS_DEMO) {
        console.log("✨ Demo Mode: 3 Rows & High Gap ✨");
        await generateMockData();
        startApp();
        startMockDanmakuLoop();
    } else {
        initFirebaseListener();
    }
}

async function generateMockData() {
    for (let i = 1; i <= 26; i++) {
        const num = i < 10 ? `0${i}` : i;
        const imageUrl = `images_webp/gallery-${num}.webp`;
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

function distributeToTracks() {
    tracksEls.forEach(el => el.innerHTML = '');

    // Distribute to 3 tracks
    allWishes.forEach((wish, index) => {
        if (!wish.photoUrls || wish.photoUrls.length === 0) return;
        const trackIndex = index % 3;
        const photoUrl = wish.photoUrls[0];

        const card = createPhotoCard(photoUrl);
        tracksEls[trackIndex].appendChild(card);
    });

    tracksEls.forEach(track => {
        const content = track.innerHTML;
        track.innerHTML = content + content + content + content;
    });
}

function createPhotoCard(url) {
    const div = document.createElement('div');
    div.className = 'photo-card';

    // Variable Height
    const heights = ['h-100', 'h-100', 'h-90', 'h-80', 'h-70', 'h-60'];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];
    div.classList.add(randomHeight);

    // Vertical Alignment
    const aligns = ['align-center', 'align-center', 'align-start', 'align-end'];
    const randomAlign = aligns[Math.floor(Math.random() * aligns.length)];
    div.classList.add(randomAlign);

    const img = document.createElement('img');
    img.src = url;
    div.appendChild(img);
    return div;
}

function initFirebaseListener() {
    const q = query(collection(db, 'wishes'), orderBy('timestamp', 'desc'), limit(100));
    onSnapshot(q, (snapshot) => {
        let hasNew = false;
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                const wish = { id: change.doc.id, ...data };

                if (!allWishes.find(w => w.id === wish.id)) {
                    allWishes.push(wish);
                    if (wish.message) fireDanmaku(wish, true);

                    if (wish.photoUrls && wish.photoUrls.length > 0) {
                        const trackIndex = Math.floor(Math.random() * 3);
                        const card = createPhotoCard(wish.photoUrls[0]);
                        tracksEls[trackIndex].appendChild(card);
                    }
                }
                hasNew = true;
            }
        });

        if (hasNew && emptyState.style.display !== 'none') {
            startApp();
        }
    });
}

function startApp() {
    emptyState.style.display = 'none';
    marqueeContainer.style.opacity = 1;

    if (tracksEls[0].children.length === 0) {
        distributeToTracks();
    }

    tracksEls.forEach((track, i) => {
        const speed = MARQUEE_SPEED_BASE + (i * 15);
        animateTrackLeftToRight(track, speed);
    });
}

function animateTrackLeftToRight(element, speed) {
    const totalWidth = element.scrollWidth;
    const singleSetWidth = totalWidth / 4;

    gsap.fromTo(element,
        { x: -singleSetWidth },
        {
            x: 0,
            duration: speed,
            ease: "none",
            repeat: -1
        }
    );
}

// --- Danmaku System ---
function getAvailableTrack() {
    const now = Date.now();
    const availableIndices = [];
    danmakuTrackAvailability.forEach((time, index) => {
        if (time <= now) availableIndices.push(index);
    });

    if (availableIndices.length === 0) return -1;
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
}

function fireDanmaku(wishData, isImportant = false) {
    const text = typeof wishData === 'string' ? wishData : wishData.message;
    const name = typeof wishData === 'string' ? "Guest" : wishData.guestName;
    const avatar = MOCK_AVATARS[Math.floor(Math.random() * MOCK_AVATARS.length)];

    const trackIndex = getAvailableTrack();
    if (trackIndex === -1) return;

    const el = document.createElement('div');
    el.className = `danmaku-item ${isImportant ? 'h1' : ''}`;

    el.innerHTML = `
        <img class="avatar" src="${avatar}" />
        <span>${name}: ${text}</span>
    `;

    danmakuLayer.appendChild(el);

    const trackHeight = 100 / DANMAKU_TRACKS;
    const top = (trackIndex * trackHeight) + (Math.random() * (trackHeight / 4));
    el.style.top = `${top}%`;

    danmakuTrackAvailability[trackIndex] = Date.now() + 6000;

    const duration = DANMAKU_DURATION_MIN + Math.random() * (DANMAKU_DURATION_MAX - DANMAKU_DURATION_MIN);

    gsap.fromTo(el,
        { x: window.innerWidth + 50 },
        {
            x: -500,
            duration: duration,
            ease: "none",
            onComplete: () => {
                el.remove();
            }
        }
    );
}

function startMockDanmakuLoop() {
    setInterval(() => {
        const text = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
        const name = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
        fireDanmaku({ message: text, guestName: name }, false);
    }, 2500);
}

init();
