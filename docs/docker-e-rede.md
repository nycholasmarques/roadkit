# Docker e rede

## Subindo com o Compose

```bash
docker compose up -d --build     # http://localhost:8765
docker compose logs -f
docker compose down
```

A imagem é a `python:3.12-slim` com o Roadkit por cima, sem nenhuma dependência. O serviço reinicia sozinho (`restart: unless-stopped`), roda como um usuário sem privilégios, sem capabilities extras e com 128 MB de memória, que sobra.

## O que fica onde

| Dentro do contêiner | De onde vem | Para que serve |
|---|---|---|
| `/app/roadmaps` | a pasta `./roadmaps`, montada **somente leitura** | os seus roadmaps em arquivo |
| `/app/data` | o volume `roadkit-data` | o progresso e os roadmaps criados pela interface |
| `/app/examples`, `/app/src`... | dentro da imagem | os exemplos e o próprio programa |

Criou ou editou um JSON em `./roadmaps`? Só recarregar a página, sem rebuild. Mexeu em `src/` ou `tools/`? Aí precisa do `docker compose up -d --build` de novo.

O volume `roadkit-data` sobrevive a `down`, a rebuild e a recriar o contêiner. Só `docker compose down -v` apaga. Por isso é um volume nomeado e não uma pasta do projeto: o Docker cria pastas montadas como root, e o usuário do contêiner não conseguiria escrever nelas.

## Backup do que está no volume

```bash
docker run --rm -v roadkit_roadkit-data:/d -v "$PWD":/b alpine \
  tar czf /b/roadkit-dados.tgz -C /d .
```

Dentro do zip fica um arquivo por roadmap com progresso (`<id>.json`), a pasta `roadmaps/` com o que foi criado na interface, e o `_hidden.json` com a lista dos ocultos. Para restaurar, o mesmo comando ao contrário, com `tar xzf`.

Se você prefere só o progresso de um roadmap, o botão **Exportar** da interface já faz isso, de um em um.

## Abrindo para outros aparelhos

Por padrão a porta escuta só em `127.0.0.1`, ou seja, só a própria máquina acessa. Para usar do celular ou de outro computador da casa, crie um arquivo `.env` ao lado do `compose.yaml`:

```
BIND_ADDR=0.0.0.0
PORT=8765
ROADKIT_TOKEN=uma-frase-qualquer-que-só-você-saiba
```

Com o token definido, o servidor exige `Authorization: Bearer <token>` para ler e gravar progresso e para criar, editar ou excluir roadmaps. O navegador pergunta o token uma vez e guarda. Os roadmaps (os de arquivo e os criados na interface) e a própria interface continuam abertos para quem alcançar a porta, porque são só JSONs e HTML. O token protege o progresso e as alterações.

Alguns limites, para ficar claro o que isso é e o que não é:

- O servidor é o `http.server` do Python, feito para uso pessoal. Não coloque na internet. Dentro da rede de casa está bem; fora dela, ponha atrás de uma VPN (WireGuard, Tailscale) ou de um proxy reverso com HTTPS e autenticação.
- Sem HTTPS, o token trafega em texto puro na sua rede. Na rede de casa o risco é pequeno, mas é bom saber.
- Escrita só é aceita de páginas servidas pelo próprio servidor: requisições que vêm de outro site são recusadas. Isso protege você de uma página qualquer tentar mexer no seu progresso enquanto o Roadkit está aberto.

## Sem Docker

```bash
python3 tools/roadkit.py serve --host 0.0.0.0 --port 8765
```

Funciona igual. Duas variáveis de ambiente mudam o comportamento: `ROADKIT_DATA` aponta outra pasta para os dados (o padrão é `data/` ao lado do projeto) e `ROADKIT_TOKEN` liga a exigência de token.
