/**
 * EduCast Sync — Two-Screen Synchronized Video Player
 *
 * LAPTOP/TV : Opens → shows QR code → plays video full-screen.
 * PHONE     : Scans QR → tap Play (clipboard auto-read) → controls laptop.
 *
 * YouTube  → YT.Player API  (muted autoplay → unmute on onReady, resized to fill)
 * Facebook → iframe embed   (one-time tap prompt on laptop, reload trick for toggle)
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
let hasVideo    = false;

// YouTube
let ytPlayer      = null;
let ytReady       = false;
let ytApiReady    = false;   // true once onYouTubeIframeAPIReady fires
let ytResizeObs   = null;    // ResizeObserver to keep player filling wrapper
let ytPendingLoad = null;    // {videoId} queued while API loads

// Facebook / Instagram
let fbIframe      = null;
let fbEmbedUrl    = '';      // saved so we can reload it to "play"
let fbIsVertical  = false;

// Phone controls hide timer
let controlsHideTimer = null;

// ── Load YouTube IFrame API once ─────────────────────────────────
(function loadYTApi() {
    if (document.getElementById('yt-api-script')) return;
    const tag = document.createElement('script');
    tag.id  = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
})();

// Called by YouTube when their script is ready
window.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    console.log('[YT] IFrame API ready');
    // If a video was requested before the API loaded, create it now
    if (ytPendingLoad) {
        const id = ytPendingLoad;
        ytPendingLoad = null;
        _createYTPlayer(id);
    }
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
    peer.on('error',      err => console.error('[Laptop] peer error:', err));
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
                if (v.paused) { v.play();  isPlaying = true;  flashBadge('fa-play');  }
                else          { v.pause(); isPlaying = false; flashBadge('fa-pause'); }

            } else if (currentType === 'youtube') {
                if (ytPlayer && ytReady) {
                    if (isPlaying) { ytPlayer.pauseVideo(); isPlaying = false; flashBadge('fa-pause'); }
                    else           { ytPlayer.playVideo();  isPlaying = true;  flashBadge('fa-play');  }
                }

            } else if (currentType === 'iframe') {
                fbToggle();
            }
            sendToPhone({ cmd: 'sync-state', isPlaying });
            break;

        case 'skip':
            if (currentType === 'direct') {
                const v = document.getElementById('laptop-video');
                v.currentTime = Math.max(0, v.currentTime + data.seconds);
            } else if (currentType === 'youtube') {
                if (ytPlayer && ytReady) {
                    ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() + data.seconds), true);
                }
            }
            // Facebook/Instagram have no seek API
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

    const video     = document.getElementById('laptop-video');
    const ytWrapper = document.getElementById('laptop-yt-wrapper');
    const ifrWrap   = document.getElementById('laptop-iframe-wrapper');

    // ── Tear down all existing players ───────────────────────────
    video.style.display = 'none';
    video.pause();
    video.src = '';

    // Destroy YT player and stop ResizeObserver
    if (ytResizeObs) { ytResizeObs.disconnect(); ytResizeObs = null; }
    if (ytPlayer)    { try { ytPlayer.destroy(); } catch (_) {} ytPlayer = null; }
    ytWrapper.style.display = 'none';
    ytWrapper.innerHTML     = '';

    // Reset FB iframe
    ifrWrap.style.display = 'none';
    fbIframe              = null;
    fbEmbedUrl            = '';
    const oldIfr = document.getElementById('laptop-iframe');
    if (oldIfr) { oldIfr.src = 'about:blank'; oldIfr.remove(); }
    _hideFbPrompt();

    // ── Direct video (MP4 / WebM) ─────────────────────────────────
    if (type === 'direct') {
        video.style.display = 'block';
        video.src           = url;
        video.muted         = true;
        video.play()
            .then(() => { video.muted = false; isPlaying = true; sendToPhone({ cmd: 'sync-state', isPlaying: true }); })
            .catch(err => { console.warn('[Direct] autoplay blocked:', err); video.muted = false; });
    }

    // ── YouTube ───────────────────────────────────────────────────
    else if (type === 'youtube') {
        ytWrapper.style.display = 'block';

        if (ytApiReady) {
            _createYTPlayer(url);
        } else {
            // Queue it — onYouTubeIframeAPIReady will create it
            ytPendingLoad = url;
        }
    }

    // ── Facebook / Instagram ──────────────────────────────────────
    else if (type === 'iframe') {
        fbEmbedUrl   = embedUrl;
        fbIsVertical = isVertical;
        _loadFbIframe(embedUrl, isVertical, true /* showPrompt */);
    }
}

