// SENAI Jaú — Controle de Ativos | Servidor + banco SQLite (node:sqlite, sem dependências). Requer Node 22.5+
const http = require('http'), fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(__dirname, 'inventario.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS assets(id INTEGER PRIMARY KEY AUTOINCREMENT, patrimonio TEXT UNIQUE NOT NULL, nome TEXT NOT NULL,
 categoria TEXT NOT NULL, localizacao TEXT NOT NULL, responsavel TEXT NOT NULL DEFAULT 'Estoque Central',
 status TEXT NOT NULL DEFAULT 'Disponível', criado_em TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS logs(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT DEFAULT CURRENT_TIMESTAMP, tipo TEXT, patrimonio TEXT, detalhe TEXT);`);
const log = (t, p, d) => db.prepare('INSERT INTO logs(tipo,patrimonio,detalhe) VALUES(?,?,?)').run(t, p, d);
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.avif': 'image/avif' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  try {
    if (p.startsWith('/api/')) {
      const m = p.match(/^\/api\/assets(?:\/(\d+))?(?:\/(checkout|return))?$/);
      if (p === '/api/state') return send(res, 200, { assets: db.prepare('SELECT * FROM assets ORDER BY patrimonio').all(), logs: db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 40').all() });
      if (!m) return send(res, 404, { erro: 'Rota inválida' });
      const id = m[1], act = m[2], d = await body(req);
      const a = id ? db.prepare('SELECT * FROM assets WHERE id=?').get(id) : null;
      if (req.method === 'POST' && !id) {
        if (!d.nome || !d.patrimonio) return send(res, 400, { erro: 'Nome e patrimônio são obrigatórios' });
        db.prepare('INSERT INTO assets(patrimonio,nome,categoria,localizacao,responsavel,status) VALUES(?,?,?,?,?,?)')
          .run(d.patrimonio.toUpperCase(), d.nome, d.categoria, d.localizacao, d.responsavel || 'Estoque Central', d.status || 'Disponível');
        log('CADASTRO', d.patrimonio.toUpperCase(), 'Novo ativo: ' + d.nome); return send(res, 201, { ok: true });
      }
      if (!a) return send(res, 404, { erro: 'Ativo não encontrado' });
      if (req.method === 'POST' && act === 'checkout') {
        if (a.status !== 'Disponível') return send(res, 409, { erro: 'Ativo indisponível' });
        db.prepare("UPDATE assets SET status='Em Uso', responsavel=? WHERE id=?").run(d.responsavel, id);
        log('CHECK-OUT', a.patrimonio, 'Retirado por ' + d.responsavel); return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && act === 'return') {
        db.prepare("UPDATE assets SET status='Disponível', responsavel='Estoque Central' WHERE id=?").run(id);
        log('DEVOLUÇÃO', a.patrimonio, 'Devolvido por ' + a.responsavel); return send(res, 200, { ok: true });
      }
      if (req.method === 'PUT') {
        db.prepare('UPDATE assets SET patrimonio=?,nome=?,categoria=?,localizacao=?,responsavel=?,status=? WHERE id=?')
          .run(d.patrimonio.toUpperCase(), d.nome, d.categoria, d.localizacao, d.responsavel, d.status, id);
        log(d.status === 'Manutenção' ? 'MANUTENÇÃO' : 'EDIÇÃO', d.patrimonio.toUpperCase(), 'Registro atualizado (' + d.status + ')'); return send(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') { db.prepare('DELETE FROM assets WHERE id=?').run(id); log('EXCLUSÃO', a.patrimonio, 'Ativo removido: ' + a.nome); return send(res, 200, { ok: true }); }
      return send(res, 405, { erro: 'Método não permitido' });
    }
    const f = path.join(__dirname, 'public', p === '/' ? 'index.html' : p);
    if (!f.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  } catch (e) { send(res, 500, { erro: e.message.includes('UNIQUE') ? 'Patrimônio já cadastrado' : e.message }); }
}).listen(3000, () => console.log('SYS.INV // V2.6 → http://localhost:3000'));
