# Publicando versões

Cada versão do Roadkit vira uma release no GitHub a partir de uma tag. Você sobe a tag, e o resto é com a automação: ela cria a release com as notas, anexa um zip do código e publica a imagem Docker.

## Que número dar

O projeto segue o [versionamento semântico](https://semver.org/lang/pt-BR/): `MAIOR.MENOR.CORREÇÃO`.

- **Correção** (`1.0.1`): conserta algo sem mudar o que existe.
- **Menor** (`1.1.0`): acrescenta algo que não quebra nada. Um campo novo e opcional no JSON, um botão novo, um endpoint novo.
- **Maior** (`2.0.0`): quebra algo que já funcionava. Um campo do JSON que muda de significado, um endpoint que sai, um roadmap válido que deixa de ser.

O que conta como "o contrato" é o formato do JSON dos roadmaps (veja o [`SCHEMA.md`](SCHEMA.md)) e a API do servidor (em [Como funciona](como-funciona.md#a-api)). Mexer no visual ou no código por dentro não muda a versão maior.

## O caminho de uma release

1. **Escreva o que mudou** no [`CHANGELOG.md`](../CHANGELOG.md), numa seção nova no topo, com o número e a data:

   ```markdown
   ## [1.1.0] - 2026-11-20

   ### Interface
   - O que mudou, em linguagem de gente.
   ```

   O texto dessa seção vira o corpo da release. Se a seção não existir, a release sai com as notas geradas a partir dos commits, e o workflow avisa. Vale acrescentar também a linha do link no fim do arquivo (`[1.1.0]: https://github.com/.../releases/tag/v1.1.0`).

2. **Faça o commit** na `main` (ou passe por um pull request, se a proteção estiver ligada) e espere o CI ficar verde.

3. **Crie a tag e suba:**

   ```bash
   git tag -a v1.1.0 -m "Roadkit 1.1.0"
   git push origin v1.1.0
   ```

4. **Acompanhe na aba Actions.** Em um ou dois minutos a release aparece em *Releases*, e a imagem Docker em alguns minutos a mais, por causa do build para duas arquiteturas.

A tag precisa ter o formato `vX.Y.Z`. Uma tag com sufixo, como `v1.2.0-rc.1`, vira *pre-release* e não recebe a etiqueta `latest` no Docker.

## O que o workflow faz

O arquivo é o [`release.yml`](../.github/workflows/release.yml), e são dois trabalhos:

**release** confere o formato da tag, avisa se o commit não passou no CI, tira do `CHANGELOG.md` a seção da versão, gera o zip do código (`roadkit-1.1.0.zip`, sem as imagens da documentação, então fica com uns 100 KB) e um `SHA256SUMS`, e cria a release com tudo isso.

**docker** monta a imagem para `linux/amd64` e `linux/arm64` (dá para rodar num Raspberry Pi) e publica em `ghcr.io/nycholasmarques/roadkit` com três tags: `1.1.0`, `1.1` e `1`. Versões finais também ganham `latest`.

Na primeira vez, o pacote no GHCR nasce privado. Para qualquer pessoa conseguir puxar a imagem, vá em *Packages → roadkit → Package settings* e mude a visibilidade para pública.

Se alguma coisa falhar depois de a tag existir, não precisa apagar nem mover a tag: corrija, e rode o workflow de novo em *Actions → Release → Run workflow*, informando a tag.

## O CI

O [`ci.yml`](../.github/workflows/ci.yml) roda a cada push na `main` e em todo pull request, e confere o que mais costuma quebrar sem ninguém notar:

- os roadmaps e os exemplos passam no `check`, e o `manifest.json` do repositório está atualizado (se não estiver, o erro diz para rodar `python3 tools/roadkit.py index`);
- os textos da interface têm as mesmas chaves em todos os idiomas, e toda chave usada no `index.html` existe;
- o JavaScript e o Python são sintaticamente válidos;
- o servidor sobe, lista roadmaps, valida, cria, lê, salva progresso e exclui, e recusa escritas de outra origem;
- a imagem Docker constrói e responde.

O trabalho principal se chama `check`, e o do Docker, `docker`. Esses dois nomes aparecem na proteção da `main`, então se você renomear um, ajuste o ruleset.

## Proteção da main e das tags

O GitHub guarda as regras de proteção nas configurações do repositório, fora do código, então elas não vêm junto de um commit. Por isso deixei as regras prontas em [`.github/rulesets/`](../.github/rulesets/), para você importar com dois cliques:

1. No repositório, *Settings → Rules → Rulesets → New ruleset → Import a ruleset*.
2. Escolha `main.json`, confira e clique em *Create*. Repita com `tags.json`.

Se o CI ainda não rodou nenhuma vez, as checagens `check` e `docker` aparecem como "esperando". Faça um push (ou abra um pull request) e elas passam a existir.

**`main.json`** impede apagar a `main` e reescrever o histórico, e exige que as mudanças entrem por pull request com o CI verde. Não pede aprovação de revisão, porque sem outra pessoa no projeto você não conseguiria aprovar o seu próprio PR. Quem tem o papel de administrador (você) pode contornar a regra e subir direto, o que é o que a opção `bypass_mode: always` faz. É uma rede de segurança contra acidente, não uma trava contra você.

**`tags.json`** impede apagar ou mover tags `v*`, para uma versão publicada nunca mudar de conteúdo por engano.

Se preferir configurar à mão: *Settings → Branches → Add branch ruleset*, alvo `main`, e marque *Restrict deletions*, *Block force pushes*, *Require a pull request before merging* e *Require status checks to pass* (com `check` e `docker`). Em *Bypass list*, adicione o papel *Repository admin*.

Uma consequência prática: com a regra de pull request ligada, quem não é administrador não consegue mais subir direto na `main`, e é isso que se quer. Se alguma ferramenta sua faz push direto e deixar de funcionar, é por causa disso.
