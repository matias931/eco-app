// ECO — WhatsApp Webhook
// Recibe mensajes de Meta y los reenvía a n8n para procesamiento

import https from 'https';
import { URL }  from 'url';

const VERIFY_TOKEN    = process.env.VERIFY_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Llama al webhook de n8n ignorando SSL (el cert del servidor venció)
function postToN8n(url, payload) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const data    = JSON.stringify(payload);
    const options = {
      hostname           : parsed.hostname,
      port               : parsed.port || 443,
      path               : parsed.pathname,
      method             : 'POST',
      headers            : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      rejectUnauthorized : false,   // bypass SSL expirado en el servidor n8n
    };
    const req = https.request(options, (res) => {
      res.resume();                 // drena la respuesta (no la necesitamos)
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export default async function handler(req, res) {

  // ── GET: verificación del webhook por Meta ──────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado por Meta');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Token incorrecto');
  }

  // ── POST: mensaje entrante de WhatsApp → reenviar a n8n ────────────
  if (req.method === 'POST') {
    try {
      const body = req.body;

      if (body.object !== 'whatsapp_business_account') {
        return res.status(200).send('OK');
      }

      const entry   = body.entry?.[0];
      const change  = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (!message) {
        return res.status(200).send('OK');
      }

      const phone    = message.from;
      const type     = message.type;
      const text     = type === 'text' ? message.text.body : null;
      const metadata = change?.metadata;

      console.log(`📩 Mensaje de ${phone}: ${text || `[${type}]`}`);

      // Reenviar a n8n ANTES de responder a Meta
      if (N8N_WEBHOOK_URL) {
        const status = await postToN8n(N8N_WEBHOOK_URL, {
          phone,
          text,
          type,
          phone_number_id: metadata?.phone_number_id,
          timestamp: message.timestamp,
          raw: body,
        });
        console.log(`✅ Reenviado a n8n — HTTP ${status}`);
      } else {
        console.warn('⚠️ N8N_WEBHOOK_URL no configurado');
      }

    } catch (err) {
      console.error('❌ Error procesando mensaje:', err.message);
    }

    // Responder a Meta al final (tiene hasta 20s, sobra tiempo)
    return res.status(200).send('OK');
  }

  res.status(405).send('Method Not Allowed');
}
