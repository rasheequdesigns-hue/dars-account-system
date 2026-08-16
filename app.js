/**
 * EduCast - Classroom Remote Video Presenter Logic
 */

// Application State Variables
let currentRole = null; // 'laptop' or 'phone'
let roomId = null;
let peer = null;
let peerConnection = null;
let ytPlayer = null;
let isYtReady = false;
let currentVideoType = 'direct'; // 'direct', 'youtube', 'instagram', 'facebook'
let bookmarks = [];

// A-B Loop State
let abLoop = { active: false, start: 0, end: 0 };

// File Upload Chunks State
let incomingFile = { chunks: [], meta: null, receivedBytes: 0 };

// Pre-loaded Sample Videos for Language Lessons
const sampleVideos = {
    french: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    spanish: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    english: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    arabic: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
};

// Generate 6-Character Room Code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Format Seconds to MM:SS
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Parse Video URL for Platform Identification
function parseVideoURL(url) {
    if (!url) return { type: 'direct', embedUrl: '', title: 'Web Video' };
    const cleanUrl = url.trim();

    // 1. YouTube (Watch, Shorts, Embed, Shortlink)
    const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
        return {
            type: 'youtube',
            videoId: ytMatch[1],
            embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?enablejsapi=1&autoplay=1&rel=0`,
            title: 'YouTube Video'
        };
    }

    // 2. Instagram (Reels or Posts)
    const igMatch = cleanUrl.match(/(?:instagram\.com\/(?:p|reel|tv)\/([^\/?#&]+))/);
    if (igMatch && igMatch[1]) {
        return {
            type: 'instagram',
            embedUrl: `https://www.instagram.com/reel/${igMatch[1]}/embed`,
            title: 'Instagram Reel'
        };
    }

    // 3. Facebook Video
    if (cleanUrl.includes('facebook.com') || cleanUrl.includes('fb.watch')) {
        return {
            type: 'facebook',
            embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(cleanUrl)}&show_text=false&autoplay=true`,
            title: 'Facebook Video'
        };
    }

    // 4. Direct Video MP4/WebM URL
    return {
        type: 'direct',
        embedUrl: cleanUrl,
        title: cleanUrl.split('/').pop().substring(0, 30) || 'Web Video File'
    };
}

// Initialize YouTube IFrame API Callback
window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': () => { isYtReady = true; },
            'onStateChange': onYouTubeStateChange
        }
    });
};

function onYouTubeStateChange(event) {
    if (peerConnection && currentRole === 'laptop') {
        const isPlaying = (event.data === YT.PlayerState.PLAYING);
        sendP2PData({ type: 'sync-state', isPlaying: isPlaying });
    }
}

// Check URL Params on Load for Immediate Phone Pairing
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const roleParam = urlParams.get('role');

    if (roomParam && roleParam === 'controller') {
        startPhoneMode(roomParam.toUpperCase());
    }
});

// START LAPTOP DISPLAY RECEIVER MODE
window.startLaptopMode = function () {
    currentRole = 'laptop';
    roomId = generateRoomCode();

    document.getElementById('mode-selector').classList.add('hidden');
    document.getElementById('laptop-view').classList.remove('hidden');
    document.getElementById('laptop-room-code').innerText = roomId;
    document.getElementById('modal-room-code').innerText = roomId;

    // Construct Direct Remote Controller Link
    const controllerURL = `${window.location.origin}${window.location.pathname}?room=${roomId}&role=controller`;
    document.getElementById('direct-room-url').value = controllerURL;

    // Render QR Code
    const qrContainer = document.getElementById('qrcode-canvas');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: controllerURL,
        width: 200,
        height: 200,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // Show QR Modal initially
    toggleQRModal(true);

    // Initialize PeerJS as Receiver Host
    const peerId = `educast-${roomId}`;
    peer = new Peer(peerId);

    peer.on('open', (id) => {
        console.log('Laptop Peer Host Ready:', id);
    });

    peer.on('connection', (conn) => {
        peerConnection = conn;
        console.log('Phone Remote Connected via P2P!');
        updateLaptopConnectionBadge(true);

        conn.on('data', (data) => {
            handleIncomingP2PCommandOnLaptop(data);
        });

        conn.on('close', () => {
            updateLaptopConnectionBadge(false);
        });
    });

    setupLaptopVideoEvents();
    setupLaptopKeyboardShortcuts();
};

function updateLaptopConnectionBadge(connected) {
    const badge = document.getElementById('connection-status-badge');
    if (connected) {
        badge.className = "flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 text-xs font-medium";
        badge.innerHTML = `<i class="fa-solid fa-mobile-screen text-emerald-400"></i> <span>Phone Connected</span>`;
    } else {
        badge.className = "flex items-center space-x-2 bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-full border border-amber-500/20 text-xs font-medium";
        badge.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Waiting for Phone Scan...</span>`;
    }
}

