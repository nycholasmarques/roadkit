# Sincronizar com o GitHub

[English](en/sync.md) · **Português**

O progresso do Roadkit fica no servidor, na pasta `data/` (no Docker, num volume). Isso é ótimo enquanto você usa uma máquina só. A sincronização guarda uma cópia de tudo numa pasta de um repositório seu no GitHub, para você usar a mesma trilha em outro computador, ter um backup fora da máquina e, de quebra, o histórico do Git de cada mudança.

Ela vem **desligada**. Até você configurar, o servidor não faz nenhuma chamada para fora.

## O que vai junto

O progresso (tópicos, tarefas e projetos), as notas, a atividade (o que alimenta a tela Hoje e as estatísticas), a fila de revisão, os roadmaps criados na interface e a lista de ocultos. Os roadmaps que você mantém em arquivos na pasta `roadmaps/` não vão: eles já estão onde você os versiona.

Tudo cai numa pasta só, que você escolhe (o padrão é `roadkit/`):

```
roadkit/
  roadkit-sync.json         a versão do formato e os aparelhos que já sincronizaram
  state/<id>.json           progresso
  notes/<id>.json           notas
  activity/<id>.json        atividade
  review.json               revisão espaçada
  hidden.json               roadmaps ocultos
  roadmaps/...              roadmaps criados na interface
```

Os JSONs vão formatados e com as chaves em ordem, então o diff de um commit mostra só o que mudou. **A sincronização nunca mexe em nada fora dessa pasta**, então dá para usar o mesmo repositório em que você guarda outras coisas.

## Configurando

Nos ajustes, em **Sincronização**, clique em **Configurar...**. São três passos na mesma tela.

### 1. Confirme que é você

O servidor escreve um código de seis dígitos no próprio log. Clique em **Gerar código** e veja:

```bash
docker compose logs roadmap | tail -5
```

