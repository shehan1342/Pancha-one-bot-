const ytdl = require('ytdl-core');

async function downloadAudio(url, path) {
  return new Promise((resolve, reject) => {
    ytdl(url, { filter: 'audioonly' })
      .pipe(fs.createWriteStream(path))
      .on('finish', resolve)
      .on('error', reject);
  });
}

module.exports = { downloadAudio };