// Handle Incoming P2P Data on Laptop Receiver
function handleIncomingP2PCommandOnLaptop(data) {
    if (!data) return;

    const video = document.getElementById('classroom-video');
    const iframe = document.getElementById('classroom-iframe');
    const ytWrapper = document.getElementById('youtube-player-wrapper');

    switch (data.type) {
        case 'cmd-play':
            if (currentVideoType === 'direct') video.play();
            else if (currentVideoType === 'youtube' && ytPlayer && isYtReady) ytPlayer.playVideo();
            flashActionBadge('fa-play');
            break;

        case 'cmd-pause':
            if (currentVideoType === 'direct') video.pause();
            else if (currentVideoType === 'youtube' && ytPlayer && isYtReady) ytPlayer.pauseVideo();
            flashActionBadge('fa-pause');
            break;

        case 'cmd-togglePlay':
            if (currentVideoType === 'direct') {
                if (video.paused) video.play(); else video.pause();
                flashActionBadge(video.paused ? 'fa-pause' : 'fa-play');
            } else if (currentVideoType === 'youtube' && ytPlayer && isYtReady) {
                const state = ytPlayer.getPlayerState();
                if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
            }
            break;

        case 'cmd-skip':
            if (currentVideoType === 'direct') {
                video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + data.seconds));
            } else if (currentVideoType === 'youtube' && ytPlayer && isYtReady) {
                const curr = ytPlayer.getCurrentTime();
                ytPlayer.seekTo(Math.max(0, curr + data.seconds), true);
            }
            break;

        case 'cmd-seek':
            if (currentVideoType === 'direct') {
                video.currentTime = data.seconds;
            } else if (currentVideoType === 'youtube' && ytPlayer && isYtReady) {
                ytPlayer.seekTo(data.seconds, true);
            }
            break;

        case 'cmd-speed':
            if (currentVideoType === 'direct') video.playbackRate = data.speed;
            else if (currentVideoType === 'youtube' && ytPlayer && isYtReady) ytPlayer.setPlaybackRate(data.speed);
            document.getElementById('playback-speed-badge').innerText = `${data.speed}x Speed`;
            break;

        case 'cmd-volume':
            if (currentVideoType === 'direct') video.volume = data.volume;
            else if (currentVideoType === 'youtube' && ytPlayer && isYtReady) ytPlayer.setVolume(data.volume * 100);
            break;

        case 'cmd-fullscreen':
            toggleFullscreen();
            break;

        case 'cmd-load-video':
            loadVideoOnLaptop(data.url, data.videoType, data.title, data.videoId);
            break;

        case 'laser-pos':
            updateLaserDot(data.x, data.y, data.active);
            break;

        case 'subtitle':
            updateSubtitleOverlay(data.text);
            break;

        case 'ab-loop':
            abLoop = data.loopState;
            const abBadge = document.getElementById('a-b-loop-badge');
            if (abLoop.active) abBadge.classList.remove('hidden');
            else abBadge.classList.add('hidden');
            break;

        // Mobile P2P Video File Transfer Chunks
        case 'file-meta':
            incomingFile = { chunks: [], meta: data, receivedBytes: 0 };
            document.getElementById('p2p-receive-progress').classList.remove('hidden');
            document.getElementById('p2p-file-name').innerText = data.name;
            document.getElementById('p2p-progress-bar').style.width = '0%';
            document.getElementById('p2p-progress-percent').innerText = '0%';
            break;

        case 'file-chunk':
            incomingFile.chunks.push(data.chunk);
            incomingFile.receivedBytes += data.chunk.byteLength || data.chunk.length || 0;
            const percent = Math.min(100, Math.floor((incomingFile.receivedBytes / incomingFile.meta.size) * 100));
            document.getElementById('p2p-progress-bar').style.width = `${percent}%`;
            document.getElementById('p2p-progress-percent').innerText = `${percent}%`;
            break;

        case 'file-complete':
            document.getElementById('p2p-receive-progress').classList.add('hidden');
            const videoBlob = new Blob(incomingFile.chunks, { type: incomingFile.meta.mimeType || 'video/mp4' });
            const blobUrl = URL.createObjectURL(videoBlob);
            loadVideoOnLaptop(blobUrl, 'direct', incomingFile.meta.name);
            incomingFile = { chunks: [], meta: null, receivedBytes: 0 };
            break;
    }
}

