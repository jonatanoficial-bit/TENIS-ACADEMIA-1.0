# Formato de pacote de conteudo

Pacotes locais podem ser importados no **Admin** em JSON.

## Estrutura minima

```json
{
  "id": "dlc.exemplo.local",
  "name": "Meu Pacote",
  "version": "0.0.1",
  "enabled": true,
  "payload": {
    "players": { "academyProspects": [] },
    "staff": { "market": [] },
    "tournaments": { "events": [] },
    "copy": {},
    "branding": {},
    "config": {}
  }
}
```

## Blocos aceitos
- `players.officialTop100`
- `players.academyProspects`
- `players.prospectMarket`
- `staff.core`
- `staff.market`
- `tournaments.events`
- `copy`
- `branding`
- `config`

## Recomendacao
Use IDs exclusivos para evitar conflito com o core. O arquivo `content/examples/sample-local-package.json` serve como ponto de partida.
