/**
 * EduCast Sync — Two-Screen Synchronized Video Player
 *
 * LAPTOP/TV : Opens → shows QR code → plays video full-screen.
 * PHONE     : Scans QR → paste link + play/pause remote control.
 *
 * YouTube  → YouTube IFrame API (YT.Player) — proper JS control
 * Facebook → iframe embed + postMessage play/pause control
 * Instagram→ iframe embed (view only)
 * MP4/Direct → HTML5 <video> element
 */

// ── State ────────────────────────────────────────────────────────
let peer        = null;
let conn        = null;
let roomId      = null;
let role        = null;   // 'laptop' | 'phone'

let currentType = 'direct'; // 'direct' | 'youtube' | 'iframe'
let isPlaying   = false;

// YouTube IFrame API player instance
let ytPlayer    = null;
let ytReady     = false;  // true once onReady fires

// Facebook iframe element (for postMessage control)
let fbIframe    = null;

// ── Load YouTube IFrame API script once ──────────────────────────
// We load it eagerly so it's ready when needed.
(function loadYTApi() {
    if (document.getElementById('yt-api-script')) return;
    const tag = document.createElement('script');
    tag.id  = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
})();

// YouTube IFrame API calls this when the script is ready
window.onYouTubeIframeAPIReady = function () {
    // Nothing to do here globally — player is created per-load in loadOnLaptop
    console.log('[YT] IFrame API ready');
};

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
    peer.on('open',       ()  => console.log('[Laptop] ready, room:', roomId));
    peer.on('connection', c  => setupLaptopConn(c));
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
                if (v.paused) {
                    v.play();
                    isPlaying = true;
                    flashBadge('fa-play');
                } else {
                    v.pause();
                    isPlaying = false;
                    flashBadge('fa-pause');
                }
            } else if (currentType === 'youtube') {
                if (ytPlayer && ytReady) {
                    if (isPlaying) {
                        ytPlayer.pauseVideo();
                        isPlaying = false;
                        flashBadge('fa-pause');
                    } else {
                        ytPlayer.playVideo();
                        isPlaying = true;
                        flashBadge('fa-play');
                    }
                }
            } else if (currentType === 'iframe') {
                // Facebook: send postMessage to the iframe
                fbTogglePlayPause();
            }
            sendToPhone({ cmd: 'sync-state', isPlaying });
            break;

        case 'play':
            if (currentType === 'direct') {
                document.getElementById('laptop-video').play();
            } else if (currentType === 'youtube') {
                if (ytPlayer && ytReady) ytPlayer.playVideo();
            } else if (currentType === 'iframe') {
                fbPostMessage('playVideo');
            }
            isPlaying = true;
            flashBadge('fa-play');
            sendToPhone({ cmd: 'sync-state', isPlaying });
            break;

        case 'pause':
            if (currentType === 'direct') {
                document.getElementById('laptop-video').pause();
            } else if (currentType === 'youtube') {
                if (ytPlayer && ytReady) ytPlayer.pauseVideo();
            } else if (currentType === 'iframe') {
                fbPostMessage('pauseVideo');
            }
            isPlaying = false;
            flashBadge('fa-pause');
            sendToPhone({ cmd: 'sync-state', isPlaying });
            break;

        case 'skip':
            if (currentType === 'direct') {
                const v = document.getElementById('laptop-video');
                v.currentTime = Math.max(0, v.currentTime + data.seconds);
            } else if (currentType === 'youtube') {
                if (ytPlayer && ytReady) {
                    const cur = ytPlayer.getCurrentTime() || 0;
                    ytPlayer.seekTo(Math.max(0, cur + data.seconds), true);
                }
            }
            // Facebook/Instagram iframes don't support seek via postMessage
            break;
    }
}

