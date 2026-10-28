# Pulse Analytics

Aplicativo de análise empresarial para Windows, com identidade em vermelho e laranja. Versão de teste 0.2.0: empresas por abas, cadastros locais, indicadores demonstrativos e instalador de um clique.

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

## Atualizações internas

O motor NSIS/electron-updater está implementado: consulta ao abrir e a cada 30 minutos, aviso compacto, opção de adiar, verificação manual, progresso, interrupção do download, instalação escolhida pelo usuário e reinício. Não instala ao simplesmente fechar o app.

O diferencial usa blocos `.blockmap`, não linhas de código. Pode baixar o pacote completo se o cache anterior ou um diferencial compatível não estiverem disponíveis. HTTPS, SHA-512 e verificação Authenticode permanecem ativos. No pacote sem assinatura o atualizador fica desativado, portanto **publicar uma versão no GitHub não atualiza automaticamente o aplicativo de teste instalado**.

`npm run test:differential -- <instalador-antigo.exe> <instalador-novo.exe>` reconstrói um pacote real por pedidos HTTP locais, verifica SHA-512 e confirma a rejeição de conteúdo adulterado. O HTTP é restrito ao teste. O tamanho transferido depende do par de pacotes e das opções de compressão. Essa verificação não substitui Authenticode nem instalação/reinício em Windows.

Para distribuição assinada, configure no GitHub a variável `PULSE_PUBLISHER_NAME` e os secrets `CSC_LINK`/`CSC_KEY_PASSWORD`. Nunca coloque os valores no código ou no chat. `npm run release:win` exige essas configurações. O workflow Windows gera um pacote assinado quando configurado, ou um pacote de teste sem assinatura. Inclui verificação de artefatos e instalação/abertura/desinstalação em runner hospedado descartável. Não afirme que esses testes Windows passaram antes de observar o resultado do workflow.

## Publicação automática autorizada

O usuário autorizou salvar e publicar automaticamente alterações concluídas e validadas.

```sh
npm run publish:test
```

Esse comando executa testes, gera/verifica o instalador e chama `scripts/publish-test.cjs`. O script salva o código com commit e push normal para main (sem force push), envia o binário por Git LFS na branch pulse-downloads preservando instaladores anteriores, publica uma prerelease com o link e baixa novamente os bytes para conferir SHA-256. Requer acesso Git/GitHub já configurado. Não inclui tokens no aplicativo.

Os downloads públicos ficam em `https://github.com/maumau1902-bit/app-mrj/releases`. O executável usa um link direto para a branch de distribuição. Git LFS é usado porque a autenticação da API de anexos de Releases respondeu 401 neste ambiente. As versões de teste permanecem sem atualização remota até configurar o canal assinado.
