# Como funciona

O Roadkit tem duas partes bem separadas: uma página que faz quase tudo no navegador, e um servidor em Python que é pequeno de propósito. Entender onde cada coisa mora ajuda a saber o que vai acontecer quando você mexe em algo.

## O desenho geral

A página não sabe nada sobre estudar Rust ou correr uma meia maratona. Ela abre um JSON, lê o que está escrito (título, fases, tópicos, cores, idioma) e desenha. Trocar o JSON troca o roadmap inteiro, sem tocar no código. É essa a graça.

O servidor (`tools/roadkit.py`) faz quatro coisas:

1. Entrega os arquivos da interface.
2. Monta a lista de roadmaps disponíveis, o `manifest.json`, olhando as pastas.
3. Guarda o progresso de cada roadmap.
4. Guarda os roadmaps criados pela interface, e valida roadmaps (o mesmo `check` da linha de comando).

Só usa a biblioteca padrão do Python. Não tem banco de dados, não tem etapa de build e não tem dependência para instalar.

## O que acontece ao abrir um roadmap

1. O navegador pede o `manifest.json`. O servidor percorre `roadmaps/` (e a pasta de dados), lê o título, o ícone, a contagem de tópicos e outras coisas de cada JSON, e responde com a lista, já organizada em seções por pasta. Cada roadmap leva também um índice leve dos seus tópicos e projetos (id, título e fase ou nível), que é o que a busca do `Ctrl+K` usa para achar coisas em todos os roadmaps sem baixar cada JSON.
2. Você escolhe um roadmap (ou a URL traz `?r=<id>`) e o navegador baixa aquele JSON.
3. O JSON passa por uma leitura tolerante (`normalize`, em `src/app.js`): ids repetidos são ignorados, fases desconhecidas viram a primeira, ciclos de pais são cortados. A ideia é abrir mesmo um arquivo imperfeito e dizer o que estranhou no console. Quem cobra rigor é o `check`.
4. Uma segunda coisa acontece em paralelo: o navegador pergunta ao servidor pelo progresso salvo daquele roadmap e o aplica.
5. O mapa é desenhado.

## O layout não está no JSON

O JSON não tem coordenadas. Os tópicos principais descem em ordem pela coluna do meio, agrupados por fase. Os filhos de cada tópico ocupam colunas à direita, uma por nível. A posição de cada cartão é calculada no navegador, a partir da altura real que o texto ocupa. Por isso mudar o tamanho da fonte reorganiza o mapa, e um roadmap com títulos longos simplesmente fica mais alto.

Em telas largas o mapa é desenhado num espaço fixo e escalado para caber. Em telas estreitas (menos de 860 px de largura útil) o layout muda para uma linha do tempo de uma coluna, com os filhos indentados embaixo do pai.

## Onde o progresso é guardado

O progresso é um objeto pequeno: o estado de cada tópico e de cada tarefa (`todo`, `working`, `review` ou `finished`) e, quando o roadmap tem projetos, o estado de cada projeto com os requisitos marcados e o link do seu repositório. Ele existe em dois lugares ao mesmo tempo.

**No servidor**, num arquivo por roadmap: `data/<id>.json`. É a fonte de verdade, e é por isso que o progresso vale em qualquer aparelho que abra a mesma instância.

**No navegador**, no `localStorage`, como cache. Cada marcação que você faz é gravada ali na hora, e a interface responde sem esperar a rede. Meio segundo depois, o navegador envia para o servidor.

Quando a página abre, ou quando você volta para a aba, o navegador pergunta ao servidor pela versão mais recente. Cada versão tem a hora da última alteração, e a mais nova ganha. Isso resolve o caso comum (você marcou algo no notebook, depois abre o celular), mas é simples de propósito: se duas pessoas alterarem o mesmo roadmap ao mesmo tempo, vale a última a gravar, sem mesclar tópico por tópico. Para uso pessoal é suficiente.

Se o servidor cair, nada se perde: o navegador continua funcionando com o cache, e sincroniza quando o servidor voltar. A última linha dos ajustes mostra em que estado isso está. Se você já tinha progresso salvo no navegador antes de existir o servidor, ele sobe na primeira vez. Se esse progresso antigo acabar substituído por uma versão do servidor (de outro aparelho, por exemplo), uma cópia dele fica guardada no navegador.

## Roadmaps de arquivo e roadmaps da interface

Os dois acabam como JSON, mas moram em lugares diferentes:

| | Arquivos | Criados na interface |
|---|---|---|
| Onde | `roadmaps/` (e `examples/`) | `data/roadmaps/` |
| Quem escreve | você, no editor de texto | o servidor, quando você salva no editor |
| Pelo Docker | montados somente leitura | no volume de dados |
| Editar e excluir pela interface | não (só ocultar) | sim |

Essa separação é o que permite montar `roadmaps/` como somente leitura no Docker: o servidor nunca escreve na sua pasta. As duas fontes se juntam na lista, e uma categoria (pasta) pode ter roadmaps das duas.

Quem decide a seção de um roadmap é a pasta. No editor, o campo Categoria escolhe a subpasta de `data/roadmaps/`. Se for uma categoria nova, o servidor cria a pasta e guarda o nome que você digitou num `_section.json`.

Os ocultos são só uma lista de ids em `data/_hidden.json`. Ocultar não apaga nem mexe no arquivo.

## Offline e instalável

