# Pulse Analytics

Aplicativo de análise empresarial para Windows, com identidade em vermelho e laranja. Versão de teste 0.3.1: empresas por abas, cadastros locais, indicadores demonstrativos e instalador de um clique.

## Desenvolvimento e testes

Requer Node.js 24 e npm. O usuário final do instalador não precisa instalar Node.js.

```sh
npm ci
npm test
npm run test:desktop
npm run test:companies
npm run dev -- --port 5173
```

`npm run build` gera o frontend. `npm run desktop` abre a janela Electron com arquivos locais. No cloud, `test:desktop` e `test:companies` usam modo headless apenas nos testes. Se o binário Electron estiver ausente:

```sh
NODE_USE_ENV_PROXY=1 electron_config_cache=/workspace/.cache/electron node node_modules/electron/install.js
```

Os 13 testes unitários cobrem empresas e atualização. O teste desktop cobre recursos locais, indicadores, busca, preload isolado e proteção da instalação. O teste de empresas cadastra quatro empresas, alterna abas, recarrega o aplicativo, edita dados, valida nomes duplicados, testa logos isolados e verifica o painel sem rolagem nas resoluções 1024×768, 1280×720, 1366×768 e 1920×1080. Em celular há fluxo vertical e abas com rolagem própria.

## Empresas e conexões

As abas no topo permitem alternar manualmente entre empresas. A empresa selecionada aparece também na lateral e no cabeçalho, e permanece selecionada ao reabrir.

O cadastro inclui nome da aba (obrigatório e distinto), razão social, CNPJ/identificação, cidade/UF, identificador no Mithra e observações. Editar preserva o ID interno. Cada empresa tem seu logo e sua preferência de demonstração. Imagens de até 2 MB são redimensionadas para até 256 px e salvas no perfil local. O logo global das versões antigas migra apenas para a primeira empresa.

Novas empresas começam sem vendas ou histórico. Há uma opção explícita no cadastro para usar dados fictícios. Nenhum dado real de outra empresa é usado. CSV inclui nome, ID e identificação da empresa selecionada, com nome de arquivo próprio.

Os cadastros ficam no dispositivo, em `pulse-companies-v1` no armazenamento local do perfil Electron. Não são sincronizados entre computadores nem representam uma barreira de autorização. Dados não são sobrescritos silenciosamente quando o armazenamento falha ou contém uma versão desconhecida.

**Login, credenciais e conexão real ao Mithra estão pendentes.** Identificador Mithra é apenas uma referência cadastral, não uma conexão ativa. Não coloque senhas no frontend. Arthur/fornecedor precisa confirmar API ou acesso de leitura, documentação e escopo da empresa; credenciais reais devem ficar no backend.

## Indicadores

Vendas, unidades, dinheiro, ticket médio, lucro bruto, comissões, histórico, previsão e relatórios CSV. Períodos, metas e histórico de demonstração são fixos. Comissão de exemplo: 3% das vendas. Lucro bruto: vendas menos custo dos produtos, sem impostos/despesas. Previsão: média de sete dias ilustrativos × 30.

## Instalador Windows

```sh
npm run dist:win
npm run verify:artifacts
```

Saída: `release/Pulse-Analytics-Setup-0.2.0-x64.exe`. Instalador NSIS por usuário, com runtime incluído, atalhos, desinstalador e abertura ao concluir. Preserve o appId `com.pulseanalytics.desktop`, o nome do app e o perfil Electron entre versões. Instale por cima da versão anterior para preservar cadastros. A desinstalação não apaga os dados do perfil por padrão.

No cloud Linux, use caches graváveis:

```sh
ELECTRON_CACHE=/workspace/.cache/electron ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder XDG_CACHE_HOME=/workspace/.cache npm run dist:win
```

`patch-package` aplica uma correção de uma linha no `app-builder-lib@26.18.0`, permitindo usar no Linux o leitor nativo de desinstalador NSIS já fornecido para macOS, sem Wine. O caminho de compilação Windows e as verificações de assinatura permanecem preservados. A versão da ferramenta está fixada; o patch falha explicitamente se ficar incompatível. Os pacotes mantêm os idiomas português do Brasil e inglês.

Os instaladores locais de teste não têm assinatura digital; o Windows pode mostrar editor desconhecido. Compilação, estrutura e hashes são verificados aqui; a instalação e o reinício desta versão precisam de homologação no Windows. O usuário confirmou que a 0.1.1 abriu no seu Windows.

## Atualizações internas (ativas desde 0.3.0)