// ── Load video on laptop ─────────────────────────────────────────
function loadOnLaptop(url, type, embedUrl, isVertical) {
    currentType = type;
    ytReady     = false;

    // Hide QR overlay
    document.getElementById('qr-overlay').classList.add('hidden');
    setLaptopStatus('📱 Phone Connected — Playing', 'emerald');

    // Grab all player layer elements
    const video     = document.getElementById('laptop-video');
    const ytWrapper = document.getElementById('laptop-yt-wrapper');
    const ifrWrap   = document.getElementById('laptop-iframe-wrapper');

    // ── Tear down existing players ───────────────────────────────
    // Direct video
    video.style.display = 'none';
    video.pause();
    video.src = '';

    // YouTube — destroy existing YT.Player instance cleanly
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch (_) {}
        ytPlayer = null;
    }
    ytWrapper.style.display = 'none';
    ytWrapper.innerHTML = '';   // clear the div YT.Player was mounted in

    // Facebook / Instagram
    ifrWrap.style.display   = 'none';
    fbIframe = null;
    const oldFbIframe = document.getElementById('laptop-iframe');
    if (oldFbIframe) oldFbIframe.src = 'about:blank';

    // ── Direct video (MP4 / WebM) ────────────────────────────────
    if (type === 'direct') {
        video.style.display = 'block';
        video.src   = url;
        video.muted = true;
        video.play()
            .then(() => {
                video.muted = false;
                isPlaying   = true;
                sendToPhone({ cmd: 'sync-state', isPlaying: true });
            })
            .catch(err => {
                console.warn('[Direct] autoplay blocked:', err);
                video.muted = false;
            });
    }

    // ── YouTube — use YT.Player API ──────────────────────────────
    else if (type === 'youtube') {
        ytWrapper.style.display = 'block';

        // Create a placeholder div for YT.Player to replace
        const placeholder = document.createElement('div');
        placeholder.id    = 'yt-player-mount';
        ytWrapper.appendChild(placeholder);

        // Wait for YT API to be available (it's loaded in <head>)
        function createYTPlayer() {
            ytPlayer = new YT.Player('yt-player-mount', {
                videoId: url,
                width  : '100%',
                height : '100%',
                playerVars: {
                    autoplay       : 1,
                    mute           : 1,       // start muted to allow autoplay
                    rel            : 0,
                    modestbranding : 1,
                    playsinline    : 1,
                    enablejsapi    : 1,
                    origin         : location.origin,
                    controls       : 0,       // hide YT controls; phone is the remote
                    iv_load_policy : 3,       // hide annotations
                    fs             : 0,       // hide fullscreen button
                },
                events: {
                    onReady: function (e) {
                        ytReady = true;
                        e.target.playVideo();
                        // Unmute after a short delay — autoplay starts muted
                        setTimeout(() => {
                            e.target.unMute();
                            e.target.setVolume(100);
                            isPlaying = true;
                            sendToPhone({ cmd: 'sync-state', isPlaying: true });
                        }, 1000);
                    },
                    onStateChange: function (e) {
                        // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0, BUFFERING=3
                        if (e.data === YT.PlayerState.PLAYING) {
                            isPlaying = true;
                            sendToPhone({ cmd: 'sync-state', isPlaying: true });
                        } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                            isPlaying = false;
                            sendToPhone({ cmd: 'sync-state', isPlaying: false });
                        }
                    },
                    onError: function (e) {
                        console.error('[YT] Player error:', e.data);
                        // Error codes: 2=invalid id, 5=HTML5 issue, 100=not found,
                        // 101/150=embedding disabled by owner
                        setLaptopStatus('⚠️ YouTube video unavailable (embedding may be disabled)', 'amber');
                    }
                }
            });

            // Make the iframe YT.Player creates fill the wrapper
            // YT.Player injects an <iframe>; we style it via CSS selector in style.css
        }

        if (typeof YT !== 'undefined' && YT.Player) {
            createYTPlayer();
        } else {
            // API not yet loaded — queue it
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = function () {
                if (prev) prev();
                createYTPlayer();
            };
        }
    }

    // ── Facebook / Instagram iframe ──────────────────────────────
    else if (type === 'iframe') {
        ifrWrap.style.display = 'flex';

        // Vertical (reels) vs horizontal
        ifrWrap.classList.remove('vertical', 'horizontal');
        ifrWrap.classList.add(isVertical ? 'vertical' : 'horizontal');

        // Rebuild the iframe fresh (avoids stale src / sandbox state)
        const oldIfr = document.getElementById('laptop-iframe');
        if (oldIfr) oldIfr.remove();

        const ifr = document.createElement('iframe');
        ifr.id    = 'laptop-iframe';
        ifr.className = 'border-0';
        ifr.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        ifr.allowFullscreen = true;
        // Facebook requires allow="autoplay" attribute AND src autoplay param
        ifr.src = embedUrl;
        ifrWrap.insertBefore(ifr, ifrWrap.firstChild);
        fbIframe = ifr;

        isPlaying = true;   // optimistically assume it will play

        // Show click-to-play notice (browsers block cross-origin autoplay)
        const notice = document.getElementById('fb-click-notice');
        notice.classList.remove('hidden');
        const hideNotice = () => {
            notice.classList.add('hidden');
            ifrWrap.removeEventListener('click', hideNotice);
        };
        setTimeout(() => ifrWrap.addEventListener('click', hideNotice), 500);
    }
}

