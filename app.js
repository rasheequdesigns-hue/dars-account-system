/**
 * EduCast Sync — Two-Screen Synchronized Video Player
 *
 * LAPTOP/TV : Opens → shows QR code → plays video full-screen.
 * PHONE     : Scans QR → tap Play (clipboard auto-read) → controls laptop.
 *             Video plays behind auto-hiding controls overlay.
 *
 * YouTube  → YT.Player API  (muted autoplay → unmute on onReady)
 * Facebook → iframe embed   (transparent overlay simulates user gesture)
 * Instagram→ iframe embed
 * MP4/Direct → HTML5 <video>
 */

// ── State ────────────────────────────────────────────────────────
let peer        = null;
let conn        = null;
let roomId      = null;
let role        = null;       // 'laptop' | 'phone'

let currentType = 'direct';  // 'direct' | 'youtube' | 'iframe'
let isPlaying   = false;
let hasVideo    = false;      // true once a video has been loaded on phone

// YouTube IFrame API
let ytPlayer    = null;
let ytReady     = false;

// Facebook iframe
let fbIframe    = null;
let fbAutoplayTriggered = false;

// Phone controls hide timer
let controlsHideTimer = null;

// ── Load YouTube IFrame API eagerly ──────────────────────────────
(function loadYTApi() {
    if (document.getElementById('yt-api-script')) return;
    const tag = document.createElement('script');
    tag.id  = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
})();

window.onYouTubeIframeAPIReady = function () {
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

    peer = new Peer(`educast-${roomId}`);
    peer.on('open',       ()  => console.log('[Laptop] ready, room:', roomId));
    peer.on('connection', c  => setupLaptopConn(c));
    peer.on('error',      err => console.error('[Laptop] error:', err));
};

function setupLaptopConn(c) {
    conn = c;
    setLaptopStatus('📱 Phone Connected — waiting for link', 'emerald');
    conn.on('data',  data => handleCmdOnLaptop(data));
    conn.on('close', ()   => {
        setLaptopStatus('Phone disconnected — scan QR to reconnect', 'amber');
        conn = null;
    });
}

// ── Handle commands from phone ───────────────────────────────────
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
                if (ytPlayer && ytReady) {
                    if (isPlaying) { ytPlayer.pauseVideo(); isPlaying = false; flashBadge('fa-pause'); }
                    else           { ytPlayer.playVideo();  isPlaying = true;  flashBadge('fa-play');  }
                }
            } else if (currentType === 'iframe') {
                fbTogglePlayPause();
            }
            sendToPhone({ cmd: 'sync-state', isPlaying });
            break;

        case 'play':
            if (currentType === 'direct')        document.getElementById('laptop-video').play();
            else if (currentType === 'youtube')  { if (ytPlayer && ytReady) ytPlayer.playVideo(); }
            else if (currentType === 'iframe')   fbPostMessage('playVideo');
            isPlaying = true;
            flashBadge('fa-play');
            sendToPhone({ cmd: 'sync-state', isPlaying: true });
            break;

        case 'pause':
            if (currentType === 'direct')        document.getElementById('laptop-video').pause();
            else if (currentType === 'youtube')  { if (ytPlayer && ytReady) ytPlayer.pauseVideo(); }
            else if (currentType === 'iframe')   fbPostMessage('pauseVideo');
            isPlaying = false;
            flashBadge('fa-pause');
            sendToPhone({ cmd: 'sync-state', isPlaying: false });
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
            break;
    }
}

