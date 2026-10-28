// A distributable release must have a real publisher identity and a signing certificate.
const required = ['PULSE_PUBLISHER_NAME', 'CSC_LINK', 'CSC_KEY_PASSWORD'];
const missing = required.filter(key => !process.env[key]?.trim());
if (missing.length) {
  console.error('Release assinada bloqueada. Configure no CI: ' + missing.join(', ') + '. Não coloque valores no código.');
  process.exit(1);
}