O Windows instalado consulta o catálogo público assinado ao abrir e a cada 30 minutos. Permite aviso compacto, adiar, verificar manualmente, baixar, interromper, instalar e reiniciar. Não instala ao simplesmente fechar. No navegador e no Electron de desenvolvimento essa função permanece desabilitada por ser exclusiva do aplicativo instalado.

A confiança é Ed25519, com chave pública embutida e catálogo assinado contendo versão, plataforma, tamanho, URL fixa e SHA-512. A biblioteca electron-updater usa o provider customizado suportado, NSIS e diferenciais por blocos; não transmite tokens ou credenciais. A assinatura do catálogo é obrigatória antes de aceitar uma versão; o arquivo é conferido depois do download e novamente antes de executar o instalador, inclusive se veio do cache. Downgrade é recusado.

A assinatura de atualização é independente do certificado Authenticode do Windows. A ausência deste certificado não desativa mais as atualizações assinadas Ed25519, mas o Windows ainda pode mostrar editor desconhecido na instalação manual. Se existe um editor Authenticode configurado, sua verificação também permanece ativa. Não desative TLS, checksums ou assinaturas para contornar falhas.

Versões até 0.2.0 exigem instalar a nova base manualmente uma vez. A partir de 0.3.0, novas publicações assinadas ficam disponíveis dentro do aplicativo. O download diferencial depende do cache e da compatibilidade dos pacotes; há fallback para download completo.

## Publicação automática autorizada

O usuário autorizou salvar e publicar automaticamente alterações concluídas e validadas.

```sh
npm run publish:test
```

Esse comando executa testes, gera/verifica o instalador e chama `scripts/publish-test.cjs`. O script salva o código com commit e push normal para main (sem force push), envia o binário por Git LFS na branch pulse-downloads preservando instaladores anteriores, publica uma prerelease com o link e baixa novamente os bytes para conferir SHA-256. Requer acesso Git/GitHub já configurado. Não inclui tokens no aplicativo.

Os downloads públicos ficam em `https://github.com/maumau1902-bit/app-mrj/releases`. O executável usa um link direto para a branch de distribuição. Git LFS é usado porque a autenticação da API de anexos de Releases respondeu 401 neste ambiente. O canal assinado foi ativado a partir de 0.3.0; as versões antigas continuam exigindo uma instalação manual de migração.

## Canal de atualização autenticado (a partir da 0.3.0)

Atualizações estão ATIVAS no aplicativo Windows instalado a partir de 0.3.0. A confiança usa Ed25519: chave pública embutida no executável; catálogo assinado contendo versão, tamanho, URL fixa e SHA-512. O provider customizado é uma extensão suportada do electron-updater. O NSIS continua responsável por instalar/reiniciar e a biblioteca conserva download diferencial, cancelamento, validação de checksum e recusa a downgrade. A assinatura Ed25519 é obrigatória mesmo para arquivos em cache, com nova verificação antes de executar o instalador. Authenticode também é conferido quando existe editor Windows configurado. Esta assinatura de atualização não elimina o aviso de editor desconhecido do Windows em instaladores sem certificado Authenticode.

A chave privada foi gerada em /workspace/.pulse-signing/update-private.pem, fora do repositório e com modo 600; nunca publique ou imprima seu conteúdo. Preserve esse arquivo em armazenamento privado para futuras publicações. PULSE_UPDATE_SIGNING_KEY_PATH permite apontar para uma cópia segura. A perda da chave impede assinar novas atualizações para essa identidade; o script recusa trocar automaticamente uma chave pública já distribuída. Em outro ambiente restaure a mesma chave por configuração segura. Não coloque valores em scripts ou no chat.

`node scripts/sign-update.cjs` assina e verifica os artefatos. A publicação inclui pulse-latest.json e pulse-<versão>.json, mais os blockmaps e o instalador. O app consulta o catálogo público por HTTPS, sem tokens. A publicação deve manter a identidade e o perfil do app. Versões 0.2.0 e anteriores exigem instalar manualmente a nova base uma vez.

O workflow Windows live update instala a base 0.3.0, usa o canal público para atualizar até a versão do checkout, confere o download/assinatura, o encerramento, a versão instalada, o reinício e a preservação da empresa selecionada. Só afirme que passou após observar o resultado do runner. O teste exige uma versão publicada superior a 0.3.0 no feed.

A tentativa de guardar uma cópia da chave em GitHub Actions Secrets foi recusada pela integração (403). A chave privada original permanece no diretório privado deste ambiente; não alegue que há backup no GitHub. Preserve o arquivo ao publicar o snapshot do ambiente e faça backup por um canal seguro. A chave pública permanece no repositório.