// ── Load video on laptop ─────────────────────────────────────────
function loadOnLaptop(url, type, embedUrl, isVertical) {
    currentType          = type;
    ytReady              = false;
    fbAutoplayTriggered  = false;

    document.getElementById('qr-overlay').classList.add('hidden');
    setLaptopStatus('📱 Phone Connected — Playing', 'emerald');

    const video     = document.getElementById('laptop-video');
    const ytWrapper = document.getElementById('laptop-yt-wrapper');
    const ifrWrap   = document.getElementById('laptop-iframe-wrapper');

    // ── Tear down all players ────────────────────────────────────
    video.style.display = 'none';
    video.pause();
    video.src = '';

    if (ytPlayer) { try { ytPlayer.destroy(); } catch (_) {} ytPlayer = null; }
    ytWrapper.style.display  = 'none';
    ytWrapper.innerHTML      = '';

    ifrWrap.style.display    = 'none';
    fbIframe                 = null;
    const oldIfr = document.getElementById('laptop-iframe');
    if (oldIfr) oldIfr.src = 'about:blank';
    const fbOverlay = document.getElementById('fb-autoplay-overlay');
    if (fbOverlay) fbOverlay.style.display = 'none';

    // ── Direct video ─────────────────────────────────────────────
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

    // ── YouTube — YT.Player API ──────────────────────────────────
    else if (type === 'youtube') {
        ytWrapper.style.display = 'block';

        const placeholder = document.createElement('div');
        placeholder.id    = 'yt-player-mount';
        ytWrapper.appendChild(placeholder);

        function createYTPlayer() {
            ytPlayer = new YT.Player('yt-player-mount', {
                videoId   : url,
                width     : '100%',
                height    : '100%',
                playerVars: {
                    autoplay       : 1,
                    mute           : 1,   // muted start satisfies browser autoplay policy
                    rel            : 0,
                    modestbranding : 1,
                    playsinline    : 1,
                    enablejsapi    : 1,
                    origin         : location.origin,
                    // NOTE: controls & fs left at default (1) — disabling them
                    // causes YouTube to block embedding on many videos
                },
                events: {
                    onReady: function (e) {
                        ytReady = true;
                        e.target.playVideo();
                        // Unmute once playing starts — guaranteed user gesture satisfied by phone tap
                        setTimeout(() => {
                            e.target.unMute();
                            e.target.setVolume(100);
                            isPlaying = true;
                            sendToPhone({ cmd: 'sync-state', isPlaying: true });
                        }, 800);
                    },
                    onStateChange: function (e) {
                        if (e.data === YT.PlayerState.PLAYING) {
                            isPlaying = true;
                            sendToPhone({ cmd: 'sync-state', isPlaying: true });
                        } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                            isPlaying = false;
                            sendToPhone({ cmd: 'sync-state', isPlaying: false });
                        }
                    },
                    onError: function (e) {
                        console.error('[YT] error code:', e.data);
                        setLaptopStatus('⚠️ YouTube video unavailable (embedding disabled by owner)', 'amber');
                    }
                }
            });
        }

        if (typeof YT !== 'undefined' && YT.Player) {
            createYTPlayer();
        } else {
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
        ifrWrap.classList.remove('vertical', 'horizontal');
        ifrWrap.classList.add(isVertical ? 'vertical' : 'horizontal');

        // Rebuild iframe fresh
        const oldIframe = document.getElementById('laptop-iframe');
        if (oldIframe) oldIframe.remove();

        const ifr = document.createElement('iframe');
        ifr.id    = 'laptop-iframe';
        ifr.className = 'border-0';
        ifr.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
        ifr.allowFullscreen = true;
        ifr.src = embedUrl;
        // Insert before the overlay divs
        ifrWrap.insertBefore(ifr, ifrWrap.firstChild);
        fbIframe = ifr;

        isPlaying = true;

        // ── Autoplay strategy ────────────────────────────────────
        // Browsers require a user gesture to play cross-origin iframes.
        // We show a transparent overlay on TOP of the iframe and
        // programmatically click it immediately. Since the laptop page
        // was opened by a real user (who tapped Send on the phone), this
        // satisfies the gesture requirement in most Chromium browsers.
        // If it still doesn't work, we show the fallback notice.
        const overlay  = document.getElementById('fb-autoplay-overlay');
        const notice   = document.getElementById('fb-click-notice');
        notice.classList.add('hidden');

        overlay.style.display = 'block';
        overlay.onclick = () => {
            overlay.style.display = 'none';
            notice.classList.add('hidden');
        };

        // Try programmatic click after iframe loads
        ifr.addEventListener('load', () => {
            if (!fbAutoplayTriggered) {
                fbAutoplayTriggered = true;
                // Small delay so iframe fully renders before we attempt play
                setTimeout(() => {
                    overlay.click();   // simulates the user gesture click
                    // Also send postMessage play command
                    fbPostMessage('playVideo');
                }, 600);
            }
        });

        // Fallback: if after 3.5s no 'startedPlaying' message received, show notice
        setTimeout(() => {
            if (!fbAutoplayTriggered || !isPlaying) return;
            // Check if FB sent us a playing event — if fbOverlayDismissed is still true
            // and overlay is still visible, show notice
            if (overlay.style.display !== 'none') {
                overlay.style.display = 'none';
            }
            // Show notice only if message listener hasn't confirmed play
            if (document.getElementById('fb-autoplay-overlay').style.display === 'none') return;
            notice.classList.remove('hidden');
            setTimeout(() => notice.classList.add('hidden'), 4000);
        }, 3500);
    }
}