// Load Video on Laptop Display
function loadVideoOnLaptop(url, type, title, videoId) {
    currentVideoType = type;
    document.getElementById('video-placeholder').classList.add('hidden');
    document.getElementById('video-title-display').innerText = title || "Lesson Video";

    const video = document.getElementById('classroom-video');
    const iframe = document.getElementById('classroom-iframe');
    const ytWrapper = document.getElementById('youtube-player-wrapper');

    if (type === 'direct') {
        iframe.classList.add('hidden');
        ytWrapper.classList.add('hidden');
        video.classList.remove('hidden');
        video.src = url;
        video.play().catch(() => { });
    } else if (type === 'youtube') {
        video.pause();
        video.classList.add('hidden');
        iframe.classList.add('hidden');
        ytWrapper.classList.remove('hidden');

        if (ytPlayer && isYtReady && videoId) {
            ytPlayer.loadVideoById(videoId);
        }
    } else { // Instagram or Facebook embed
        video.pause();
        video.classList.add('hidden');
        ytWrapper.classList.add('hidden');
        iframe.classList.remove('hidden');
        iframe.src = url;
    }
}

// Update Laser Dot Position on Laptop Screen
function updateLaserDot(x, y, active) {
    const dot = document.getElementById('laser-dot');
    if (active) {
        dot.classList.remove('hidden');
        dot.style.left = `${x}%`;
        dot.style.top = `${y}%`;
    } else {
        dot.classList.add('hidden');
    }
}

// Update Subtitle Overlay Text
function updateSubtitleOverlay(text) {
    const overlay = document.getElementById('subtitle-overlay');
    const subtitleText = document.getElementById('subtitle-text');
    if (text) {
        subtitleText.innerText = text;
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// Flash Action Badge Feedback Animation
function flashActionBadge(iconClass) {
    const badge = document.getElementById('remote-action-badge');
    const icon = document.getElementById('remote-action-icon');
    icon.className = `fa-solid ${iconClass}`;
    badge.style.opacity = '1';
    badge.style.transform = 'scale(1)';
    setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transform = 'scale(1.25)';
    }, 450);
}

// Setup Laptop Video Events & Status Sync back to Phone
function setupLaptopVideoEvents() {
    const video = document.getElementById('classroom-video');

    video.addEventListener('timeupdate', () => {
        const current = video.currentTime;
        const duration = video.duration || 0;

        document.getElementById('video-time-display').innerText = `${formatTime(current)} / ${formatTime(duration)}`;

        // Handle A-B Repetition Loop
        if (abLoop.active && current >= abLoop.end) {
            video.currentTime = abLoop.start;
        }

        // Sync status to Phone Remote periodically
        if (peerConnection && Math.floor(current) % 1 === 0) {
            sendP2PData({
                type: 'sync-status',
                currentTime: current,
                duration: duration,
                isPlaying: !video.paused
            });
        }
    });
}

