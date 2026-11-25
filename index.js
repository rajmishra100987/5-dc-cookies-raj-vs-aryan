global.WebSocket = require('ws'); // Railway & Node WebSocket fix

const express = require('express');
const { MessengerClient, Platform, CookieManager } = require('messagix-js');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Anti-Crash System
process.on('uncaughtException', (err) => console.error('[ANTI-CRASH] Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('[ANTI-CRASH] Unhandled Rejection:', reason));

// Keep-Alive Routes
app.head('/', (req, res) => res.status(200).end());
app.get('/', (req, res) => res.send('raj mishra multi-token server running ✅️'));
app.get('/ping', (req, res) => res.status(200).send('Pong - Server is Active!'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM LIVE] Server listening on port ${PORT}`);
    startMultiBots();
});

// Helper to read configuration text files
function readTextFile(filename, defaultValue = '') {
    try {
        if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8').trim();
        }
    } catch (e) {
        console.error(`Error reading ${filename}:`, e.message);
    }
    return defaultValue;
}

async function startMultiBots() {
    console.log('[SYSTEM] Initializing Bot Engine (No Skipping)...');
    
    // Padho saari cookies (tokens)
    const cookiesRaw = readTextFile('cookies.txt');
    const cookiesList = cookiesRaw.split('\n').map(c => c.trim()).filter(Boolean);

    if (cookiesList.length === 0) {
        console.log('[CONFIG ERROR] cookies.txt is empty. Retrying in 10s...');
        setTimeout(startMultiBots, 10000);
        return;
    }

    // Clients ka pool banayenge. Agar koi connect nahi ho paya, toh bhi isko list me rakhenge
    let clientsPool = [];
    
    for (let i = 0; i < cookiesList.length; i++) {
        clientsPool.push({
            id: i + 1,
            cookieStr: cookiesList[i],
            client: null, // Abhi connect nahi hai
            isDead: false
        });
    }

    let msgIndex = 0;
    let loopCount = 1;

    // MAIN INFINITE LOOP (Python jaisa logic)
    while (true) {
        const threadId = readTextFile('convo.txt');
        const currentDelaySec = parseInt(readTextFile('time.txt', '120'), 10) || 120;
        const hatersName = readTextFile('hatersname.txt');
        const currentMsgsRaw = readTextFile('messages.txt', 'Hello');
        const currentMsgs = currentMsgsRaw.split('\n').map(m => m.trim()).filter(Boolean);

        if (!threadId || currentMsgs.length === 0) {
            console.log('[WAITING] Waiting for convo.txt or messages.txt...');
            await new Promise(r => setTimeout(r, 10000));
            continue;
        }

        // Message index ko token ke hisaab se modulo karo
        const tokenIndex = msgIndex % clientsPool.length;
        const currentBot = clientsPool[tokenIndex];
        
        if (msgIndex >= currentMsgs.length) {
            msgIndex = 0;
            loopCount++;
            console.log(`[LOOP] 🔄 Completed full list. Restarting (Round ${loopCount})...`);
        }

        const rawMsg = currentMsgs[msgIndex] || "Hello";
        const finalMessage = hatersName ? `${hatersName} ${rawMsg}` : rawMsg;

        // 1. CHECK CONNECTION (Agar pehle se connected nahi hai, toh connect karo)
        if (!currentBot.client || !currentBot.client.isConnected) {
            console.log(`[ACC-${currentBot.id}] 🔄 Connecting/Reconnecting...`);
            try {
                const cookieManager = CookieManager.fromString(Platform.Messenger, currentBot.cookieStr);
                currentBot.client = new MessengerClient({ 
                    platform: Platform.Messenger, 
                    cookies: cookieManager.getAll(), 
                    enableE2EE: false 
                });
                await currentBot.client.loadMessagesPage();
                await currentBot.client.connect();
                console.log(`[ACC-${currentBot.id}] ✅ Login Successful!`);
            } catch (connErr) {
                console.error(`[ACC-${currentBot.id}] ❌ Connection Failed: ${connErr.message}`);
                currentBot.client = null; // Reset client
            }
        }

        // 2. SEND MESSAGE
        if (currentBot.client && currentBot.client.isConnected) {
            try {
                await currentBot.client.sendMessage(threadId, finalMessage);
                console.log(`[${new Date().toLocaleTimeString()}] [ACC-${currentBot.id}] 🚀 Sent: ${finalMessage.substring(0, 30)}...`);
            } catch (sendErr) {
                console.error(`[${new Date().toLocaleTimeString()}] [ACC-${currentBot.id}] ⚠️ Send Failed: ${sendErr.message}`);
                // Agar message send fail hua, toh client ko null kar do taaki agli baar dobara connect ho
                currentBot.client = null; 
            }
        } else {
            console.log(`[${new Date().toLocaleTimeString()}] [ACC-${currentBot.id}] ⏭️ Skipped sending due to connection issue. Will retry next round.`);
        }

        // Next message aur next token ke liye index badhao
        msgIndex++;

        // Delay ke baad next account chalega
        await new Promise(resolve => setTimeout(resolve, currentDelaySec * 1000));
    }
    }
