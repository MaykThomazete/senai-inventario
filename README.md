# SENAI Jaú — Controle de Ativos (SYS.INV // V2.6)
Requisitos: Node.js 22.5+ (usa o SQLite embutido, sem `npm install`).

1. Abra a pasta no VS Code → terminal (`Ctrl+'`)
2. `node --no-warnings server.js`  (ou `npm start`)
3. Acesse http://localhost:3000

O banco `inventario.db` é criado e populado (10 ativos) no primeiro start. Para zerar, apague o arquivo.
Estrutura: `server.js` (API + banco) · `public/index.html` · `public/style.css` · `public/script.js`
