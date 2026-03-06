// ECO — WhatsApp Webhook
// Paso 1: Recibe mensajes y responde con texto fijo (sin IA, sin DB)

const VERIFY_TOKEN   = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

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

  // ── POST: mensaje entrante de WhatsApp ─────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.status(200).send('OK');
    }

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message || message.type !== 'text') {
      return res.status(200).send('OK');
    }

    const from = message.from;         // número del usuario
    const text = message.text.body;    // texto que mandó

    console.log(`📩 Mensaje de ${from}: ${text}`);

    // Respuesta fija (Paso 1 — sin IA todavía)
    await sendWhatsApp(from, '🐾 Hola, soy ECO. ¡Estoy despertando!\n\nEste es el primer latido. Pronto podrás criarme. 🥚');

    return res.status(200).send('OK');
  }

  res.status(405).send('Method Not Allowed');
}

// ── Envía un mensaje de texto por WhatsApp Cloud API ──────────────────
async function sendWhatsApp(to, text) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Error enviando mensaje:', JSON.stringify(error));
  } else {
    console.log(`✅ Mensaje enviado a ${to}`);
  }
}
