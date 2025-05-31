const { connectToMongo } = require('./utils/mongo');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { default: makeWASocket } = require('@whiskeysockets/baileys');
const config = require('./config');
const path = require('path');

// 👉 Health check HTTP server for Koyeb
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Bot is running\n');
}).listen(8000, () => {
  console.log('✅ Health check server running on port 8000');
});

// 👉 MongoDB Connect
connectToMongo();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, './session'));
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true, // 🟡 This will show a warning (deprecated)
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    require('./commands/group')(sock, msg, text);
    require('./commands/download')(sock, msg, text);
    require('./commands/ai')(sock, msg, text);
  });
}

startBot();