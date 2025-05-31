const { connectToMongo } = require('./utils/mongo');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { default: makeWASocket } = require('@whiskeysockets/baileys');
const config = require('./config');
const path = require('path');

// MongoDB Connect
connectToMongo();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, './session'));
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
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