// ── YouTube: create YT.Player and make it fill its wrapper ───────
function _createYTPlayer(videoId) {
    const wrapper = document.getElementById('laptop-yt-wrapper');

    // Create mount point
    const mount  = document.createElement('div');
    mount.id     = 'yt-player-mount';
    // Give it explicit pixel size matching the wrapper right now
    mount.style.cssText = `position:absolute;top:0;left:0;width:${wrapper.offsetWidth}px;height:${wrapper.offsetHeight}px;`;
    wrapper.appendChild(mount);

    ytPlayer = new YT.Player('yt-player-mount', {
        videoId   : videoId,
        // Pixel dimensions so YouTube doesn't default to 640×390
        width     : wrapper.offsetWidth  || window.innerWidth,
        height    : wrapper.offsetHeight || window.innerHeight,
        playerVars: {
            autoplay       : 1,
            mute           : 1,      // must start muted for autoplay policy
            rel            : 0,
            modestbranding : 1,
            playsinline    : 1,
            enablejsapi    : 1,
            origin         : location.origin,
        },
        events: {
            onReady: function (e) {
                ytReady = true;

                // Force the injected <iframe> to fill the wrapper
                const iframe = wrapper.querySelector('iframe');
                if (iframe) {
                    iframe.style.cssText = 'position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;border:0!important;';
                }

                // Watch for window resize and keep player sized correctly
                ytResizeObs = new ResizeObserver(() => {
                    if (ytPlayer && ytReady) {
                        ytPlayer.setSize(wrapper.offsetWidth, wrapper.offsetHeight);
                        const ifr = wrapper.querySelector('iframe');
                        if (ifr) {
                            ifr.style.width  = '100%';
                            ifr.style.height = '100%';
                        }
                    }
                });
                ytResizeObs.observe(wrapper);

                e.target.playVideo();
                // Unmute shortly after — autoplay + mute is reliable, unmute after start
                setTimeout(() => {
                    e.target.unMute();
                    e.target.setVolume(100);
                    isPlaying = true;
                    sendToPhone({ cmd: 'sync-state', isPlaying: true });
                }, 1000);
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
                // Error 101 / 150 = embedding disabled by video owner
                const msg = (e.data === 101 || e.data === 150)
                    ? '⚠️ This video cannot be embedded (owner disabled it)'
                    : `⚠️ YouTube error (code ${e.data})`;
                setLaptopStatus(msg, 'amber');
                console.error('[YT] player error:', e.data);
            }
        }
    });
}

// ── Facebook / Instagram: load iframe + optional tap prompt ──────
function _loadFbIframe(embedUrl, isVertical, showPrompt) {
    const ifrWrap = document.getElementById('laptop-iframe-wrapper');
    ifrWrap.style.display = 'flex';
    ifrWrap.classList.remove('vertical', 'horizontal');
    ifrWrap.classList.add(isVertical ? 'vertical' : 'horizontal');

    // Build fresh iframe
    const ifr = document.createElement('iframe');
    ifr.id    = 'laptop-iframe';
    ifr.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    ifr.allowFullscreen = true;
    ifr.style.border    = 'none';
    ifr.src             = embedUrl;
    ifrWrap.insertBefore(ifr, ifrWrap.firstChild);
    fbIframe  = ifr;
    isPlaying = true;

    if (showPrompt) {
        _showFbPrompt();
    }
}

// Show the one-time "tap to play" full-screen prompt on the laptop
function _showFbPrompt() {
    const prompt = document.getElementById('fb-tap-prompt');
    prompt.style.display = 'flex';
    // One click anywhere dismisses it and lets the iframe autoplay
    const dismiss = () => {
        prompt.style.display = 'none';
        prompt.removeEventListener('click', dismiss);
    };
    prompt.addEventListener('click', dismiss);
}

function _hideFbPrompt() {
    const prompt = document.getElementById('fb-tap-prompt');
    if (prompt) prompt.style.display = 'none';
}

