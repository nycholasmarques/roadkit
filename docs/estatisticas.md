# Estatísticas

Estudar é uma coisa de semanas, não de um dia. A tela de estatísticas mostra esse tempo: quando você estudou, em que ritmo cada roadmap está andando e quando ele termina, se continuar assim.

<p align="center">
  <img src="media/estatisticas.png" alt="A tela de estatísticas: números, mapa de calor do ano e o ritmo de cada roadmap" width="100%">
</p>

## O que a tela mostra

**Estatísticas**, nas ferramentas da barra lateral (ou pela busca, ou pelo pequeno gráfico ao lado da barra de progresso, que abre já no roadmap aberto), mostra o que você fez com o tempo:

- **Números**: dias seguidos com atividade (com a melhor sequência do ano), tópicos concluídos nos últimos 30 dias e no total, e o tempo de foco dos últimos 30 dias, se você usa as sessões de foco.
- **Mapa de calor** dos últimos 12 meses, de todos os roadmaps juntos: cada quadrado é um dia, mais escuro quanto mais você fez (mudanças de estado e foco). Passar o mouse ou tocar mostra os números do dia. No celular ele rola de lado e começa em hoje.
- **Por roadmap**: o andamento, os tópicos concluídos por semana nas últimas 12 semanas e a **previsão**: "No ritmo das últimas 4 semanas, termina por volta de 18 de nov.". A previsão só aparece depois de duas semanas de atividade. Embaixo, os últimos tópicos concluídos com quanto tempo levaram, comparado com o `time` do tópico quando ele é uma duração ("2 semanas", "3 dias").

O tom é de registro, não de cobrança: perder uma sequência não tem aviso nenhum. As estatísticas começam a contar a partir da versão 1.7, quando o registro de atividade começou.

<p align="center">
  <img src="media/estatisticas-escuro.png" alt="A mesma tela no tema escuro" width="88%">
</p>

## De onde vêm os números

Cada vez que o progresso de um roadmap muda, o servidor anota a diferença no **registro de atividade** daquele roadmap (`data/activity/<id>.json`): quantas mudanças e quantos tópicos concluídos em cada dia, e quando cada tópico começou e terminou. O tempo das sessões de foco vai para o mesmo lugar. O arquivo tem tamanho limitado (dois anos de totais por dia; o que é mais antigo vira total por mês), então não cresce com o uso.

Mudanças feitas sem internet caem no dia em que aconteceram, não no dia em que sincronizaram: o navegador guarda a hora de cada uma até o servidor receber. E tudo fica na sua máquina: nada é enviado para fora, e não há telemetria.

Como o registro fica no servidor, as estatísticas não aparecem na [demonstração](https://nycholasmarques.github.io/roadkit/app/) nem com o app aberto sem servidor. Os detalhes do formato estão em [Como funciona](como-funciona.md#onde-a-atividade-é-guardada).
