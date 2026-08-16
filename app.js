/**
 * EduCast Sync — Two-Screen Synchronized Video Player
 *
 * LAPTOP/TV : Opens → shows QR code → plays video full-screen.
 * PHONE     : Scans QR → paste link + play/pause remote control.
 */

// ── State ────────────────────────────────────────────────────────
let peer        = null;
let conn        = null;
let roomId      = null;
let role        = null;   // 'laptop' | 'phone'

let ytPlayer    = null;
let isYtReady   = false;
let currentType = 'direct'; // 'direct' | 'youtube' | 'iframe'
let isPlaying   = false;

// ── Entry point ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const p    = new URLSearchParams(window.location.search);
    const room = p.get('room');
    const rl   = p.get('role');

    if (room && rl === 'phone') {
        startPhoneMode(room.toUpperCase());
    } else {
        startLaptopMode();
    }
});

// ════════════════════════════════════════════════════════════════
// LAPTOP MODE
// ════════════════════════════════════════════════════════════════
window.startLaptopMode = function () {
    role   = 'laptop';
    roomId = generateRoomCode();

    showScreen('screen-laptop');
    document.getElementById('laptop-room-code').innerText = roomId;

    // Build join URL and render QR code
    const joinUrl = `${location.origin}${location.pathname}?room=${roomId}&role=phone`;
    const canvas  = document.getElementById('laptop-qr-canvas');
    canvas.innerHTML = '';
    new QRCode(canvas, {
        text         : joinUrl,
        width        : 220,
        height       : 220,
        colorDark    : '#0f172a',
        colorLight   : '#ffffff',
        correctLevel : QRCode.CorrectLevel.H
    });

    // Start PeerJS host
    peer = new Peer(`educast-${roomId}`);
    peer.on('open',       ()   => console.log('[Laptop] ready, room:', roomId));
    peer.on('connection', conn => { setupLaptopConn(conn); });
    peer.on('error',      err  => console.error('[Laptop] error:', err));

    // Pre-create the YouTube player (muted, ready for remote load)
    initYTPlayer();
};

function setupLaptopConn(c) {
    conn = c;
    setLaptopStatus('📱 Phone Connected — paste a link on your phone', 'emerald');

    conn.on('data',  data => handleCmdOnLaptop(data));
    conn.on('close', ()   => {
        setLaptopStatus('Phone disconnected — scan QR to reconnect', 'amber');
        conn = null;
    });
}

// ── Handle commands sent from the phone ─────────────────────────
function handleCmdOnLaptop(data) {
    if (!data || !data.cmd) return;
    const video = document.getElementById('laptop-video');

    switch (data.cmd) {
        case 'load':
            loadOnLaptop(data.url, data.videoType, data.embedUrl, data.isVertical);
            break;

        case 'play':
            execPlay();
            flashBadge('fa-play');
            break;

        case 'pause':
            execPause();
            flashBadge('fa-pause');
            break;

        case 'toggle':
            if (currentType === 'direct') {
                if (video.paused) { execPlay(); flashBadge('fa-play'); }
                else              { execPause(); flashBadge('fa-pause'); }
            } else if (currentType === 'youtube' && isYtReady) {
                const st = ytPlayer.getPlayerState();
                if (st === YT.PlayerState.PLAYING) { execPause(); flashBadge('fa-pause'); }
                else                               { execPlay();  flashBadge('fa-play');  }
            }
            // Send confirmed state back to phone
            sendToPhone({ cmd: 'sync-state', isPlaying });
            break;

        case 'skip':
            if (currentType === 'direct') {
                video.currentTime = Math.max(0, video.currentTime + data.seconds);
            } else if (currentType === 'youtube' && isYtReady) {
                ytPlayer.seekTo(ytPlayer.getCurrentTime() + data.seconds, true);
            }
            break;
    }
}

function execPlay() {
    const video = document.getElementById('laptop-video');
    if (currentType === 'direct') {
        video.play().catch(() => {});
    } else if (currentType === 'youtube' && isYtReady) {
        ytPlayer.unMute();
        ytPlayer.setVolume(100);
        ytPlayer.playVideo();
    }
    isPlaying = true;
}

function execPause() {
    const video = document.getElementById('laptop-video');
    if (currentType === 'direct') {
        video.pause();
    } else if (currentType === 'youtube' && isYtReady) {
        ytPlayer.pauseVideo();
    }
    isPlaying = false;
}