// Toggle Facebook: reload iframe with autoplay=true (play) or blank src (pause)
function fbToggle() {
    if (!fbIframe) return;
    if (isPlaying) {
        // Pause: blank out the src (stops playback immediately)
        fbIframe.src = 'about:blank';
        isPlaying    = false;
        flashBadge('fa-pause');
    } else {
        // Play: reload the embed URL (autoplay=true in the URL)
        fbIframe.src = fbEmbedUrl;
        isPlaying    = true;
        flashBadge('fa-play');
        // Show prompt again so user can tap to satisfy browser gesture for reload
        _showFbPrompt();
    }
}

// ── UI helpers — laptop ──────────────────────────────────────────
function setLaptopStatus(msg, color) {
    const el = document.getElementById('laptop-conn-status');
    const border = { emerald: 'border-emerald-500/20', amber: 'border-amber-500/20', rose: 'border-rose-500/20' };
    const text   = { emerald: 'text-emerald-400 bg-emerald-500/10', amber: 'text-amber-400 bg-amber-500/10', rose: 'text-rose-400 bg-rose-500/10' };
    const dot    = { emerald: 'w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]', amber: 'w-2 h-2 rounded-full bg-amber-400 animate-pulse', rose: 'w-2 h-2 rounded-full bg-rose-400 animate-pulse' };
    el.className = `flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full border ${text[color]} ${border[color]}`;
    el.innerHTML = `<span class="${dot[color]}"></span><span>${msg}</span>`;
}

function flashBadge(iconClass) {
    const badge = document.getElementById('laptop-sync-badge');
    const icon  = document.getElementById('laptop-sync-icon');
    icon.className = `fa-solid ${iconClass}${iconClass === 'fa-play' ? ' ml-1' : ''}`;
    badge.style.opacity   = '1';
    badge.style.transform = 'scale(1)';
    setTimeout(() => { badge.style.opacity = '0'; badge.style.transform = 'scale(1.25)'; }, 600);
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
            setPhonePill('Connected ✓', '#34d399', '#10b981');
            document.getElementById('phone-conn-detail').innerText = `Room ${roomId} · P2P Connected`;
            document.getElementById('phone-dot').style.cssText =
                'width:8px;height:8px;border-radius:50%;background:#34d399;flex-shrink:0;box-shadow:0 0 6px #10b981;';
            document.getElementById('phone-hint').innerText = 'Copy a video link, then tap ▶';
        });

        c.on('data', data => {
            if (data.cmd === 'sync-state') {
                isPlaying = data.isPlaying;
                updatePhonePlayIcon();
                scheduleHideControls();
            }
        });

        c.on('close', () => { setPhonePill('Disconnected', '#f87171', '#ef4444'); conn = null; });
    });

    peer.on('error', err => { setPhonePill('Connection failed', '#f87171', '#ef4444'); console.error('[Phone]', err); });

    // Any tap on the background wakes controls
    document.getElementById('phone-tap-catcher').addEventListener('click', wakeControls);
}