O `src/sw.js` é um service worker pequeno, sem bibliotecas, servido em `/sw.js` com a versão do app (um hash dos arquivos da interface). Ele trata três tipos de pedido de jeitos diferentes:

- **Interface** (a página e `src/*`): instalada inteira de uma vez, numa cache com o nome da versão, e servida dela. Uma versão nova instala a sua cache, espera você aceitar o "Recarregar" e apaga a antiga.
- **Roadmaps, `manifest.json` e textos da interface**: primeiro a rede, a última cópia como reserva. Ao abrir, o app pede ao worker que guarde uma cópia de todos os roadmaps da lista.
- **API** (`/api/*`): nunca passa pelo worker. O progresso e as notas já têm a própria cópia offline no navegador.

O `src/manifest.webmanifest` e os ícones em `src/icons/` (gerados por `tools/icons.py`, só com a biblioteca padrão) completam o que o navegador pede para oferecer a instalação.

## Onde as notas são guardadas

As notas ficam fora do arquivo de progresso, em `data/notes/<id>.json`, porque o progresso é regravado a cada clique e um texto grande deixaria cada gravação pesada. O arquivo tem a hora da última alteração e um mapa de notas: `roadmap` para a nota geral, `node:<id>` para um tópico e `project:<id>` para um projeto. A sincronização é a mesma do progresso: o navegador guarda uma cópia, a versão mais nova vence, e nada se perde se o servidor cair.

O texto das notas nunca vira HTML: o renderizador em `src/markdown.js` escapa tudo antes de formatar e só aceita links `http(s)`. Ele tem testes próprios (`node tools/markdown.test.cjs`), que rodam no CI.

Nada dentro de `data/` é servido como arquivo comum: só pela API, que exige o token quando ele está ligado.

## A API

Tudo o que a interface pede ao servidor está abaixo. Pode ser útil para scripts, e é o que a skill do Claude Code usa quando precisa gravar no volume.

| Método e caminho | O que faz |
|---|---|
| `GET /manifest.json` | a lista de roadmaps, com seções, contagens e ocultos |
| `GET /api/state/<id>` | o progresso salvo de um roadmap (`204` se não houver) |
| `PUT /api/state/<id>` | grava o progresso, ou devolve `409` com o que o servidor tem se for mais novo. As partes do progresso que o cliente não mandar ficam como estavam, então uma versão antiga, que só conhece tópicos e tarefas, não apaga os projetos |
| `GET /api/states` | o resumo de todos, para os selos de andamento |
| `GET /api/notes/<id>` | as notas de um roadmap (`204` se não houver) |
| `PUT /api/notes/<id>` | grava as notas, com a mesma regra do progresso (`409` se o servidor tiver uma versão mais nova). Cada nota tem até 20 mil caracteres |
| `POST /api/validate` | valida um JSON de roadmap sem gravar |
| `POST /api/roadmaps?category=` | cria um roadmap (`categoryTitle=` dá o nome de uma categoria nova) |
| `PUT /api/roadmaps/<id>?category=` | substitui um roadmap criado pela interface, e troca de categoria se mudar o parâmetro |
| `DELETE /api/roadmaps/<id>?progress=1` | exclui, e opcionalmente apaga o progresso junto |
| `PUT /api/hidden/<id>` | oculta ou restaura, com `{"hidden": true}` |
| `GET /user/<categoria>/<id>.json` | o JSON de um roadmap criado pela interface |

Com `ROADKIT_TOKEN` definido, tudo em `/api/` exige `Authorization: Bearer <token>`. As escritas só aceitam requisições da mesma origem e `Content-Type: application/json`, o que impede uma página de outro site de escrever no seu progresso.

## Como o código está organizado

```
index.html          a casca: nenhum conteúdo de roadmap, só a estrutura
src/app.js          lê o JSON, calcula o layout, desenha, sincroniza e edita
src/style.css       o visual, com claro e escuro
src/labels/         os textos da interface, um arquivo por idioma
src/ai-prompt.txt   o modelo do prompt do botão "Criar com IA"
tools/roadkit.py    o servidor e os comandos check e index
schema/             o JSON Schema, para autocompletar no editor
examples/           roadmaps de exemplo em português e inglês
roadmaps/           os seus roadmaps (vazia no repositório)
data/               progresso e roadmaps da interface (criada ao usar)
docs/               estes textos e as imagens
.agents/skills/     a skill para agentes de código
```

O `app.js` é um arquivo só, de propósito: sem bundler, sem módulos, sem passo de build. Dá para abrir e ler de cima a baixo, na ordem em que as coisas acontecem.

Para adicionar um idioma à interface, copie `src/labels/pt-BR.json`, traduza e salve com o código do idioma (por exemplo `es.json`). Ele aparece sozinho nas opções de idioma.

## As imagens da documentação

Os GIFs e as capturas em `docs/media/` são gerados por um script que abre a interface num navegador de verdade, faz os cliques e grava. Assim não ficam desatualizados quando algo muda no visual. Precisa do Playwright e do ffmpeg:

```bash
npm i playwright
ROADKIT_DATA=$(mktemp -d) python3 tools/roadkit.py serve --port 8791 &
node tools/demos/record.cjs http://127.0.0.1:8791            # todos
node tools/demos/record.cjs http://127.0.0.1:8791 criar      # só um (hero, criar, ia, fotos)
```

Rode contra um servidor descartável como acima, e não contra o seu: o script marca progresso e cria roadmaps de teste.