// ── Load a video on the laptop screen ───────────────────────────
function loadOnLaptop(url, type, embedUrl, isVertical) {
    currentType = type;

    // Hide the QR overlay
    document.getElementById('qr-overlay').classList.add('hidden');
    setLaptopStatus('📱 Phone Connected — Playing', 'emerald');

    const video      = document.getElementById('laptop-video');
    const ytWrapper  = document.getElementById('laptop-yt-wrapper');
    const iframeWrap = document.getElementById('laptop-iframe-wrapper');
    const iframe     = document.getElementById('laptop-iframe');

    // Hide everything first
    video.classList.add('hidden');
    video.pause();
    ytWrapper.classList.add('hidden');
    iframeWrap.classList.add('hidden');
    iframe.src = '';

    if (type === 'direct') {
        video.classList.remove('hidden');
        video.src    = url;
        video.muted  = true;
        video.play().then(() => { video.muted = false; }).catch(() => { video.muted = false; });
        isPlaying = true;

    } else if (type === 'youtube') {
        ytWrapper.classList.remove('hidden');
        if (isYtReady) {
            loadYTVideo(url);
        } else {
            ytWrapper.dataset.pendingId = url;
        }
        isPlaying = true;

    } else if (type === 'iframe') {
        iframeWrap.classList.remove('hidden');

        // Apply aspect-ratio class based on content orientation
        iframeWrap.classList.remove('vertical', 'horizontal');
        iframeWrap.classList.add(isVertical ? 'vertical' : 'horizontal');

        iframe.src = embedUrl;
        isPlaying  = true;
    }
}

// ── YouTube helpers ──────────────────────────────────────────────
function loadYTVideo(videoId) {
    ytPlayer.mute();
    ytPlayer.loadVideoById(videoId);
    // Small delay then play (unmuted after browser allows)
    setTimeout(() => {
        ytPlayer.playVideo();
        setTimeout(() => {
            ytPlayer.unMute();
            ytPlayer.setVolume(100);
        }, 1200);
    }, 400);
}

function initYTPlayer() {
    // Placeholder — actual init happens in onYouTubeIframeAPIReady
}

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('laptop-yt-player', {
        height    : '100%',
        width     : '100%',
        playerVars: { autoplay: 1, mute: 1, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events    : {
            onReady: () => {
                isYtReady = true;
                const pending = document.getElementById('laptop-yt-wrapper').dataset.pendingId;
                if (pending) {
                    delete document.getElementById('laptop-yt-wrapper').dataset.pendingId;
                    loadYTVideo(pending);
                }
            }
        }
    });
};

// ── UI helpers ───────────────────────────────────────────────────
function setLaptopStatus(msg, color) {
    const el     = document.getElementById('laptop-conn-status');
    const styles = {
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber  : 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        rose   : 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    };
    const dots = {
        emerald: 'w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]',
        amber  : 'w-2 h-2 rounded-full bg-amber-400 animate-pulse',
        rose   : 'w-2 h-2 rounded-full bg-rose-400 animate-pulse',
    };
    el.className = `flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full border ${styles[color] || styles.amber}`;
    el.innerHTML = `<span class="${dots[color] || dots.amber}"></span><span>${msg}</span>`;
}

function flashBadge(iconClass) {
    const badge = document.getElementById('laptop-sync-badge');
    const icon  = document.getElementById('laptop-sync-icon');
    icon.className = `fa-solid ${iconClass}${iconClass === 'fa-play' ? ' ml-1' : ''}`;
    badge.style.opacity   = '1';
    badge.style.transform = 'scale(1)';
    setTimeout(() => {
        badge.style.opacity   = '0';
        badge.style.transform = 'scale(1.25)';
    }, 500);
}

function sendToPhone(data) {
    if (conn && conn.open) conn.send(data);
}

