const socket = io();
let currentRoomId = null;
let isLeader = false;

// DOM elements
const roomIdInput = document.getElementById('roomIdInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const browserDisplay = document.getElementById('browserDisplay');

// Create a new room
createBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        socket.emit('create-room', { roomId });
        currentRoomId = roomId;
        isLeader = true;
        urlInput.disabled = false;
        goBtn.disabled = false;
    }
});

// Join an existing room
joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        socket.emit('join-room', { roomId });
        currentRoomId = roomId;
        isLeader = false;
        urlInput.disabled = true;
        goBtn.disabled = true;
    }
});

// Navigate to a new URL
goBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url && currentRoomId) {
        socket.emit('navigate', { roomId: currentRoomId, url });
    }
});

// Handle clicks on the browser display
browserDisplay.addEventListener('click', (e) => {
    if (!currentRoomId || !isLeader) return;
    
    const rect = browserDisplay.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Show click marker
    const marker = document.createElement('div');
    marker.className = 'click-marker';
    marker.style.left = `${e.clientX - rect.left}px`;
    marker.style.top = `${e.clientY - rect.top}px`;
    browserDisplay.appendChild(marker);
    setTimeout(() => marker.remove(), 500);
    
    // Send click action
    socket.emit('browser-action', {
        roomId: currentRoomId,
        action: 'click',
        data: { x, y }
    });
});

// Handle keyboard events
document.addEventListener('keydown', (e) => {
    if (!currentRoomId || !isLeader) return;
    
    // Only send certain keys
    const allowedKeys = ['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];
    if (allowedKeys.includes(e.key)) {
        socket.emit('browser-action', {
            roomId: currentRoomId,
            action: 'keypress',
            data: { key: e.key }
        });
    }
});

// Handle navigation updates
socket.on('navigation', ({ url, screenshot }) => {
    urlInput.value = url;
    browserDisplay.innerHTML = '';
    const img = document.createElement('img');
    img.src = screenshot;
    browserDisplay.appendChild(img);
});

// Handle browser updates (after actions)
socket.on('update', ({ screenshot, url }) => {
    urlInput.value = url;
    const img = browserDisplay.querySelector('img');
    if (img) {
        img.src = screenshot;
    }
});

// Handle errors
socket.on('error', ({ message }) => {
    alert(`Error: ${message}`);
});

// Handle room creation/joining
socket.on('room-created', ({ roomId }) => {
    alert(`Room ${roomId} created successfully!`);
});

socket.on('room-joined', ({ roomId }) => {
    alert(`Joined room ${roomId} successfully!`);
});
