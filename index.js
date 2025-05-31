const { connectToMongo } = require('./utils/mongo');
const { useMultiFileAuthState, default: makeWASocket } = require('@whiskeysockets/baileys');
const config = require('./config');
const path = require('path');
const fs = require('fs');
const http = require('http');

// 👉 Health check server for Koyeb
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
}).listen(8000, () => {
  console.log('✅ Health check server running on port 8000');
});

// 👉 Connect to MongoDB
connectToMongo();

// 👉 Load commands from /commands folder
const commands = new Map();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.set(command.name, command);
}

// 👉 Start the bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, './session'));
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const sender = msg.key.remoteJid;

    if (!text.startsWith(config.prefix)) return;

    const args = text.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(sock, msg, args);
    } catch (err) {
      console.error("❌ Command Error:", err);
      await sock.sendMessage(sender, { text: "🚫 Command error occurred." });
    }
  });
}

startBot();