// ── Facebook postMessage control ─────────────────────────────────
function fbPostMessage(method) {
    if (!fbIframe || !fbIframe.contentWindow) return;
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

// Listen for Facebook iframe state messages
window.addEventListener('message', (e) => {
    if (!e.data) return;
    try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d.type === 'video') {
            if (d.event === 'startedPlaying') {
                isPlaying = true;
                // Dismiss overlay once we know it's playing
                const ov = document.getElementById('fb-autoplay-overlay');
                if (ov) ov.style.display = 'none';
                const notice = document.getElementById('fb-click-notice');
                if (notice) notice.classList.add('hidden');
                sendToPhone({ cmd: 'sync-state', isPlaying: true });
            } else if (d.event === 'paused' || d.event === 'finishedPlaying') {
                isPlaying = false;
                sendToPhone({ cmd: 'sync-state', isPlaying: false });
            }
        }
    } catch (_) {}
});

// ── UI helpers (laptop) ──────────────────────────────────────────
function setLaptopStatus(msg, color) {
    const el = document.getElementById('laptop-conn-status');
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

    peer = new Peer();

    peer.on('open', () => {
        const c = peer.connect(`educast-${roomId}`, { reliable: true });

        c.on('open', () => {
            conn = c;
            setPhoneStatusPill('Connected ✓', '#34d399', '#10b981');
            document.getElementById('phone-conn-detail').innerText = `Room ${roomId} · P2P Connected`;
            document.getElementById('phone-dot').style.cssText =
                'width:8px;height:8px;border-radius:50%;background:#34d399;flex-shrink:0;box-shadow:0 0 6px #10b981;animation:none;';
            document.getElementById('phone-hint').innerText = 'Copy a video link, then tap Play';
        });

        c.on('data', data => {
            if (data.cmd === 'sync-state') {
                isPlaying = data.isPlaying;
                updatePhonePlayIcon();
                scheduleHideControls();
            }
        });

        c.on('close', () => {
            setPhoneStatusPill('Disconnected', '#f87171', '#ef4444');
            conn = null;
        });
    });

    peer.on('error', err => {
        setPhoneStatusPill('Connection failed', '#f87171', '#ef4444');
        console.error('[Phone] error:', err);
    });

    // Wake controls on any tap
    document.getElementById('phone-tap-catcher').addEventListener('click', wakeControls);
}

function setPhoneStatusPill(text, color, glow) {
    const dot    = document.getElementById('phone-dot');
    const status = document.getElementById('phone-conn-status');
    dot.style.cssText    = `width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 6px ${glow};animation:none;`;
    status.style.color   = color;
    status.innerText     = text;
}

// ── Phone play/pause tap — reads clipboard, loads or toggles ─────
window.handlePlayPauseTap = function () {
    if (!conn || !conn.open) {
        // Not connected yet — pulse the button to show feedback
        const btn = document.getElementById('phone-playpause-btn');
        btn.style.background = 'rgba(239,68,68,0.8)';
        setTimeout(() => { btn.style.background = 'rgba(14,165,233,0.9)'; }, 600);
        return;
    }

    wakeControls();  // always reset hide timer on any tap

    if (!hasVideo) {
        // ── First tap: read clipboard and load video ─────────────
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText()
                .then(text => {
                    const url = text.trim();
                    if (!url || !isValidVideoUrl(url)) {
                        setPhoneHint('⚠️ No valid video link in clipboard. Copy a link first.');
                        setTimeout(() => setPhoneHint('Copy a video link, then tap Play'), 3000);
                        return;
                    }
                    loadVideoFromUrl(url);
                })
                .catch(() => {
                    // Clipboard API denied — show input fallback
                    showClipboardFallback();
                });
        } else {
            showClipboardFallback();
        }
    } else {
        // ── Video already loaded: toggle play/pause ──────────────
        conn.send({ cmd: 'toggle' });
        isPlaying = !isPlaying;
        updatePhonePlayIcon();
    }
};

function loadVideoFromUrl(url) {
    const parsed = parseVideoUrl(url);
    conn.send({
        cmd       : 'load',
        url       : parsed.url,
        videoType : parsed.type,
        embedUrl  : parsed.embedUrl,
        isVertical: parsed.isVertical
    });

    hasVideo  = true;
    isPlaying = true;
    updatePhonePlayIcon();

    // Show now-playing info
    const nowPlaying = document.getElementById('phone-now-playing');
    const icon       = document.getElementById('phone-platform-icon');
    const urlEl      = document.getElementById('phone-video-url');
    nowPlaying.style.display = 'block';
    urlEl.innerText = url.length > 50 ? url.substring(0, 47) + '…' : url;

    if (parsed.type === 'youtube') {
        icon.className  = 'fa-brands fa-youtube';
        icon.style.color = '#f87171';
    } else if (url.includes('facebook')) {
        icon.className  = 'fa-brands fa-facebook';
        icon.style.color = '#60a5fa';
    } else if (url.includes('instagram')) {
        icon.className  = 'fa-brands fa-instagram';
        icon.style.color = '#f472b6';
    } else {
        icon.className  = 'fa-solid fa-film';
        icon.style.color = '#a78bfa';
    }

    // Show skip buttons
    document.getElementById('phone-skip-row').style.display = 'flex';

    setPhoneHint('Tap to play / pause');
    scheduleHideControls();
}

