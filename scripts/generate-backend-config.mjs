import {writeFile} from 'node:fs/promises';

const provider = process.env.HANSOL_CUSTOMER_BACKEND || 'supabase';
if (!['supabase', 'neon'].includes(provider)) {
  throw new Error('HANSOL_CUSTOMER_BACKEND must be "supabase" or "neon".');
}

const config = {
  customerProvider: provider,
  supabase: {
    url: process.env.SUPABASE_URL || 'https://bmrtppizatuahnpjuren.supabase.co',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dJgpSlIXsODI_I5GHnXcJQ_84iG4c3J',
  },
  neon: {
    authUrl: process.env.NEON_AUTH_URL || 'https://ep-still-bar-bic6rvg9.neonauth.c-5.ap-southeast-1.aws.neon.tech/neondb/auth',
    dataUrl: process.env.NEON_DATA_API_URL || 'https://ep-still-bar-bic6rvg9.apirest.c-5.ap-southeast-1.aws.neon.tech/neondb',
  },
};

await writeFile('backend-config.js', `window.hansolBackendConfig = Object.freeze(${JSON.stringify(config, null, 2)});\n`);
console.log(`Generated backend-config.js for ${provider}.`);
