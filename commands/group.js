module.exports = async (sock, msg, text) => {
  if (text === '.kick') {
    const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
    const participants = groupMetadata.participants.map(p => p.id);
    const sender = msg.key.participant || msg.key.remoteJid;

    if (participants.includes(sender)) {
      await sock.groupParticipantsUpdate(msg.key.remoteJid, [sender], 'remove');
    }
  }
};