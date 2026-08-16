/**
 * EduCast Sync — Two-Screen Synchronized Video Player
 *
 * LAPTOP/TV : Opens → shows QR code → plays video full-screen.
 * PHONE     : Scans QR → paste link + play/pause remote control.
 *
 * YouTube  → iframe + postMessage (most reliable fullscreen approach)
 * Facebook → iframe embed (autoplay blocked by browser; click needed on laptop)
 * Instagram→ iframe embed (same as Facebook)
 * MP4/Direct → HTML5 <video> element
 */

// ── State ────────────────────────────────────────────────────────
let peer        = null;
let conn        = null;
let roomId      = null;
let role        = null;   // 'laptop' | 'phone'

let currentType = 'direct'; // 'direct' | 'youtube' | 'iframe'
let isPlaying   = false;
let ytIframe    = null;    // the YouTube iframe element

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
    peer.on('connection', c   => setupLaptopConn(c));
    peer.on('error',      err => console.error('[Laptop] error:', err));
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

    switch (data.cmd) {

        case 'load':
            loadOnLaptop(data.url, data.videoType, data.embedUrl, data.isVertical);
            break;

        case 'toggle':
            if (currentType === 'direct') {
                const v = document.getElementById('laptop-video');
                if (v.paused) { v.play(); isPlaying = true;  flashBadge('fa-play');  }
                else          { v.pause(); isPlaying = false; flashBadge('fa-pause'); }
            } else if (currentType === 'youtube') {
                if (isPlaying) { ytCmd('pauseVideo'); isPlaying = false; flashBadge('fa-pause'); }
                else           { ytCmd('playVideo');  isPlaying = true;  flashBadge('fa-play');  }
            } else {
                // iframe (FB/IG) — can't control cross-origin; just flash
                flashBadge(isPlaying ? 'fa-pause' : 'fa-play');
            }
            sendToPhone({ cmd: 'sync-state', isPlaying });
            break;

        case 'play':
            if (currentType === 'direct') document.getElementById('laptop-video').play();
            else if (currentType === 'youtube') ytCmd('playVideo');
            isPlaying = true;
            flashBadge('fa-play');
            break;

        case 'pause':
            if (currentType === 'direct') document.getElementById('laptop-video').pause();
            else if (currentType === 'youtube') ytCmd('pauseVideo');
            isPlaying = false;
            flashBadge('fa-pause');
            break;

        case 'skip':
            if (currentType === 'direct') {
                const v = document.getElementById('laptop-video');
                v.currentTime = Math.max(0, v.currentTime + data.seconds);
            } else if (currentType === 'youtube') {
                // YouTube postMessage seek — requires getCurrentTime first
                // We use a relative seek via seekBy (unsupported) so approximate:
                // store currentTime via onStateChange listener
                ytCmdSeekRelative(data.seconds);
            }
            break;
    }
}

