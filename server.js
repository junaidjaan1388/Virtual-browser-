const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const puppeteer = require('puppeteer');
const app = express();
const server = createServer(app);
const io = new Server(server);

// Store browser sessions
const browserSessions = new Map();

// Initialize a new browser instance
async function initBrowser() {
  return await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });
}

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create a new shared browsing room
  socket.on('create-room', async ({ roomId }) => {
    try {
      const browser = await initBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      
      browserSessions.set(roomId, { browser, page });
      socket.join(roomId);
      
      socket.emit('room-created', { roomId });
      console.log(`Room ${roomId} created`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // Join an existing room
  socket.on('join-room', ({ roomId }) => {
    if (browserSessions.has(roomId)) {
      socket.join(roomId);
      socket.emit('room-joined', { roomId });
      
      // Send current URL to new participant
      const { page } = browserSessions.get(roomId);
      if (page.url() !== 'about:blank') {
        socket.emit('navigation', { url: page.url() });
      }
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  // Handle navigation requests
  socket.on('navigate', async ({ roomId, url }) => {
    if (!browserSessions.has(roomId)) return;

    const { page } = browserSessions.get(roomId);
    try {
      await page.goto(url.startsWith('http') ? url : `https://${url}`, {
        waitUntil: 'networkidle2'
      });
      
      // Send screenshot to all clients
      const screenshot = await page.screenshot({ encoding: 'base64' });
      io.to(roomId).emit('navigation', { 
        url: page.url(),
        screenshot: `data:image/png;base64,${screenshot}`
      });
    } catch (error) {
      console.error('Navigation error:', error);
      socket.emit('error', { message: 'Failed to navigate' });
    }
  });

  // Handle browser actions (clicks, scrolls, etc.)
  socket.on('browser-action', async ({ roomId, action, data }) => {
    if (!browserSessions.has(roomId)) return;

    const { page } = browserSessions.get(roomId);
    try {
      switch (action) {
        case 'click':
          await page.mouse.click(data.x, data.y);
          break;
        case 'scroll':
          await page.evaluate((scrollData) => {
            window.scrollBy(scrollData.x, scrollData.y);
          }, data);
          break;
        case 'keypress':
          await page.keyboard.press(data.key);
          break;
      }
      
      // Update all clients after action
      const screenshot = await page.screenshot({ encoding: 'base64' });
      io.to(roomId).emit('update', {
        screenshot: `data:image/png;base64,${screenshot}`,
        url: page.url()
      });
    } catch (error) {
      console.error('Action error:', error);
    }
  });

  // Clean up when client disconnects
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Clean up inactive rooms periodically
setInterval(() => {
  const now = Date.now();
  browserSessions.forEach((session, roomId) => {
    const clients = io.sockets.adapter.rooms.get(roomId);
    if (!clients || clients.size === 0) {
      session.browser.close();
      browserSessions.delete(roomId);
      console.log(`Cleaned up room ${roomId}`);
    }
  });
}, 60000); // Check every minute

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
