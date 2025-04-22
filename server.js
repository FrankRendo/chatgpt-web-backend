const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Configuración de multer para recibir archivos
const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Función para borrar archivo de forma segura
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('No se pudo eliminar el archivo:', err.message);
  }
}

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

    // Siempre borrar archivo si fue subido
    safeUnlink(imageFile?.path);

    if (data.error) {
      console.error('Respuesta inesperada de la API:', data);
      return res.status(500).json({ reply: 'Error en la respuesta de ChatGPT.' });
    }

    const reply = data.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error('Error:', error);
    safeUnlink(imageFile?.path);
    res.status(500).json({ reply: 'Ocurrió un error procesando tu solicitud.' });
  }
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});