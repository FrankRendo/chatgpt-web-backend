const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// ✅ Formateo visual del texto de ChatGPT
function formatReply(text) {
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</ul><ul>')
    .replace(/\n/g, '<br>')
    .replace(/<ul><\/ul>/g, '')
    .replace(/<ul><br>/g, '<ul>')
    .replace(/<\/li><br>/g, '</li>')
    .replace(/<ul>/g, '<ul style="margin-top: 0; padding-left: 20px;">');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/chat', upload.single('image'), async (req, res) => {
  const userMessage = req.body.message || '';
  const imageFile = req.file;

  try {
    let messages = [];

    if (userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    if (imageFile) {
      const imageData = fs.readFileSync(imageFile.path);
      const base64Image = imageData.toString('base64');

      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userMessage || 'Analizá esta imagen' },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      });

      fs.unlinkSync(imageFile.path);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Respuesta inesperada de la API:', data);
      return res.status(500).json({ reply: 'Error en la respuesta de ChatGPT.' });
    }

    const reply = formatReply(data.choices[0].message.content);
    res.json({ reply });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ reply: 'Ocurrió un error procesando tu solicitud.' });
  }
});

app.post('/api/analizar-url', upload.none(), async (req, res) => {
  const url = req.body.url;

  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ reply: 'URL inválida.' });
  }

  try {
    const html = await fetch(url).then(res => res.text());
    const $ = cheerio.load(html);

    const pageText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 3000);

    const messages = [
      {
        role: 'user',
        content: `Analizá el siguiente contenido extraído de una página web:\n\n${pageText}`
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('Respuesta inesperada de la API:', data);
      return res.status(500).json({ reply: 'Error en la respuesta de ChatGPT.' });
    }

    const reply = formatReply(data.choices[0].message.content);
    res.json({ reply });

  } catch (error) {
    console.error('Error al procesar la URL:', error);
    res.status(500).json({ reply: 'Error al analizar el contenido de la URL.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});