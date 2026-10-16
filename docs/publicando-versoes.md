# Publicando versões

Cada versão do Roadkit vira uma release no GitHub a partir de uma tag. Você sobe a tag, e o resto é com a automação: ela cria a release com as notas, anexa um zip do código e publica a imagem Docker.

## Que número dar

O projeto segue o [versionamento semântico](https://semver.org/lang/pt-BR/): `MAIOR.MENOR.CORREÇÃO`.

- **Correção** (`1.0.1`): conserta algo sem mudar o que existe.
- **Menor** (`1.1.0`): acrescenta algo que não quebra nada. Um campo novo e opcional no JSON, um botão novo, um endpoint novo.
- **Maior** (`2.0.0`): quebra algo que já funcionava. Um campo do JSON que muda de significado, um endpoint que sai, um roadmap válido que deixa de ser.

O que conta como "o contrato" é o formato do JSON dos roadmaps (veja o [`SCHEMA.md`](SCHEMA.md)) e a API do servidor (em [Como funciona](como-funciona.md#a-api)). Mexer no visual ou no código por dentro não muda a versão maior.

## O caminho de uma release

As notas da release se escrevem sozinhas: o workflow junta os commits desde a release anterior, agrupa por tipo e monta o texto. Não precisa mexer em nenhum arquivo para publicar. Então o caminho mais curto é:

1. Espere o CI da `main` ficar verde.
2. Em *Actions → Release → Run workflow*, digite a versão sem o `v` (por exemplo `1.1.0`) e confirme. O próprio workflow cria a tag `v1.1.0` e publica tudo.

Se preferir pela linha de comando, é só criar e subir a tag; o resultado é o mesmo:

```bash
git tag -a v1.1.0 -m "Roadkit 1.1.0"
git push origin v1.1.0
```

Em um ou dois minutos a release aparece em *Releases*, e a imagem Docker em alguns minutos a mais, por causa do build para duas arquiteturas. Uma versão com sufixo, como `1.2.0-rc.1`, vira *pre-release* e não ganha a etiqueta `latest` no Docker.

### De onde vêm as notas

O texto da release tem até três partes, nesta ordem:

1. **Destaques escritos por você** (opcional): se o [`CHANGELOG.md`](../CHANGELOG.md) tem uma seção `## [1.1.0] - data`, ela vai no topo. Serve para contar o que importa em linguagem de gente, e é o que foi usado na 1.0.0.
2. **O que mudou** (automático): cada commit entre a release anterior e esta, em grupos: Novidades, Correções, Desempenho, Documentação, Dependências, Manutenção e Outras mudanças. As duas últimas vêm recolhidas. Cada linha leva o link do commit, ou do pull request quando o título termina com `(#12)`, e no fim há um link para comparar as duas versões. Na primeira release essa parte não aparece, porque listaria o projeto inteiro.
3. **Como instalar**: o zip, o checksum e o comando `docker pull` da versão.

O agrupamento lê o começo do título do commit (ou do PR, que vira o commit quando você faz *squash*). Dá para ajudar escrevendo no estilo [Conventional Commits](https://www.conventionalcommits.org/pt-br/): `feat: botão de exportar`, `fix: erro ao importar zip`, `docs: explica as categorias`, `chore: atualiza o CI`. Um `feat(deps):` ou o Dependabot caem em Dependências, e um `!` depois do tipo (`feat!: ...`) marca uma quebra de compatibilidade. Sem prefixo ainda funciona: títulos que começam com "Add", "Fix" e parecidos são reconhecidos, e o resto vai para "Outras mudanças".

Dá para ver como ficaria antes de publicar:

```bash
python3 .github/scripts/release_notes.py v1.1.0 nycholasmarques/roadkit
```

(Ele precisa de uma tag `v1.1.0` local para comparar. Para um teste, crie a tag, rode e apague.)

## O CI

O [`ci.yml`](../.github/workflows/ci.yml) roda a cada push na `main` e em todo pull request, e confere o que mais costuma quebrar sem ninguém notar:

- os roadmaps e os exemplos passam no `check`, e o `manifest.json` do repositório está atualizado (se não estiver, o erro diz para rodar `python3 tools/roadkit.py index`);
- os textos da interface têm as mesmas chaves em todos os idiomas, e toda chave usada no `index.html` existe;
- o JavaScript e o Python são sintaticamente válidos;
- o servidor sobe, lista roadmaps, valida, cria, lê, salva progresso e exclui, e recusa escritas de outra origem;
- a imagem Docker constrói e responde.

O trabalho principal se chama `check`, e o do Docker, `docker`. Esses dois nomes são os que a proteção da `main` exige, então se você renomear um, ajuste a regra nas configurações.

## Proteção da main

As regras de proteção moram nas configurações do repositório, não no código, então não há arquivo para commitar. O que eu uso, em *Settings → Rules → Rulesets*, para a `main`:

- bloquear exclusão e reescrita de histórico (*Restrict deletions* e *Block force pushes*);
- exigir pull request antes de entrar (*Require a pull request before merging*), sem exigir aprovação, já que num projeto de uma pessoa só não haveria quem aprovar;
- exigir que o CI passe (*Require status checks to pass*), com os trabalhos `check` e `docker`.

Para as tags `v*`, vale um ruleset que impeça apagar ou mover (*Restrict deletions* e *Restrict updates*), para uma versão publicada nunca mudar por engano.

Um efeito prático: com isso ligado, nada entra direto na `main`. O fluxo vira branch, pull request, CI verde e merge. Quem tem papel de administrador pode contornar a regra, se você o colocar na lista de bypass.
