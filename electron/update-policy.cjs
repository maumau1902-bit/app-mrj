// The renderer cannot choose a feed or disable publisher verification.
function updatePolicy({ packaged, platform, config }) {
  if (!packaged || platform !== 'win32') return { enabled: false, disabledReason: 'Atualizações internas estão disponíveis no aplicativo Windows instalado.' };
  const publishers = Array.isArray(config?.publisherName) ? config.publisherName : [config?.publisherName];
  if (config?.provider !== 'github' || config.owner !== 'maumau1902-bit' || config.repo !== 'app-mrj' ||
      !publishers.length || !publishers.every(p => typeof p === 'string' && p.trim())) {
    return { enabled: false, disabledReason: 'Este pacote de teste não tem um canal de atualização assinado configurado.' };
  }
  return { enabled: true };
}
module.exports = { updatePolicy };