function showClipboardFallback() {
    // Inject a quick inline input as a popup
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:12px;';
    overlay.innerHTML = `
        <p style="color:#e2e8f0;font-size:14px;font-weight:700;text-align:center;">Paste video link</p>
        <input id="fallback-input" type="url" placeholder="https://..." autocomplete="off"
            style="width:100%;max-width:340px;background:#1e293b;border:1px solid #475569;color:#fff;font-size:14px;padding:12px 14px;border-radius:12px;outline:none;">
        <div style="display:flex;gap:10px;width:100%;max-width:340px;">
            <button id="fallback-cancel" style="flex:1;padding:11px;border-radius:12px;background:#334155;color:#94a3b8;font-size:13px;font-weight:700;border:none;cursor:pointer;">Cancel</button>
            <button id="fallback-go" style="flex:2;padding:11px;border-radius:12px;background:#0ea5e9;color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer;">Play</button>
        </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('fallback-input').focus(), 100);

    document.getElementById('fallback-cancel').onclick = () => overlay.remove();
    document.getElementById('fallback-go').onclick = () => {
        const url = document.getElementById('fallback-input').value.trim();
        overlay.remove();
        if (url) loadVideoFromUrl(url);
    };
    document.getElementById('fallback-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('fallback-go').click();
    });
}

function isValidVideoUrl(str) {
    try {
        const u = new URL(str);
        // Accept http/https only
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// ── Controls auto-hide ───────────────────────────────────────────
function scheduleHideControls() {
    clearTimeout(controlsHideTimer);
    const overlay = document.getElementById('phone-controls-overlay');
    overlay.style.opacity    = '1';
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.pointerEvents = 'auto';

    if (hasVideo && isPlaying) {
        controlsHideTimer = setTimeout(() => {
            overlay.style.opacity    = '0';
            overlay.style.pointerEvents = 'none';
        }, 3000);  // hide after 3 seconds
    }
}

window.wakeControls = function () {
    const overlay = document.getElementById('phone-controls-overlay');
    overlay.style.opacity       = '1';
    overlay.style.pointerEvents = 'auto';
    scheduleHideControls();  // reset the timer
};

function setPhoneHint(text) {
    document.getElementById('phone-hint').innerText = text;
}

window.togglePlayPause = function () {
    if (!conn || !conn.open) return;
    conn.send({ cmd: 'toggle' });
    isPlaying = !isPlaying;
    updatePhonePlayIcon();
};

window.sendCommand = function (action, value) {
    if (!conn || !conn.open) return;
    if (action === 'skip') conn.send({ cmd: 'skip', seconds: value });
    wakeControls();
};

function updatePhonePlayIcon() {
    const icon = document.getElementById('phone-playpause-icon');
    const btn  = document.getElementById('phone-playpause-btn');
    if (isPlaying) {
        icon.className     = 'fa-solid fa-pause';
        icon.style.cssText = 'font-size:40px;color:#fff;margin-left:0;';
        btn.style.background = 'rgba(14,165,233,0.9)';
    } else {
        icon.className     = 'fa-solid fa-play';
        icon.style.cssText = 'font-size:40px;color:#fff;margin-left:6px;';
        btn.style.background = 'rgba(100,116,139,0.85)';
    }
}

// ── URL parser ───────────────────────────────────────────────────
function parseVideoUrl(rawUrl) {
    const url = rawUrl.trim();

    // 1. YouTube
    const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
        return { url: ytMatch[1], type: 'youtube', embedUrl: null, isVertical: false };
    }

    // 2. Facebook
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        const isReel   = url.includes('/reel') || url.includes('/share/r') || url.includes('fb.watch');
        const w        = isReel ? 360 : 1280;
        const h        = isReel ? 640 : 720;
        const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=${w}&height=${h}&autoplay=true&allowfullscreen=true`;
        return { url, type: 'iframe', embedUrl, isVertical: isReel };
    }

    // 3. Instagram
    const igMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/);
    if (igMatch && igMatch[1]) {
        const embedUrl = `https://www.instagram.com/p/${igMatch[1]}/embed/`;
        return { url, type: 'iframe', embedUrl, isVertical: true };
    }

    // 4. Direct video (MP4 / WebM)
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
        document.getElementById(s).style.display = 'none';
    });
    const target = document.getElementById(id);
    if (id === 'screen-laptop') {
        target.style.display = 'block';
    } else if (id === 'screen-phone') {
        target.style.display = 'block';   // phone screen uses position:fixed
    } else {
        target.style.display = 'flex';
    }
}
