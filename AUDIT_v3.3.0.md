# Auditoria v3.3.0 — World Tour Ecosystem

Build: 20260609-125029

## Escopo validado
- Fonte única de versão/build/data/hora.
- Migração de save schema 5 para 6.
- Fallback para calendário-base se tournaments.json falhar.
- Simulação idempotente: uma execução por temporada/semana.
- Ranking preserva atletas do usuário e processa NPCs.
- Calendário reduz renderização para janela próxima, protegendo mobile.
- Feed horizontal com toque, scroll snap e safe layout em 320 px.
- Sintaxe JavaScript e JSON validada.
- Integridade do ZIP e caminhos principais verificados.

## Proteções anti-quebra
- Ausência do banco expandido não bloqueia inicialização.
- Saves antigos recebem worldTour automaticamente.
- Sem eventos na semana gera estado de preparação, não erro.
- Pools pequenos usam ranking completo como fallback.