// ── Facebook postMessage control ─────────────────────────────────
// Facebook's video iframe accepts postMessage commands.
function fbPostMessage(method) {
    if (!fbIframe || !fbIframe.contentWindow) return;
    // Facebook plugin iframe accepts these postMessage strings
    fbIframe.contentWindow.postMessage(method, '*');
}

function fbTogglePlayPause() {
    if (isPlaying) {
        fbPostMessage('pauseVideo');
        isPlaying = false;
        flashBadge('fa-pause');
    } else {
        fbPostMessage('playVideo');
        isPlaying = true;
        flashBadge('fa-play');
    }
}

// Listen for messages from Facebook iframe (play/pause state changes)
window.addEventListener('message', (e) => {
    if (!e.data) return;
    try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        // Facebook sends: {type:'video', event:'startedPlaying'} or {event:'paused'}
        if (d.type === 'video') {
            if (d.event === 'startedPlaying') {
                isPlaying = true;
                sendToPhone({ cmd: 'sync-state', isPlaying: true });
            } else if (d.event === 'paused' || d.event === 'finishedPlaying') {
                isPlaying = false;
                sendToPhone({ cmd: 'sync-state', isPlaying: false });
            }
        }
    } catch (_) {}
});

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
    const input = document.getElementById('phone-link-input');
    const raw   = input.value.trim();
    if (!raw) return;

    const parsed = parseVideoUrl(raw);
    conn.send({
        cmd       : 'load',
        url       : parsed.url,
        videoType : parsed.type,
        embedUrl  : parsed.embedUrl,
        isVertical: parsed.isVertical
    });

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
    const detail = document.getElementById('phone-conn-detail');
    const prev   = detail.innerText;
    detail.innerText = '⚠️ Facebook/IG videos may need a tap on the laptop screen to start';
    detail.style.color = '#fbbf24';
    setTimeout(() => {
        detail.innerText   = prev;
        detail.style.color = '';
    }, 6000);
}

// ── URL parser ───────────────────────────────────────────────────
function parseVideoUrl(rawUrl) {
    const url = rawUrl.trim();

    // 1. YouTube — extract video ID
    const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
        return { url: ytMatch[1], type: 'youtube', embedUrl: null, isVertical: false };
    }

    // 2. Facebook video / reel
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        const isReel   = url.includes('/reel') || url.includes('/share/r') || url.includes('fb.watch');
        const w        = isReel ? 360 : 1280;
        const h        = isReel ? 640 : 720;
        // autoplay=true and allowfullscreen in the embed URL
        const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=${w}&height=${h}&autoplay=true&allowfullscreen=true`;
        return { url, type: 'iframe', embedUrl, isVertical: isReel };
    }

    // 3. Instagram reel / post (always vertical)
    const igMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/);
    if (igMatch && igMatch[1]) {
        const embedUrl = `https://www.instagram.com/p/${igMatch[1]}/embed/`;
        return { url, type: 'iframe', embedUrl, isVertical: true };
    }

    // 4. Direct video (MP4 / WebM / etc.)
    return { url, type: 'direct', embedUrl: null, isVertical: false };
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
        target.style.minHeight    = '100vh';
    }
}