// Laptop Display Keyboard Shortcuts
function setupLaptopKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (currentRole !== 'laptop') return;
        const video = document.getElementById('classroom-video');

        if (e.code === 'Space') {
            e.preventDefault();
            handleIncomingP2PCommandOnLaptop({ type: 'cmd-togglePlay' });
        } else if (e.code === 'KeyF') {
            toggleFullscreen();
        } else if (e.code === 'KeyM') {
            video.muted = !video.muted;
        } else if (e.code === 'ArrowRight') {
            handleIncomingP2PCommandOnLaptop({ type: 'cmd-skip', seconds: 5 });
        } else if (e.code === 'ArrowLeft') {
            handleIncomingP2PCommandOnLaptop({ type: 'cmd-skip', seconds: -5 });
        }
    });
}


// START PHONE REMOTE CONTROLLER MODE
window.startPhoneMode = function (targetRoomCode) {
    currentRole = 'phone';
    roomId = targetRoomCode.toUpperCase();

    document.getElementById('mode-selector').classList.add('hidden');
    document.getElementById('phone-view').classList.remove('hidden');
    document.getElementById('phone-room-status').innerText = `Connecting to Room: ${roomId}...`;

    peer = new Peer();

    peer.on('open', () => {
        const targetPeerId = `educast-${roomId}`;
        peerConnection = peer.connect(targetPeerId, { reliable: true });

        peerConnection.on('open', () => {
            document.getElementById('phone-room-status').innerText = `Connected to Room: ${roomId}`;
            document.getElementById('phone-room-status').className = "text-[10px] text-emerald-400 font-medium";
        });

        peerConnection.on('data', (data) => {
            handleIncomingP2PDataOnPhone(data);
        });

        peerConnection.on('close', () => {
            document.getElementById('phone-room-status').innerText = `Disconnected`;
            document.getElementById('phone-room-status').className = "text-[10px] text-red-400 font-medium";
        });
    });

    peer.on('error', (err) => {
        alert(`Connection Error: Unable to find room "${roomId}". Make sure Laptop display is open.`);
    });

    setupPhoneTrackpad();
};

function sendP2PData(data) {
    if (peerConnection && peerConnection.open) {
        peerConnection.send(data);
    }
}

// Handle Incoming P2P Sync on Phone
function handleIncomingP2PDataOnPhone(data) {
    if (!data) return;

    if (data.type === 'sync-status') {
        const slider = document.getElementById('phone-seek-slider');
        if (data.duration) {
            slider.max = data.duration;
            slider.value = data.currentTime || 0;
            document.getElementById('phone-current-time').innerText = formatTime(data.currentTime || 0);
            document.getElementById('phone-duration-time').innerText = formatTime(data.duration);
            document.getElementById('phone-time-badge').innerText = formatTime(data.currentTime || 0);
        }

        const playIcon = document.getElementById('phone-play-icon');
        if (data.isPlaying) {
            playIcon.className = "fa-solid fa-pause";
        } else {
            playIcon.className = "fa-solid fa-play ml-1";
        }
    }
}

// Remote Action Handlers from Phone
window.togglePlayPause = function () {
    sendP2PData({ type: 'cmd-togglePlay' });
};

window.sendRemoteCommand = function (action, payload) {
    if (action === 'skip') {
        sendP2PData({ type: 'cmd-skip', seconds: payload });
    } else if (action === 'volume') {
        sendP2PData({ type: 'cmd-volume', volume: payload });
    } else if (action === 'fullscreen') {
        sendP2PData({ type: 'cmd-fullscreen' });
    }
};

window.handleSeekInput = function (val) {
    sendP2PData({ type: 'cmd-seek', seconds: parseFloat(val) });
};

window.updateSeekTimeLabel = function (val) {
    document.getElementById('phone-current-time').innerText = formatTime(parseFloat(val));
};

window.setSpeed = function (speed) {
    sendP2PData({ type: 'cmd-speed', speed: speed });
    document.getElementById('phone-speed-label').innerText = `${speed}x`;

    // Highlight active speed button
    document.querySelectorAll('.speed-btn').forEach(btn => {
        if (btn.innerText === `${speed}x`) {
            btn.className = "speed-btn py-2 text-xs font-semibold rounded-xl bg-sky-600 text-white border border-sky-500 shadow";
        } else {
            btn.className = "speed-btn py-2 text-xs font-semibold rounded-xl bg-slate-800 border border-slate-700 text-slate-300 active:bg-sky-600 transition";
        }
    });
};

