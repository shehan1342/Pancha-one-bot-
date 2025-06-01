const { Client, RemoteAuth, MessageMedia, Util } = require('whatsapp-web.js');
const fs = require('fs-extra'); // Or just 'fs'
const path = require('path');
const { Collection } = require('@discordjs/collection'); // For command management

// --- Configuration Loading ---
let config;
let sessionStringFromConfig;

try {
    // For Koyeb/production, we will try to use Environment Variables first
    if (process.env.SESSION_STRING && process.env.BOT_PREFIX && process.env.OWNER_NUMBER && process.env.BOT_NAME) {
        console.log("Loading configuration from Environment Variables...");
        sessionStringFromConfig = process.env.SESSION_STRING;
        config = {
            prefix: process.env.BOT_PREFIX,
            ownerNumber: process.env.OWNER_NUMBER, // Expecting a single owner number string like "947XXXXXXXXX@c.us"
            botName: process.env.BOT_NAME,
            // Add other config defaults or from env vars if needed
        };
    } else if (fs.existsSync('./config.json')) {
        // For local development, load from config.json
        console.log("Loading configuration from config.json...");
        const localConfig = require('./config.json');
        sessionStringFromConfig = localConfig.session_string; // Expecting session_string in config.json
        config = localConfig;
    } else {
        console.error("FATAL ERROR: Configuration not found! Set Environment Variables or create config.json.");
        process.exit(1);
    }

    if (!sessionStringFromConfig || sessionStringFromConfig === "YOUR_SESSION_STRING_HERE" || sessionStringFromConfig.length < 100) {
        console.error("FATAL ERROR: Session string is not set or is invalid in config/environment variables!");
        process.exit(1);
    }
    if (!config || !config.prefix || !config.ownerNumber || !config.botName) {
        console.error("FATAL ERROR: Essential config (prefix, ownerNumber, botName) is missing!");
        process.exit(1);
    }

} catch (error) {
    console.error("Error loading configuration:", error);
    process.exit(1);
}
// --- End Configuration Loading ---

let parsedSessionData;
try {
    parsedSessionData = JSON.parse(sessionStringFromConfig);
} catch (error) {
    console.error("Failed to parse session string. Make sure it's valid JSON:", error);
    process.exit(1);
}

// --- Session Store for RemoteAuth ---
// Simple File-based store (good for Koyeb if you mount a volume for session.json)
class FileSessionStore {
    constructor(filePath = './session_data_remote.json') { // Different name to avoid conflict with old auth.json
        this.filePath = filePath;
        this.sessions = new Map();
        this._loadSessions();
    }
    _loadSessions() {
        try {
            if (fs.existsSync(this.filePath)) {
                const fileContent = fs.readFileSync(this.filePath, 'utf-8');
                const parsed = JSON.parse(fileContent);
                for (const [id, session] of Object.entries(parsed)) {
                    this.sessions.set(id, session);
                }
                console.log(`Loaded ${this.sessions.size} sessions from ${this.filePath}`);
            }
        } catch (e) { console.error('Failed to load sessions from file:', e); }
    }
    _saveSessions() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.sessions), null, 2));
        } catch (e) { console.error('Failed to save sessions to file:', e); }
    }
    async save(session) {
        this.sessions.set(session.clientID || 'DEFAULT_REMOTE_CLIENT', session);
        this._saveSessions();
    }
    async get(clientID) { return this.sessions.get(clientID); }
    async delete(clientID) {
        this.sessions.delete(clientID);
        this._saveSessions();
    }
}
const store = new FileSessionStore();
const REMOTE_CLIENT_ID = config.botName.replace(/\s+/g, '') + "Session"; // e.g., PanchaBotSession

// Load the initial session from config into the store
store.save({ clientID: REMOTE_CLIENT_ID, ...parsedSessionData });
// --- End Session Store ---

console.log(`Initializing ${config.botName} with RemoteAuth...`);

const client = new Client({
    authStrategy: new RemoteAuth({
        clientId: REMOTE_CLIENT_ID,
        store: store,
        backupSyncIntervalMs: 300000 // Sync every 5 minutes
    }),
    puppeteer: {
        headless: true,
        args: [ // These are common args, you can adjust based on your old config
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // May help on some environments
            '--disable-extensions'
        ],
        // For Koyeb, PUPPETEER_EXECUTABLE_PATH should be set as an ENV VAR
        // Or use a path that's available in your Docker container if you build one
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
    },
    // You can add other client options from your old config if needed:
    // ffmpegPath: '/usr/bin/ffmpeg', // Example, if you had this
    // qrMaxRetries: 5,
});

