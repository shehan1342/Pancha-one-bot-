const ytdl = require('ytdl-core');
const fs = require('fs');

module.exports = async (sock, msg, text) => {
  if (text.startsWith('.yt ')) {
    const url = text.split(' ')[1];
    if (!ytdl.validateURL(url)) return sock.sendMessage(msg.key.remoteJid, { text: 'Invalid YouTube URL.' });

    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title;
    const stream = ytdl(url, { filter: 'audioonly' });

    const filePath = `./${title}.mp3`;
    stream.pipe(fs.createWriteStream(filePath)).on('finish', async () => {
      await sock.sendMessage(msg.key.remoteJid, {
        audio: { url: filePath },
        mimetype: 'audio/mpeg',
        ptt: false,
      });
      fs.unlinkSync(filePath);
    });
  }
};