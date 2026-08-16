/**
 * EduCast Sync - Simplified Two-Way Synchronized Video Player
 */

let peer = null;
let peerConnection = null;
let roomId = null;
let isHost = false;

// Video State
let ytPlayer = null;
let isYtReady = false;
let currentVideoType = 'direct'; // 'direct' or 'youtube'
let isSuppressingSync = false; // Prevent infinite loop of sync events

// Generate random 4 character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// ---------------------------------------------------------
// PeerJS Connection Logic
// ---------------------------------------------------------

function createRoom() {
    isHost = true;
    roomId = generateRoomCode();
    initPeer(`educast-${roomId}`);
}

function joinRoom() {
    const input = document.getElementById('join-room-input').value.trim().toUpperCase();
    if (input.length !== 4) {
        alert("Please enter a valid 4-character room code.");
        return;
    }
    isHost = false;
    roomId = input;
    initPeer();
}

function initPeer(specificId = null) {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('room-screen').classList.remove('hidden');
    document.getElementById('display-room-code').innerText = roomId;

    peer = specificId ? new Peer(specificId) : new Peer();

    peer.on('open', (id) => {
        if (!isHost) {
            updateConnectionStatus("Connecting to Host...", "text-amber-400");
            peerConnection = peer.connect(`educast-${roomId}`, { reliable: true });
            setupConnectionEvents();
        } else {
            updateConnectionStatus("Waiting for a peer to join...", "text-amber-400");
        }
    });

    peer.on('connection', (conn) => {
        if (isHost) {
            peerConnection = conn;
            setupConnectionEvents();
            updateConnectionStatus("Peer Connected", "text-emerald-400");
        }
    });

    peer.on('error', (err) => {
        alert("Connection error: " + err.message);
        leaveRoom();
    });
}

function setupConnectionEvents() {
    peerConnection.on('open', () => {
        updateConnectionStatus(isHost ? "Peer Connected" : "Connected to Host", "text-emerald-400");
        
        // If host has a video loaded, sync it to the new peer immediately
        if (isHost && document.getElementById('video-placeholder').classList.contains('hidden')) {
            const video = document.getElementById('html-video');
            let url = "";
            let time = 0;
            let paused = true;

            if (currentVideoType === 'direct') {
                url = video.src;
                time = video.currentTime;
                paused = video.paused;
            } else if (currentVideoType === 'youtube' && ytPlayer) {
                url = ytPlayer.getVideoUrl();
                time = ytPlayer.getCurrentTime();
                paused = ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING;
            }
            
            sendSyncData({ type: 'load-video', url: url, videoType: currentVideoType });
            setTimeout(() => {
                sendSyncData({ type: 'seek', time: time });
                if (!paused) sendSyncData({ type: 'play' });
            }, 1000);
        }
    });

    peerConnection.on('data', (data) => {
        handleIncomingSync(data);
    });

    peerConnection.on('close', () => {
        updateConnectionStatus("Peer Disconnected", "text-rose-400");
        peerConnection = null;
    });
}

function sendSyncData(data) {
    if (peerConnection && peerConnection.open) {
        peerConnection.send(data);
    }
}

function updateConnectionStatus(msg, colorClass) {
    const status = document.getElementById('connection-status');
    status.innerText = msg;
    status.className = `text-xs font-medium px-2 py-1 rounded-lg border bg-opacity-10 backdrop-blur-sm ${colorClass} ${colorClass.replace('text-', 'bg-').replace('400', '500/10')} ${colorClass.replace('text-', 'border-').replace('400', '500/20')}`;
    
    if (colorClass.includes('emerald')) {
        document.getElementById('connection-dot').className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]";
    } else {
        document.getElementById('connection-dot').className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
    }
}

function leaveRoom() {
    if (peer) peer.destroy();
    window.location.reload();
}

// ---------------------------------------------------------
// Video Sync Handling
// ---------------------------------------------------------

