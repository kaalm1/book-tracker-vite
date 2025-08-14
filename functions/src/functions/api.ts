import { onRequest } from 'firebase-functions/v2/https';


export const api = onRequest({
  region: 'us-central1',
  memory: '128MiB',
  timeoutSeconds: 10,
}, (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});
