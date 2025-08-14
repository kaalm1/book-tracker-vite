
import { onCall } from 'firebase-functions/v2/https';


export const healthCheck = onCall({
  region: 'us-central1',
  memory: '128MiB',
  timeoutSeconds: 10,
}, async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: '2.0.0'
}));