function handleIncomingSync(data) {
    if (!data) return;
    
    isSuppressingSync = true; // Prevent echo

    const video = document.getElementById('html-video');

    switch (data.type) {
        case 'load-video':
            loadVideoLocally(data.url, data.videoType);
            break;
        case 'play':
            if (currentVideoType === 'direct') video.play();
            else if (currentVideoType === 'youtube' && isYtReady) ytPlayer.playVideo();
            flashSyncBadge('fa-play');
            break;
        case 'pause':
            if (currentVideoType === 'direct') video.pause();
            else if (currentVideoType === 'youtube' && isYtReady) ytPlayer.pauseVideo();
            flashSyncBadge('fa-pause');
            break;
        case 'seek':
            if (currentVideoType === 'direct') video.currentTime = data.time;
            else if (currentVideoType === 'youtube' && isYtReady) ytPlayer.seekTo(data.time, true);
            break;
    }

    setTimeout(() => isSuppressingSync = false, 200);
}

// ---------------------------------------------------------
// Video Loading & Identification
// ---------------------------------------------------------

function loadVideoFromInput() {
    const url = document.getElementById('video-link-input').value.trim();
    if (!url) return;

    let type = 'direct';
    let cleanUrl = url;

    // Detect YouTube
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
        type = 'youtube';
        cleanUrl = ytMatch[1]; // Store video ID
    }

    loadVideoLocally(cleanUrl, type);
    sendSyncData({ type: 'load-video', url: cleanUrl, videoType: type });
    document.getElementById('video-link-input').value = '';
}

function loadVideoLocally(url, type) {
    currentVideoType = type;
    document.getElementById('video-placeholder').classList.add('hidden');
    
    const video = document.getElementById('html-video');
    const ytWrapper = document.getElementById('youtube-wrapper');

    if (type === 'direct') {
        ytWrapper.classList.add('hidden');
        video.classList.remove('hidden');
        if (ytPlayer && isYtReady) ytPlayer.pauseVideo();
        
        video.src = url;
        video.play().catch(()=>{}); // Autoplay might fail without interaction
    } else if (type === 'youtube') {
        video.classList.add('hidden');
        video.pause();
        ytWrapper.classList.remove('hidden');

        if (ytPlayer && isYtReady) {
            ytPlayer.loadVideoById(url);
        } else {
            // Save ID for when API is ready
            ytWrapper.dataset.pendingId = url;
        }
    }
}

// ---------------------------------------------------------
// Local Video Event Listeners (Triggers Outgoing Sync)
// ---------------------------------------------------------

const htmlVideo = document.getElementById('html-video');

htmlVideo.addEventListener('play', () => {
    if (!isSuppressingSync) sendSyncData({ type: 'play' });
});

htmlVideo.addEventListener('pause', () => {
    if (!isSuppressingSync) sendSyncData({ type: 'pause' });
});

htmlVideo.addEventListener('seeked', () => {
    if (!isSuppressingSync) sendSyncData({ type: 'seek', time: htmlVideo.currentTime });
});

// YouTube API
window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0 },
        events: {
            'onReady': (event) => {
                isYtReady = true;
                const pendingId = document.getElementById('youtube-wrapper').dataset.pendingId;
                if (pendingId) ytPlayer.loadVideoById(pendingId);
            },
            'onStateChange': (event) => {
                if (isSuppressingSync) return;
                
                if (event.data === YT.PlayerState.PLAYING) {
                    sendSyncData({ type: 'play' });
                } else if (event.data === YT.PlayerState.PAUSED) {
                    sendSyncData({ type: 'pause' });
                }
            }
        }
    });
};

function flashSyncBadge(iconClass) {
    const badge = document.getElementById('sync-badge');
    const icon = document.getElementById('sync-icon');
    icon.className = `fa-solid ${iconClass}`;
    badge.style.opacity = '1';
    badge.style.transform = 'scale(1)';
    setTimeout(() => {
        badge.style.opacity = '0';
        badge.style.transform = 'scale(1.25)';
    }, 450);
}