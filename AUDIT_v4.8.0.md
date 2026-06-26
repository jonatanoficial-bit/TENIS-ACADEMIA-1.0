# AUDIT v4.8.1 — Boot Recovery: Embedded Content Fallback & No-JS Shield

Build: `20260626-105500`
Data: 26/06/2026 10:55:00 São Paulo
Schema: 45

## Escopo
- Nova aba Microciclo.
- Sistema `trainingMicrocycle`.
- Controle de carga aguda/crônica, readiness e risco de lesão.
- Integração com Training Lab e avanço semanal.
- Exportação local JSON.

## Verificações planejadas/executadas
- `node --check js/main.js`
- `node --check js/state.js`
- `node --check js/build.js`
- `node --check js/contentLoader.js`
- `node --check sw.js`
- JSONs principais e manifest PWA.
- HTML sem IDs duplicados.
- ZIP íntegro.
