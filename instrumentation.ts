export async function register() {
  const { validateEnv } = await import('./lib/env');
  const result = validateEnv();
  if (!result.valid) {
    console.error('⚠️ Server starting with missing env vars:', result.missing.join(', '));
  }
}
