import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Support large base64 images and PDFs from mobile cameras
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // Health & status check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'Ruta Track - Control de Vehículos' });
  });

  // OCR / Document Digitization Endpoint using Gemini 3.8 Flash
  app.post('/api/ocr/extract', async (req, res) => {
    try {
      const { base64Data, mimeType, fileName, availableEquipmentTypes } = req.body;

      if (!base64Data || !mimeType) {
        res.status(400).json({
          error: 'Se requiere una imagen o archivo PDF válido para digitalizar.',
        });
        return;
      }

      const cleanBase64 = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;

      const equipmentList = Array.isArray(availableEquipmentTypes) && availableEquipmentTypes.length > 0
        ? availableEquipmentTypes.join(', ')
        : 'Batea, Cisterna, Rampla';

      const ai = getGenAIClient();

      const prompt = `Eres un sistema experto en OCR y digitalización logística para control de transporte pesado (camiones, cisternas, bateas, ramplas).
Analiza cuidadosamente este documento o fotografía (nombre de archivo: ${fileName || 'documento'}) y extrae los datos del vehículo y del conductor.

Instrucciones de extracción:
1. Patente del camión (patenteCamion): Identifica la placa/patente del tractocamión o camión (ej. "AB-CD-12", "ABCD-12", "BC-FG-89", "ABC-123"). Formatea en mayúsculas con guiones si corresponde.
2. Patente del remolque (patenteRemolque): Identifica la patente del semirremolque, rampla, cisterna o acoplado si aparece (ej. "XY-45-67", "JJ-88-11"). Si no aparece, devuelve "".
3. Empresa (empresa): Nombre de la empresa transportista o contratista para la que trabaja el chofer (ej. "Transportes ABC", "Logística del Sur").
4. Nombre del chofer (choferNombre): Nombres de pila del conductor (ej. "Juan", "Carlos Alberto"). Si aparece el nombre completo junto (ej. "Juan Pérez"), separa "Juan" en choferNombre y "Pérez" en choferApellido.
5. Apellido del chofer (choferApellido): Apellidos del conductor (ej. "Pérez", "Gómez Rojas").
6. Tipo de equipo (tipoEquipo): Identifica el tipo de equipo. Prioriza uno de los siguientes si coincide: ${equipmentList}. Si dice "Estanque" o "Tanque", usa "Cisterna". Si dice "Volquete" o "Tolva batea", usa "Batea". Si dice "Plataforma" o "Plano", usa "Rampla". Si es otro tipo específico, indícalo con la primera letra en mayúscula.
7. Marca del camión (marca): Marca del tractocamión (ej. "Volvo", "Scania", "Mercedes-Benz", "Freightliner", "International", "MAN", "Iveco", "Mack", "Kenworth", "DAF").
8. Color del camión (color): Color principal del camión (ej. "Blanco", "Azul", "Rojo", "Plata", "Gris", "Negro", "Amarillo", "Verde").
9. textoDetectado: Breve resumen de las líneas clave leídas del documento original para respaldo.

Si algún campo no se encuentra en el documento, devuelve una cadena vacía "" para ese campo.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              patenteCamion: {
                type: Type.STRING,
                description: 'Patente o placa del camión en mayúsculas (ej. AB-CD-12)',
              },
              patenteRemolque: {
                type: Type.STRING,
                description: 'Patente o placa del remolque/acoplado en mayúsculas (ej. XY-45-67)',
              },
              empresa: {
                type: Type.STRING,
                description: 'Nombre de la empresa de transporte',
              },
              choferNombre: {
                type: Type.STRING,
                description: 'Nombre(s) del chofer',
              },
              choferApellido: {
                type: Type.STRING,
                description: 'Apellido(s) del chofer',
              },
              tipoEquipo: {
                type: Type.STRING,
                description: 'Tipo de equipo (Batea, Cisterna, Rampla u otro)',
              },
              marca: {
                type: Type.STRING,
                description: 'Marca del camión (ej. Volvo, Scania, Mercedes-Benz)',
              },
              color: {
                type: Type.STRING,
                description: 'Color del camión (ej. Blanco, Azul, Rojo)',
              },
              textoDetectado: {
                type: Type.STRING,
                description: 'Resumen del texto original detectado en el documento',
              },
            },
            required: [
              'patenteCamion',
              'patenteRemolque',
              'empresa',
              'choferNombre',
              'choferApellido',
              'tipoEquipo',
              'marca',
              'color',
              'textoDetectado',
            ],
          },
        },
      });

      const rawText = response.text || '{}';
      const extracted = JSON.parse(rawText);

      res.json({
        success: true,
        data: {
          patenteCamion: (extracted.patenteCamion || '').trim().toUpperCase(),
          patenteRemolque: (extracted.patenteRemolque || '').trim().toUpperCase(),
          empresa: (extracted.empresa || '').trim(),
          choferNombre: (extracted.choferNombre || '').trim(),
          choferApellido: (extracted.choferApellido || '').trim(),
          tipoEquipo: (extracted.tipoEquipo || '').trim(),
          marca: (extracted.marca || '').trim(),
          color: (extracted.color || '').trim(),
          textoDetectado: (extracted.textoDetectado || '').trim(),
        },
      });
    } catch (error: unknown) {
      console.error('Error en OCR Gemini:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Error al procesar el documento mediante OCR/IA.';
      res.status(500).json({
        error: message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Ruta Track Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