// ════════════════════════════════════════════════════════════════
// PHONE MODE
// ════════════════════════════════════════════════════════════════
function startPhoneMode(targetRoom) {
    role   = 'phone';
    roomId = targetRoom;

    showScreen('screen-phone');
    setPhoneStatus('Connecting...', 'amber');

    peer = new Peer();

    peer.on('open', () => {
        const c = peer.connect(`educast-${roomId}`, { reliable: true });

        c.on('open', () => {
            conn = c;
            setPhoneStatus('Connected ✓', 'emerald');
            document.getElementById('phone-conn-detail').innerText = `P2P Connected — Room ${roomId}`;
            document.getElementById('phone-dot').className =
                'w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_6px_#10b981]';
        });

        c.on('data', data => {
            if (data.cmd === 'sync-state') {
                isPlaying = data.isPlaying;
                updatePlayIcon();
            }
        });

        c.on('close', () => {
            setPhoneStatus('Disconnected', 'rose');
            document.getElementById('phone-dot').className =
                'w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse flex-shrink-0';
            conn = null;
        });
    });

    peer.on('error', err => {
        setPhoneStatus('Connection failed — scan QR again', 'rose');
        console.error('[Phone] error:', err);
    });
}

function setPhoneStatus(msg, color) {
    const el     = document.getElementById('phone-conn-status');
    const colors = { emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400' };
    el.className = `text-[10px] font-medium ${colors[color] || colors.amber}`;
    el.innerText = msg;
}

// ── Phone UI actions ─────────────────────────────────────────────
window.sendVideoLink = function () {
    if (!conn || !conn.open) {
        alert('Not connected to laptop yet. Please wait for the connection to establish.');
        return;
    }

    const input  = document.getElementById('phone-link-input');
    const raw    = input.value.trim();
    if (!raw) return;

    const parsed = parseVideoUrl(raw);

    conn.send({
        cmd       : 'load',
        url       : parsed.url,
        videoType : parsed.type,
        embedUrl  : parsed.embedUrl || null,
        isVertical: parsed.isVertical || false
    });

    // Optimistic UI feedback
    isPlaying = true;
    updatePlayIcon();

    // Show a brief confirmation
    const btn = document.querySelector('#phone-link-input + button');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        btn.classList.replace('bg-brand-600', 'bg-emerald-600');
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-play ml-0.5"></i>';
            btn.classList.replace('bg-emerald-600', 'bg-brand-600');
        }, 1500);
    }

    input.value = '';
};

window.togglePlayPause = function () {
    if (!conn || !conn.open) return;
    conn.send({ cmd: 'toggle' });
    // Optimistically flip; laptop confirms via sync-state
    isPlaying = !isPlaying;
    updatePlayIcon();
};

window.sendCommand = function (action, value) {
    if (!conn || !conn.open) return;
    if (action === 'skip') conn.send({ cmd: 'skip', seconds: value });
};

function updatePlayIcon() {
    const icon = document.getElementById('phone-playpause-icon');
    icon.className = isPlaying
        ? 'fa-solid fa-pause text-4xl'
        : 'fa-solid fa-play text-4xl ml-1.5';
}

// ── URL parser ───────────────────────────────────────────────────
function parseVideoUrl(rawUrl) {
    const url = rawUrl.trim();

    // 1. YouTube (watch, shorts, youtu.be)
    const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
        return { url: ytMatch[1], type: 'youtube', isVertical: false };
    }

    // 2. Facebook video / reel
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        const isReel = url.includes('/reel') || url.includes('/share/r') || url.includes('fb.watch');
        const embedUrl = isReel
            // Vertical reel: embed at 360×640
            ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=360&height=640&autoplay=true`
            // Horizontal video: embed at 1280×720
            : `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=1280&height=720&autoplay=true`;
        return { url, type: 'iframe', embedUrl, isVertical: isReel };
    }

    // 3. Instagram reel / post (always vertical)
    const igMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/);
    if (igMatch && igMatch[1]) {
        const embedUrl = `https://www.instagram.com/p/${igMatch[1]}/embed/`;
        return { url, type: 'iframe', embedUrl, isVertical: true };
    }

    // 4. Direct video URL (MP4 / WebM)
    return { url, type: 'direct', isVertical: false };
}

// ── Utilities ────────────────────────────────────────────────────
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function showScreen(id) {
    ['screen-home', 'screen-laptop', 'screen-phone'].forEach(s => {
        const el = document.getElementById(s);
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    const target = document.getElementById(id);
    target.classList.remove('hidden');
    // Laptop uses position:fixed so just needs display:block
    target.style.display = id === 'screen-laptop' ? 'block' : 'flex';
    target.style.flexDirection = 'column';
}