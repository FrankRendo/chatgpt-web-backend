const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer para recibir archivos
const upload = multer({ dest: 'uploads/' });

// ✅ Servir archivos estáticos desde carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());

// ✅ Ruta explícita para servir index.html desde carpeta "public"
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

      fs.unlinkSync(imageFile.path); // ✅ Borra el archivo temporal
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

    const reply = data.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ reply: 'Ocurrió un error procesando tu solicitud.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