// ── Load video on laptop ─────────────────────────────────────────
function loadOnLaptop(url, type, embedUrl, isVertical) {
    currentType = type;

    // Hide QR overlay
    document.getElementById('qr-overlay').classList.add('hidden');
    setLaptopStatus('📱 Phone Connected — Playing', 'emerald');

    // Hide all player layers
    const video      = document.getElementById('laptop-video');
    const ytWrapper  = document.getElementById('laptop-yt-wrapper');
    const ifrWrap    = document.getElementById('laptop-iframe-wrapper');

    video.classList.add('hidden');
    video.pause();
    video.src = '';

    ytWrapper.classList.add('hidden');
    ytWrapper.style.display = 'none';
    ytWrapper.innerHTML = ''; // remove old iframe
    ytIframe = null;

    ifrWrap.classList.add('hidden');
    ifrWrap.style.display = 'none';
    document.getElementById('laptop-iframe').src = 'about:blank';

    // ── Direct video (MP4 / WebM) ────────────────────────────────
    if (type === 'direct') {
        video.classList.remove('hidden');
        video.src   = url;
        video.muted = true;
        video.play().then(() => {
            video.muted  = false;
            isPlaying = true;
        }).catch(() => {
            video.muted = false;
        });
    }

    // ── YouTube ─────────────────────────────────────────────────
    else if (type === 'youtube') {
        ytWrapper.classList.remove('hidden');
        ytWrapper.style.display = 'block';

        // Create a fresh iframe using direct embed URL with enablejsapi=1
        ytIframe = document.createElement('iframe');
        ytIframe.src = `https://www.youtube.com/embed/${url}?enablejsapi=1&autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
        ytIframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;';
        ytIframe.allow        = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
        ytIframe.allowFullscreen = true;
        ytWrapper.appendChild(ytIframe);

        // Unmute after 2.5 s (gives time for YouTube to start playing)
        setTimeout(() => {
            ytCmd('unMute');
            ytCmd('setVolume', [100]);
        }, 2500);

        isPlaying = true;
    }

    // ── Facebook / Instagram iframe ──────────────────────────────
    else if (type === 'iframe') {
        ifrWrap.style.display = 'flex';
        ifrWrap.classList.remove('hidden');

        // Vertical (reels) vs horizontal
        ifrWrap.classList.remove('vertical', 'horizontal');
        ifrWrap.classList.add(isVertical ? 'vertical' : 'horizontal');

        const iframe = document.getElementById('laptop-iframe');
        iframe.src   = embedUrl;

        // Show click-to-play notice (browsers block cross-origin autoplay)
        const notice = document.getElementById('fb-click-notice');
        notice.classList.remove('hidden');
        // Hide notice after user interacts (clicks the iframe area)
        const hideNotice = () => {
            notice.classList.add('hidden');
            ifrWrap.removeEventListener('click', hideNotice);
        };
        setTimeout(() => ifrWrap.addEventListener('click', hideNotice), 500);

        isPlaying = true;
    }
}

// ── YouTube postMessage control ──────────────────────────────────
function ytCmd(funcName, args) {
    if (!ytIframe || !ytIframe.contentWindow) return;
    ytIframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: funcName, args: args || '' }),
        '*'
    );
}

let _ytCurrentTime = 0;

// Listen for YouTube state messages to track current time
window.addEventListener('message', (e) => {
    if (!e.data) return;
    try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d.event === 'infoDelivery' && d.info && d.info.currentTime != null) {
            _ytCurrentTime = d.info.currentTime;
        }
    } catch (_) {}
});

function ytCmdSeekRelative(seconds) {
    // YouTube postMessage doesn't expose seekTo without subscribing to events.
    // We send a seekTo based on last known time + offset.
    ytCmd('seekTo', [Math.max(0, _ytCurrentTime + seconds), true]);
}

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
    el.className = `flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full border ${styles[color]}`;
    el.innerHTML = `<span class="${dots[color]}"></span><span>${msg}</span>`;
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
    el.className = `text-[10px] font-medium ${colors[color]}`;
    el.innerText = msg;
}

// ── Phone actions ────────────────────────────────────────────────
window.sendVideoLink = function () {
    if (!conn || !conn.open) {
        alert('Still connecting to laptop. Please wait a moment and try again.');
        return;
    }
    const input  = document.getElementById('phone-link-input');
    const raw    = input.value.trim();
    if (!raw) return;

    const parsed = parseVideoUrl(raw);
    conn.send({ cmd: 'load', url: parsed.url, videoType: parsed.type, embedUrl: parsed.embedUrl, isVertical: parsed.isVertical });

    // Show platform-specific note for FB/IG
    if (parsed.type === 'iframe') {
        showPhoneFbNotice();
    }

    isPlaying = true;
    updatePlayIcon();

    // Button tick feedback
    const btn = document.querySelector('button[onclick="sendVideoLink()"]');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        btn.style.background = '#059669';
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-play ml-0.5"></i>';
            btn.style.background = '';
        }, 1800);
    }
    input.value = '';
};

window.togglePlayPause = function () {
    if (!conn || !conn.open) return;
    conn.send({ cmd: 'toggle' });
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

function showPhoneFbNotice() {
    // Show a temporary notice about FB/IG needing click on laptop
    const detail = document.getElementById('phone-conn-detail');
    const prev   = detail.innerText;
    detail.innerText = '⚠️ Facebook/IG videos need a tap on the laptop to start';
    detail.style.color = '#fbbf24';
    setTimeout(() => {
        detail.innerText   = prev;
        detail.style.color = '';
    }, 5000);
}

// ── URL parser ───────────────────────────────────────────────────
function parseVideoUrl(rawUrl) {
    const url = rawUrl.trim();

    // 1. YouTube
    const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
        return { url: ytMatch[1], type: 'youtube', isVertical: false };
    }

    // 2. Facebook video / reel
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        const isReel = url.includes('/reel') || url.includes('/share/r') || url.includes('fb.watch');
        const w = isReel ? 360 : 1280;
        const h = isReel ? 640 : 720;
        const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=${w}&height=${h}&autoplay=true`;
        return { url, type: 'iframe', embedUrl, isVertical: isReel };
    }

    // 3. Instagram reel / post (always vertical)
    const igMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/);
    if (igMatch && igMatch[1]) {
        const embedUrl = `https://www.instagram.com/p/${igMatch[1]}/embed/`;
        return { url, type: 'iframe', embedUrl, isVertical: true };
    }

    // 4. Direct video (MP4 / WebM / etc.)
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
        el.style.display = 'none';
    });
    const target = document.getElementById(id);
    target.style.display = id === 'screen-laptop' ? 'block' : 'flex';
    if (id === 'screen-phone') {
        target.style.flexDirection = 'column';
        target.style.minHeight = '100vh';
    }
}