function setPhonePill(text, color, glow) {
    const dot = document.getElementById('phone-dot');
    const lbl = document.getElementById('phone-conn-status');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 6px ${glow};`;
    lbl.style.color   = color;
    lbl.innerText     = text;
}

// ── Big play/pause tap ───────────────────────────────────────────
window.handlePlayPauseTap = function () {
    wakeControls();

    if (!conn || !conn.open) {
        // Flash red to signal not connected
        const btn = document.getElementById('phone-playpause-btn');
        btn.style.background = 'rgba(239,68,68,0.8)';
        setTimeout(() => { btn.style.background = 'rgba(14,165,233,0.9)'; }, 600);
        return;
    }

    if (!hasVideo) {
        // First tap — read clipboard and load
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText()
                .then(text => {
                    const url = text.trim();
                    if (!url || !isValidUrl(url)) {
                        setHint('⚠️ No valid link in clipboard — copy a video link first');
                        setTimeout(() => setHint('Copy a video link, then tap ▶'), 3500);
                        return;
                    }
                    loadVideo(url);
                })
                .catch(() => showPasteFallback());
        } else {
            showPasteFallback();
        }
    } else {
        // Already playing — toggle
        conn.send({ cmd: 'toggle' });
        isPlaying = !isPlaying;
        updatePhonePlayIcon();
        scheduleHideControls();
    }
};

function loadVideo(url) {
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

    // Now-playing bar
    const bar   = document.getElementById('phone-now-playing');
    const icon  = document.getElementById('phone-platform-icon');
    const label = document.getElementById('phone-video-url');
    bar.style.display = 'block';
    label.innerText   = url.length > 48 ? url.slice(0, 45) + '…' : url;

    const platforms = {
        youtube  : { cls: 'fa-brands fa-youtube',   color: '#f87171' },
        facebook : { cls: 'fa-brands fa-facebook',  color: '#60a5fa' },
        instagram: { cls: 'fa-brands fa-instagram', color: '#f472b6' },
        direct   : { cls: 'fa-solid fa-film',       color: '#a78bfa' },
    };
    const platform = parsed.type === 'youtube' ? 'youtube'
        : url.includes('facebook') || url.includes('fb.watch') ? 'facebook'
        : url.includes('instagram') ? 'instagram'
        : 'direct';
    icon.className  = platforms[platform].cls;
    icon.style.color = platforms[platform].color;

    document.getElementById('phone-skip-row').style.display = 'flex';
    setHint('Tap to pause · tap anywhere to show controls');
    scheduleHideControls();
}

function showPasteFallback() {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;gap:14px;';
    ov.innerHTML = `
        <p style="color:#e2e8f0;font-size:15px;font-weight:700;text-align:center;margin:0;">Paste video link</p>
        <input id="fb-url-input" type="url" inputmode="url" placeholder="https://..."
            style="width:100%;max-width:360px;background:#1e293b;border:1px solid #475569;color:#fff;font-size:14px;padding:13px 15px;border-radius:14px;outline:none;box-sizing:border-box;">
        <div style="display:flex;gap:10px;width:100%;max-width:360px;">
            <button id="fb-cancel" style="flex:1;padding:13px;border-radius:14px;background:#334155;color:#94a3b8;font-size:14px;font-weight:700;border:none;cursor:pointer;">Cancel</button>
            <button id="fb-go"     style="flex:2;padding:13px;border-radius:14px;background:#0ea5e9;color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;">▶ Play</button>
        </div>`;
    document.body.appendChild(ov);
    setTimeout(() => document.getElementById('fb-url-input').focus(), 80);
    document.getElementById('fb-cancel').onclick = () => ov.remove();
    document.getElementById('fb-go').onclick = () => {
        const url = document.getElementById('fb-url-input').value.trim();
        ov.remove();
        if (url) loadVideo(url);
    };
    document.getElementById('fb-url-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('fb-go').click();
    });
}

function isValidUrl(str) {
    try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch (_) { return false; }
}

// ── Controls auto-hide / wake ────────────────────────────────────
function scheduleHideControls() {
    clearTimeout(controlsHideTimer);
    const ov = document.getElementById('phone-controls-overlay');
    ov.style.opacity       = '1';
    ov.style.pointerEvents = 'auto';

    if (hasVideo && isPlaying) {
        controlsHideTimer = setTimeout(() => {
            ov.style.opacity       = '0';
            ov.style.pointerEvents = 'none';
        }, 3000);
    }
}

window.wakeControls = function () {
    const ov = document.getElementById('phone-controls-overlay');
    ov.style.opacity       = '1';
    ov.style.pointerEvents = 'auto';
    scheduleHideControls();
};

function setHint(text) { document.getElementById('phone-hint').innerText = text; }

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

    // YouTube — extract 11-char video ID
    const ytMatch = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    if (ytMatch && ytMatch[1]) {
        return { url: ytMatch[1], type: 'youtube', embedUrl: null, isVertical: false };
    }

    // Facebook
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        const isReel   = url.includes('/reel') || url.includes('/share/r') || url.includes('fb.watch');
        const w = isReel ? 360 : 1280;
        const h = isReel ? 640 : 720;
        const embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=${w}&height=${h}&autoplay=true&allowfullscreen=true`;
        return { url, type: 'iframe', embedUrl, isVertical: isReel };
    }

    // Instagram
    const igMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/);
    if (igMatch) {
        return { url, type: 'iframe', embedUrl: `https://www.instagram.com/p/${igMatch[1]}/embed/`, isVertical: true };
    }

    // Direct MP4 / WebM
    return { url, type: 'direct', embedUrl: null, isVertical: false };
}

// ── Utilities ────────────────────────────────────────────────────
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function showScreen(id) {
    ['screen-home', 'screen-laptop', 'screen-phone'].forEach(s => {
        document.getElementById(s).style.display = 'none';
    });
    document.getElementById(id).style.display = id === 'screen-phone' ? 'block' : id === 'screen-laptop' ? 'block' : 'flex';
}