(sem Docker, o código aparece no terminal em que o servidor está rodando). O código vale 10 minutos, serve uma vez e se perde depois de cinco tentativas erradas. Por que isso existe está em [Segurança](#segurança). Se o seu servidor usa `ROADKIT_TOKEN`, este passo não aparece.

### 2. Destino

O repositório (`dono/nome`, ou o link dele), a branch (`main`) e a pasta (`roadkit`). Um nome para o aparelho é opcional e aparece nas mensagens de commit.

O repositório precisa existir, e pode estar vazio. **Use um repositório privado**: as suas notas e o seu progresso vão para lá.

### 3. Token

O Roadkit usa um *fine-grained personal access token*, que você cria e controla:

1. Clique em **Criar o token no GitHub**. A página abre com nome, validade de 90 dias e a permissão **Contents: Read and write** já preenchidos.
2. Em **Repository access**, escolha **Only select repositories** e marque só o repositório de destino.
3. Gere, copie e cole no campo **Token**.

Esse token só consegue ler e escrever arquivos naquele repositório. Ele não vê os seus outros repositórios, não mexe em issues, nem na sua conta. Um token clássico (`ghp_...`) também funciona, mas a tela avisa: ele vale para todos os seus repositórios.

**Testar conexão** confere tudo antes de salvar: se o token funciona, se alcança o repositório, se pode escrever e se o repositório é privado. Depois, **Salvar**, e a primeira sincronização começa na hora.

## Manual ou automática

- **Manual**: o botão **Sincronizar agora** nos ajustes envia e baixa o que mudou.
- **Automática**: o servidor cuida sozinho, mesmo com a aba fechada. Ele envia 2 minutos depois da última mudança (uma sessão de estudo com várias marcações vira um commit só) e baixa a cada 15 minutos e quando o servidor sobe. Baixar quando nada mudou não gasta a cota do GitHub.

A linha de status embaixo da opção diz o que está acontecendo: "Sincronizado com dono/repo há 3 min", um erro com a próxima tentativa, ou "Pausada" e por quê. Quando a sincronização precisa de você, um pontinho aparece no botão dos ajustes. Não há janelas pulando nem avisos no meio da tela.

## Em outra máquina

Suba o Roadkit, configure a sincronização com o **mesmo** repositório, branch e pasta, e pronto: a primeira sincronização baixa tudo. Se essa máquina também já tinha progresso, o Roadkit pergunta antes de mexer:

- **Mesclar (recomendado)**: junta os dois lados com as regras abaixo.
- **Usar o do GitHub**: este aparelho fica igual à pasta.
- **Usar o deste aparelho**: a pasta fica igual a este aparelho.

## Quando os dois lados mudaram

A cada sincronização, o Roadkit compara três versões de cada arquivo: a da última sincronização, a deste aparelho e a do GitHub.

- Se só um lado mudou, vale esse lado. É assim que uma exclusão (um roadmap apagado com o progresso) chega às outras máquinas.
- Se um lado apagou e o outro mudou, fica a versão que mudou: nada some por engano.
- **Progresso, notas e revisão** mudados dos dois lados: vence o mais recente, a mesma regra que o servidor já usa com o navegador.
- **Atividade** mudada dos dois lados: os números se somam. Uma hora de foco em casa e outra no trabalho, no mesmo dia, dão duas horas.
- **Um roadmap da interface** editado nas duas máquinas antes de sincronizar: fica o deste aparelho, e o do GitHub é guardado em `data/_sync/conflicts/`, com um aviso no status.

Se outra máquina sincronizar no meio do caminho, ou se você marcar um tópico enquanto a sincronização roda, o Roadkit simplesmente lê de novo e junta outra vez.

## Erros e pausas

| Status | O que fazer |
|---|---|
| sem conexão com o GitHub | nada: ele tenta de novo sozinho, esperando cada vez mais (de 1 minuto até 1 hora) |
| o GitHub pediu para esperar | nada: ele respeita o tempo que o GitHub pedir |
| o GitHub recusou o token | o token expirou ou foi revogado: crie outro e troque em **Alterar destino** |
| o token não alcança o repositório | confira se o repositório está marcado no token e se a permissão é **Read and write** |
| o repositório ficou público | se foi de propósito, confirme em **Alterar destino**; se não, volte para privado |
| escolha como juntar os dados | clique em **Sincronizar agora** e escolha |
| versão mais nova do Roadkit | a pasta foi gravada por uma versão mais nova: atualize este Roadkit |

Uma pausa não tenta de novo sozinha, porque insistir não resolveria. Sete dias antes de o token expirar, o status avisa.

**Desconectar** (em **Alterar destino**) apaga o token e a configuração deste servidor. Os seus dados aqui e no GitHub ficam como estão.

## Segurança

Esta é a primeira coisa no Roadkit que fala com a internet, e com um segredo que dá escrita num repositório seu. Por isso:

- **Para onde fala**: só `https://api.github.com`. O endereço é fixo no código; nada que você digite ou que venha de um roadmap muda para onde o servidor se conecta. O certificado é sempre verificado, redirecionamentos nunca são seguidos, e cada resposta tem limite de tempo e de tamanho.
- **O token** fica só no servidor, em `data/_sync/secret.json`, legível apenas pelo usuário do servidor. Nenhuma resposta da API o devolve, nem parte dele; ele não aparece em log, mensagem de erro, export, zip, Markdown, página para compartilhar nem na pasta sincronizada. O navegador manda o token uma vez e apaga o campo; nada fica guardado no navegador.
- **O código de pareamento** existe porque o risco real é outro: alguém que alcança o seu Roadkit pela rede trocar o destino pelo repositório dele e receber as suas notas. Só quem vê o log do servidor consegue o código. Mudar só entre manual e automática, ou pedir uma sincronização, não exige o código, porque não muda para onde os dados vão.
- **Repositório público** só com a sua confirmação explícita, e a confirmação vale para aquele repositório. Se ele virar público depois, a sincronização pausa.
- **O que vem do GitHub é tratado como dado de fora.** O repositório pode ter sido editado por outra pessoa, pela interface do GitHub ou com um token vazado. Por isso cada arquivo passa pelas mesmas validações de quando o navegador grava (e os roadmaps pelo `check`) antes de chegar em `data/`. Caminhos estranhos, links simbólicos e qualquer coisa fora da pasta são ignorados. Um arquivo inválido é pulado e aparece no status, sem apagar a versão local.

O que isso **não** protege: quem tem acesso ao repositório lê tudo o que está nele. Não há criptografia de ponta a ponta. Um repositório privado e um token só para ele são a proteção.

### Sem colar o token na tela

Se preferir, defina o token pelo ambiente, e a tela mostra "Definido pelo ambiente" no lugar do campo:

```
ROADKIT_SYNC_TOKEN=github_pat_...
```

Ou, com Docker secrets, aponte um arquivo com `ROADKIT_SYNC_TOKEN_FILE=/run/secrets/roadkit_sync`. Os detalhes estão em [Docker e rede](docker-e-rede.md#sincronização-com-o-github).

## Os arquivos da sincronização

Tudo o que é da sincronização fica em `data/_sync/`, que nunca é servido nem sincronizado:

| Arquivo | O que guarda |
|---|---|
| `config.json` | destino, modo, nome do aparelho e a confirmação de repositório público |
| `secret.json` | o token |
| `base.json` | o que os dois lados tinham em comum na última sincronização |
| `status.json` | a última sincronização, o último erro e a próxima tentativa |
| `conflicts/` | as cópias de roadmaps editados nos dois lados |

Apagar `base.json` faz a próxima sincronização ser tratada como a primeira (com a pergunta de como juntar). As rotas da API estão em [Como funciona](como-funciona.md#a-api).