// --- Command Handler ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            if (command.name && command.execute) {
                client.commands.set(command.name.toLowerCase(), command);
                console.log(`Loaded command: ${command.name}`);
            } else {
                console.warn(`[WARNING] Command file ${file} is missing 'name' or 'execute' property.`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to load command from ${file}:`, error);
        }
    }
} catch (error) {
    console.error("[ERROR] Could not read 'commands' directory:", error);
}
// --- End Command Handler ---

client.on('qr', () => {
    console.error('[FATAL] QR code requested! This should NOT happen with RemoteAuth if the session string is valid.');
    console.error('Please ensure your SESSION_STRING is correct and not expired. Exiting.');
    process.exit(1);
});

client.on('ready', () => {
    console.log('--------------------------------------------------');
    console.log(` ${config.botName} is Authenticated and Ready! `);
    console.log(` Prefix: ${config.prefix} `);
    console.log(` Owner: ${config.ownerNumber} `);
    console.log('--------------------------------------------------');
    // You can send a startup message to owner if you want
    // client.sendMessage(config.ownerNumber, `${config.botName} is now online and ready!`);
});

// IMPORTANT: 'message' event is now 'message_create' in recent whatsapp-web.js versions
client.on('message_create', async msg => {
    // Ignore if message is from self, or doesn't start with prefix, or no body
    if (msg.fromMe || !msg.body || !msg.body.startsWith(config.prefix)) return;

    const args = msg.body.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) ||
                    client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return; // Optionally, send "command not found"

    // Example for owner-only commands (you might have this in your command files)
    // This is a basic check, you can expand on this
    if (command.ownerOnly) {
        const senderId = msg.author ? msg.author.split('@')[0] : msg.from.split('@')[0];
        const ownerId = config.ownerNumber.split('@')[0];
        if (senderId !== ownerId) {
            return msg.reply("You don't have permission to use this command. 🔒");
        }
    }

    try {
        console.log(`Executing command: ${command.name} by ${msg.from} with args: [${args.join(', ')}]`);
        await command.execute(client, msg, args, config, Util); // Passing Util for media if needed
    } catch (error) {
        console.error(`Error executing command '${command.name}':`, error);
        await msg.reply(`An error occurred while running that command: \`${error.message || "Unknown error"}\``);
    }
});

client.on('remote_session_saved', () => {
    console.log('Session data was updated and saved to the store by RemoteAuth.');
});

client.on('auth_failure', authMsg => {
    console.error('AUTHENTICATION FAILURE:', authMsg);
    console.error('The session string might be invalid or expired. Please generate a new one.');
    process.exit(1); // Exit so the hosting service can restart (and you can fix the session)
});

client.on('disconnected', reason => {
    console.log('Client was logged out / disconnected:', reason);
    console.log('Exiting. The hosting service should attempt to restart.');
    process.exit(1); // Exit to allow restart
});

// --- Group Participants Update (Welcome/Goodbye from your old code) ---
// This needs to be adapted for the new 'config' and potentially async operations
// Make sure 'config.json' has 'welcome' and 'goodbye' booleans and 'groupWelcome', 'groupGoodbye' strings
client.on('group_participants_update', async (notification) => {
    try {
        const groupChat = await notification.getChat();
        if (notification.type === 'add' && config.welcome) {
            const newParticipants = notification.recipientIds.map(id => `@${id.split('@')[0]}`).join(' ');
            const welcomeMessage = (config.groupWelcome || "Welcome {user} to {groupName}!")
                .replace('{user}', newParticipants)
                .replace('{groupName}', groupChat.name);

            // Mention participants
            let mentions = [];
            for(let participant of notification.recipientIds) {
                const contact = await client.getContactById(participant);
                mentions.push(contact);
            }
            await groupChat.sendMessage(welcomeMessage, { mentions });
            console.log(`Sent welcome message to ${newParticipants} in ${groupChat.name}`);
        } else if (notification.type === 'remove' && config.goodbye) {
            const removedParticipants = notification.recipientIds.map(id => `@${id.split('@')[0]}`).join(' ');
             const goodbyeMessage = (config.groupGoodbye || "Goodbye {user}, we'll miss you from {groupName}!")
                .replace('{user}', removedParticipants)
                .replace('{groupName}', groupChat.name);

            let mentions = [];
            for(let participant of notification.recipientIds) {
                const contact = await client.getContactById(participant); // May fail if contact is no longer available
                if (contact) mentions.push(contact);
            }
            if (mentions.length > 0) {
                 await groupChat.sendMessage(goodbyeMessage, { mentions });
            } else {
                await groupChat.sendMessage(goodbyeMessage.replace(/@\S+/g, 'them')); // Fallback if contacts can't be fetched
            }
            console.log(`Sent goodbye message for ${removedParticipants} in ${groupChat.name}`);
        }
    } catch (error) {
        console.error("Error in group_participants_update:", error);
    }
});
// --- End Group Participants Update ---

console.log("Attempting to initialize WhatsApp client...");
client.initialize().catch(err => {
    console.error('Client initialization failed catastrophically:', err);
    process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    if (client) {
        try {
            await client.destroy();
            console.log("Client destroyed.");
        } catch (e) {
            console.error("Error destroying client:", e);
        }
    }
    process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