// Cast Video from Link
window.castVideoFromLink = function () {
    const linkInput = document.getElementById('link-input');
    const rawUrl = linkInput.value.trim();

    if (!rawUrl) {
        alert("Please enter or paste a video link first.");
        return;
    }

    const parsed = parseVideoURL(rawUrl);

    sendP2PData({
        type: 'cmd-load-video',
        url: parsed.embedUrl,
        videoType: parsed.type,
        title: parsed.title,
        videoId: parsed.videoId
    });

    document.getElementById('phone-video-title').innerText = parsed.title;
    linkInput.value = '';
    switchPhoneTab('controls');
};

// Load Sample Language Video
window.loadSampleVideo = function (key) {
    const titles = {
        french: "French Pronunciation Basics",
        spanish: "Spanish Grammar Dialogue",
        english: "English Listening Comprehension",
        arabic: "Arabic Vocabulary & Phonetics"
    };

    sendP2PData({
        type: 'cmd-load-video',
        url: sampleVideos[key],
        videoType: 'direct',
        title: titles[key]
    });

    document.getElementById('phone-video-title').innerText = titles[key];
    switchPhoneTab('controls');
};

// Stream Mobile Device Video File via P2P Chunks
window.handlePhoneVideoFileSelect = function (event) {
    const file = event.target.files[0];
    if (!file || !peerConnection) return;

    document.getElementById('phone-video-title').innerText = file.name;

    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const percentageText = document.getElementById('upload-percentage');
    const statusText = document.getElementById('upload-status-text');

    progressContainer.classList.remove('hidden');
    statusText.innerText = "Streaming file P2P...";

    // Send Metadata first
    sendP2PData({
        type: 'file-meta',
        name: file.name,
        size: file.size,
        mimeType: file.type || 'video/mp4'
    });

    const chunkSize = 64 * 1024; // 64KB chunks
    let offset = 0;

    const reader = new FileReader();

    reader.onload = function (e) {
        const chunk = e.target.result;
        sendP2PData({ type: 'file-chunk', chunk: chunk });
        offset += chunk.byteLength;

        const percent = Math.min(100, Math.floor((offset / file.size) * 100));
        progressBar.style.width = `${percent}%`;
        percentageText.innerText = `${percent}%`;

        if (offset < file.size) {
            readNextChunk();
        } else {
            sendP2PData({ type: 'file-complete' });
            statusText.innerText = "File sent to laptop!";
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                switchPhoneTab('controls');
            }, 600);
        }
    };

    function readNextChunk() {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
    }

    readNextChunk();
};


// SETUP PHONE TRACKPAD FOR VIRTUAL LASER POINTER
function setupPhoneTrackpad() {
    const trackpad = document.getElementById('phone-trackpad');
    if (!trackpad) return;

    function handleTouch(e) {
        e.preventDefault();
        const rect = trackpad.getBoundingClientRect();
        const touch = e.touches[0] || e.changedTouches[0];

        let x = ((touch.clientX - rect.left) / rect.width) * 100;
        let y = ((touch.clientY - rect.top) / rect.height) * 100;

        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        sendP2PData({
            type: 'laser-pos',
            x: x.toFixed(1),
            y: y.toFixed(1),
            active: true
        });
    }

    function handleTouchEnd() {
        sendP2PData({
            type: 'laser-pos',
            x: -10,
            y: -10,
            active: false
        });
    }

    trackpad.addEventListener('touchstart', handleTouch, { passive: false });
    trackpad.addEventListener('touchmove', handleTouch, { passive: false });
    trackpad.addEventListener('touchend', handleTouch);
}


// SUBTITLE & LESSON NOTE BROADCASTER
window.broadcastSubtitle = function () {
    const text = document.getElementById('subtitle-input').value.trim();
    if (!text) return;

    sendP2PData({ type: 'subtitle', text: text });
};

window.clearSubtitle = function () {
    document.getElementById('subtitle-input').value = '';
    sendP2PData({ type: 'subtitle', text: "" });
};


