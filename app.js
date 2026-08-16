/**
 * EduCast Sync — Two-Screen Synchronized Video Player
 *
 * LAPTOP/TV: Auto-creates a room, shows QR code, plays the video.
 * PHONE:     Scans QR, gets controller UI — paste link, play/pause.
 */

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
let peer = null;
let conn = null;
let roomId = null;
let role = null; // 'laptop' or 'phone'

let ytPlayer = null;
let isYtReady = false;
let currentVideoType = 'direct';
let isPlaying = false;
let isSuppressing = false; // Avoid sync echo loops

// ----------------------------------------------------------------
// Entry Point — Detect role from URL on load
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const roleParam = params.get('role');

    if (roomParam && roleParam === 'phone') {
        // Phone opened via QR scan
        startPhoneMode(roomParam.toUpperCase());
    } else {
        // Laptop/TV — auto-start and show QR
        startLaptopMode();
    }
});

// ----------------------------------------------------------------
// LAPTOP MODE
// ----------------------------------------------------------------
window.startLaptopMode = function () {
    role = 'laptop';
    roomId = generateRoomCode();

    showScreen('screen-laptop');
    document.getElementById('laptop-room-code').innerText = roomId;

    // Generate QR Code
    const joinUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}&role=phone`;
    const canvas = document.getElementById('laptop-qr-canvas');
    canvas.innerHTML = '';
    new QRCode(canvas, {
        text: joinUrl,
        width: 220,
        height: 220,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    // Start PeerJS as host
    peer = new Peer(`educast-${roomId}`);

    peer.on('open', () => {
        console.log('[Laptop] Peer ready, room:', roomId);
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupLaptopConnection();
    });

    peer.on('error', (err) => {
        console.error('[Laptop] Peer error:', err);
    });

    setupYouTubePlayer();
};

function setupLaptopConnection() {
    setLaptopStatus('Phone Connected', 'emerald');

    conn.on('data', (data) => {
        handleCommandOnLaptop(data);
    });

    conn.on('close', () => {
        setLaptopStatus('Phone Disconnected — Scan QR to Reconnect', 'amber');
        conn = null;
    });
}

function handleCommandOnLaptop(data) {
    const video = document.getElementById('laptop-video');

    isSuppressing = true;

    switch (data.cmd) {
        case 'load':
            loadVideoOnLaptop(data.url, data.videoType);
            break;

        case 'play':
            if (currentVideoType === 'direct') {
                video.play();
            } else if (currentVideoType === 'youtube' && isYtReady) {
                ytPlayer.playVideo();
            }
            isPlaying = true;
            flashBadge('fa-play');
            break;

        case 'pause':
            if (currentVideoType === 'direct') {
                video.pause();
            } else if (currentVideoType === 'youtube' && isYtReady) {
                ytPlayer.pauseVideo();
            }
            isPlaying = false;
            flashBadge('fa-pause');
            break;

        case 'toggle':
            if (currentVideoType === 'direct') {
                if (video.paused) { video.play(); isPlaying = true; flashBadge('fa-play'); }
                else { video.pause(); isPlaying = false; flashBadge('fa-pause'); }
            } else if (currentVideoType === 'youtube' && isYtReady) {
                const state = ytPlayer.getPlayerState();
                if (state === YT.PlayerState.PLAYING) {
                    ytPlayer.pauseVideo(); isPlaying = false; flashBadge('fa-pause');
                } else {
                    ytPlayer.playVideo(); isPlaying = true; flashBadge('fa-play');
                }
            }
            // Send state back to phone
            sendToPhone({ cmd: 'sync-state', isPlaying: isPlaying });
            break;

        case 'skip':
            if (currentVideoType === 'direct') {
                video.currentTime = Math.max(0, video.currentTime + data.seconds);
            } else if (currentVideoType === 'youtube' && isYtReady) {
                ytPlayer.seekTo(ytPlayer.getCurrentTime() + data.seconds, true);
            }
            break;
    }

    setTimeout(() => isSuppressing = false, 200);
}

function loadVideoOnLaptop(url, type) {
    currentVideoType = type;

    // Hide QR overlay — video is incoming
    document.getElementById('qr-overlay').classList.add('hidden');

    const video = document.getElementById('laptop-video');
    const ytWrapper = document.getElementById('laptop-yt-wrapper');

    if (type === 'direct') {
        ytWrapper.classList.add('hidden');
        video.classList.remove('hidden');
        video.src = url;
        video.play().catch(() => {});
        isPlaying = true;
    } else if (type === 'youtube') {
        video.classList.add('hidden');
        video.pause();
        ytWrapper.classList.remove('hidden');
        if (ytPlayer && isYtReady) {
            ytPlayer.loadVideoById(url);
        } else {
            document.getElementById('laptop-yt-wrapper').dataset.pendingId = url;
        }
        isPlaying = true;
    }
}

function setLaptopStatus(msg, color) {
    const el = document.getElementById('laptop-conn-status');
    const colors = {
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    };
    const dotColors = {
        emerald: 'bg-emerald-400 shadow-[0_0_6px_#10b981]',
        amber: 'bg-amber-400 animate-pulse',
        rose: 'bg-rose-400 animate-pulse',
    };
    el.className = `flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full border ${colors[color] || colors.amber}`;
    el.innerHTML = `<span class="w-2 h-2 rounded-full ${dotColors[color] || dotColors.amber}"></span><span>${msg}</span>`;
}

function flashBadge(iconClass) {
    const badge = document.getElementById('laptop-sync-badge');
    const icon = document.getElementById('laptop-sync-icon');
    icon.className = `fa-solid ${iconClass}${iconClass === 'fa-play' ? ' ml-1' : ''}`;
    badge.style.opacity = '1';
    badge.style.transform = 'scale(1)';
    setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transform = 'scale(1.25)';
    }, 500);
}

// ----------------------------------------------------------------
// PHONE MODE
// ----------------------------------------------------------------
function startPhoneMode(targetRoom) {
    role = 'phone';
    roomId = targetRoom;

    showScreen('screen-phone');
    document.getElementById('phone-conn-status').innerText = `Connecting to Room ${roomId}...`;
    document.getElementById('phone-conn-detail').innerText = `Connecting to laptop room: ${roomId}`;

    peer = new Peer();

    peer.on('open', () => {
        conn = peer.connect(`educast-${roomId}`, { reliable: true });

        conn.on('open', () => {
            setPhoneStatus('Connected to Laptop', 'emerald');
            document.getElementById('phone-conn-detail').innerText = `P2P Connected — Room ${roomId}`;
            document.getElementById('phone-dot').className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_6px_#10b981]';
        });

        conn.on('data', (data) => {
            // Receive state sync back from laptop
            if (data.cmd === 'sync-state') {
                isPlaying = data.isPlaying;
                updatePhonePlayIcon();
            }
        });

        conn.on('close', () => {
            setPhoneStatus('Disconnected', 'rose');
        });
    });

    peer.on('error', (err) => {
        setPhoneStatus('Connection failed — Try scanning again', 'rose');
        console.error('[Phone] Peer error:', err);
    });
}

function sendToPhone(data) {
    if (conn && conn.open) conn.send(data);
}

function sendToLaptop(data) {
    if (conn && conn.open) conn.send(data);
}

function setPhoneStatus(msg, color) {
    const el = document.getElementById('phone-conn-status');
    const colors = {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        rose: 'text-rose-400',
    };
    el.className = `text-[10px] font-medium ${colors[color] || colors.amber}`;
    el.innerText = msg;
}

// ----------------------------------------------------------------
// Phone UI Actions
// ----------------------------------------------------------------
window.sendVideoLink = function () {
    const input = document.getElementById('phone-link-input');
    const raw = input.value.trim();
    if (!raw) return;

    const { url, type } = parseVideoUrl(raw);
    sendToLaptop({ cmd: 'load', url, videoType: type });
    isPlaying = true;
    updatePhonePlayIcon();
    input.value = '';
};

window.togglePlayPause = function () {
    sendToLaptop({ cmd: 'toggle' });
    // Optimistically flip icon; laptop will confirm
    isPlaying = !isPlaying;
    updatePhonePlayIcon();
};

window.sendCommand = function (action, value) {
    if (action === 'skip') {
        sendToLaptop({ cmd: 'skip', seconds: value });
    }
};

function updatePhonePlayIcon() {
    const icon = document.getElementById('phone-playpause-icon');
    icon.className = isPlaying
        ? 'fa-solid fa-pause text-4xl'
        : 'fa-solid fa-play text-4xl ml-1.5';
}

// ----------------------------------------------------------------
// YouTube Player
// ----------------------------------------------------------------
function setupYouTubePlayer() {
    // YouTube API callback will fire when ready
}

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('laptop-yt-player', {
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1 },
        events: {
            onReady: () => {
                isYtReady = true;
                const pending = document.getElementById('laptop-yt-wrapper').dataset.pendingId;
                if (pending) ytPlayer.loadVideoById(pending);
            }
        }
    });
};

// ----------------------------------------------------------------
// Utility: Parse Video URL (YouTube ID vs direct)
// ----------------------------------------------------------------
function parseVideoUrl(rawUrl) {
    const ytMatch = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
        return { url: ytMatch[1], type: 'youtube' };
    }
    return { url: rawUrl, type: 'direct' };
}

// ----------------------------------------------------------------
// Utility: Generate Room Code & Show Screen
// ----------------------------------------------------------------
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function showScreen(id) {
    ['screen-home', 'screen-laptop', 'screen-phone'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    el.classList.add('flex');
}