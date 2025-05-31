module.exports = {
  name: "menu",
  description: "Shows available commands",
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const menuText = `📋 Pancha One Bot Menu:

- !menu        ➤ Show this menu
- !ai <text>   ➤ Chat with AI
- !yt <link>   ➤ Download YouTube media
- !kick <@tag> ➤ Remove user (admin only)
`;

    await sock.sendMessage(jid, { text: menuText });
  }
};