// A-B LOOP REPETITION PRACTICE TOOL
window.setABLoop = function (action) {
    const slider = document.getElementById('phone-seek-slider');
    const time = parseFloat(slider.value) || 0;
    const statusText = document.getElementById('ab-status-text');

    if (action === 'A') {
        abLoop.start = time;
        document.getElementById('btn-set-a').innerText = `A: ${formatTime(time)}`;
    } else if (action === 'B') {
        abLoop.end = time;
        document.getElementById('btn-set-b').innerText = `B: ${formatTime(time)}`;
    } else if (action === 'clear') {
        abLoop = { active: false, start: 0, end: 0 };
        document.getElementById('btn-set-a').innerText = `Set Point A`;
        document.getElementById('btn-set-b').innerText = `Set Point B`;
        statusText.innerText = 'Off';
        sendP2PData({ type: 'ab-loop', loopState: abLoop });
        return;
    }

    if (abLoop.start < abLoop.end && abLoop.end > 0) {
        abLoop.active = true;
        statusText.innerText = `Active (${formatTime(abLoop.start)} - ${formatTime(abLoop.end)})`;
        statusText.className = "text-[10px] text-purple-400 font-bold";
    }

    sendP2PData({ type: 'ab-loop', loopState: abLoop });
};


// LESSON TIMESTAMP BOOKMARKS MANAGER
window.addBookmark = function () {
    const slider = document.getElementById('phone-seek-slider');
    const time = parseFloat(slider.value) || 0;

    const title = prompt("Bookmark Title / Lesson Note:", `Lesson Point at ${formatTime(time)}`);
    if (!title) return;

    bookmarks.push({ time, title });
    renderBookmarks();
};

function renderBookmarks() {
    const container = document.getElementById('bookmarks-list');
    if (bookmarks.length === 0) {
        container.innerHTML = `<div class="text-[11px] text-slate-500 text-center py-2">No bookmarks added yet. Tap above to mark key video moments.</div>`;
        return;
    }

    container.innerHTML = bookmarks.map((b, i) => `
    <div class="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
      <span class="truncate mr-2 font-medium text-slate-200">${b.title}</span>
      <button onclick="handleSeekInput(${b.time})" class="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg font-mono text-[10px] hover:bg-amber-500/30 transition">
        ${formatTime(b.time)}
      </button>
    </div>
  `).join('');
}


// UI MODALS & UTILITIES
window.switchPhoneTab = function (tabName) {
    document.getElementById('phone-tab-controls').classList.add('hidden');
    document.getElementById('phone-tab-videos').classList.add('hidden');
    document.getElementById('phone-tab-tools').classList.add('hidden');

    document.getElementById('tab-btn-controls').className = "py-2.5 rounded-xl hover:text-white transition";
    document.getElementById('tab-btn-videos').className = "py-2.5 rounded-xl hover:text-white transition";
    document.getElementById('tab-btn-tools').className = "py-2.5 rounded-xl hover:text-white transition";

    document.getElementById(`phone-tab-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-btn-${tabName}`);
    activeBtn.className = "py-2.5 rounded-xl bg-sky-600 text-white font-semibold shadow transition";
};

window.toggleQRModal = function (show) {
    const modal = document.getElementById('qr-modal');
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
};

window.showPhoneConnectModal = function () {
    document.getElementById('phone-connect-modal').classList.remove('hidden');
};

window.hidePhoneConnectModal = function () {
    document.getElementById('phone-connect-modal').classList.add('hidden');
};

window.handleManualRoomSubmit = function (e) {
    e.preventDefault();
    const code = document.getElementById('manual-room-input').value.trim();
    if (code.length === 6) {
        hidePhoneConnectModal();
        startPhoneMode(code);
    } else {
        alert("Please enter a valid 6-character room code.");
    }
};

window.copyRoomURL = function () {
    const urlInput = document.getElementById('direct-room-url');
    urlInput.select();
    document.execCommand('copy');
    alert("Remote Control URL copied to clipboard!");
};

window.toggleFullscreen = function () {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
};

window.exitPhoneMode = function () {
    if (confirm("Disconnect remote control?")) {
        location.href = window.location.pathname;
    }
};