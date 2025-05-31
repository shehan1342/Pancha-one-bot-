const { OpenAI } = require('openai');
const config = require('../config');

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

module.exports = async (sock, msg, text) => {
  if (text.startsWith('.ai ')) {
    const prompt = text.replace('.ai ', '');
    const response = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-3.5-turbo',
    });

    await sock.sendMessage(msg.key.remoteJid, { text: response.choices[0].message.content });
  }
};