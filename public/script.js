const $ = s => document.querySelector(s);
let S = { assets: [], logs: [] }, editId = null, loanId = null, qrScanner = null, qrHandling = false, lastQrCode = '';
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cls = s => s === 'Disponível' ? 's-d' : s === 'Em Uso' ? 's-u' : 's-m';
const api = async (url, method = 'GET', data) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'Erro'); return j;
};
async function load() { S = await api('/api/state'); render(); }

function render() {
  const A = S.assets, n = st => A.filter(a => a.status === st).length, t = A.length || 1;
  const k = [['TOTAL DE ATIVOS', A.length, 100, 'LAB DEV. SISTEMAS'], ['DISPONÍVEIS EM BANCADA', n('Disponível'), n('Disponível') / t * 100], ['EM USO (ALUNOS/PROJETOS)', n('Em Uso'), n('Em Uso') / t * 100], ['EM MANUTENÇÃO', n('Manutenção'), n('Manutenção') / t * 100]];
  $('#kpis').innerHTML = k.map(([l, v, p, x]) => `<div class="kpi"><span>${l}</span><b>${String(v).padStart(2, '0')}</b><div class="bar"><i style="width:${p}%"></i></div><small>${x || p.toFixed(0) + '% DO PARQUE'}</small></div>`).join('');
  $('#ticker').innerHTML = (() => { const s = `<span>● LAB 02 ONLINE &nbsp;//&nbsp; ${n('Disponível')} DISPONÍVEIS &nbsp;//&nbsp; ${n('Em Uso')} EM USO &nbsp;//&nbsp; ${n('Manutenção')} EM MANUTENÇÃO &nbsp;//&nbsp; SYS.INV V2.6 &nbsp;//&nbsp; CT EDWARD SÁVIO — JAÚ/SP &nbsp;//&nbsp; </span>`; return s.repeat(8); })();
  const q = $('#q').value.toLowerCase(), c = $('#fCat').value, s = $('#fSt').value;
  const F = A.filter(a => (c === 'Todos' || a.categoria === c) && (s === 'Todos' || a.status === s) && (a.nome + a.patrimonio).toLowerCase().includes(q));
  const categories = [...new Set(F.map(a => a.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('#grid').innerHTML = F.length ? categories.map(category => {
    const assets = F.filter(a => a.categoria === category);
    return `<section class="inventory-group"><h3>${esc(category)}<span>${assets.length} ${assets.length === 1 ? 'ATIVO' : 'ATIVOS'}</span></h3><div class="grid">${assets.map(a => `<article class="card"><div class="id">${esc(a.patrimonio)}</div><h4>${esc(a.nome)}</h4>
      ${a.categoria === 'iMacs' ? '<img class="asset-image" src="/imac.jpeg" alt="iMac">' : ''}
      ${a.categoria === 'TVs' ? '<img class="asset-image" src="/tv.avif" alt="Televisão">' : ''}
      ${a.categoria === 'Notebooks' ? '<img class="asset-image" src="/notebook.avif" alt="Notebook">' : ''}
      <p>📍 ${esc(a.localizacao)}<br>👤 ${esc(a.responsavel)}</p><span class="badge ${cls(a.status)}">${a.status}</span>
      <div class="acts">${a.status === 'Disponível' ? `<button class="btn sm" data-a="out" data-id="${a.id}"><span>CHECK-OUT</span></button>` : a.status === 'Em Uso' ? `<button class="btn sm" data-a="ret" data-id="${a.id}"><span>DEVOLVER</span></button>` : ''}
      <button class="btn sm" data-a="edit" data-id="${a.id}"><span>EDITAR</span></button><button class="btn sm" data-a="del" data-id="${a.id}"><span>EXCLUIR</span></button></div></article>`).join('')}</div></section>`;
  }).join('') : `<div class="empty"><p class="mono">${A.length ? 'Nenhum ativo encontrado' : 'Nenhum item cadastrado'}</p>${A.length ? '' : '<button class="btn red" data-a="add"><span>+ ADICIONAR ITEM</span></button>'}</div>`;
  const L = A.filter(a => a.status === 'Em Uso');
  $('#loans').innerHTML = L.length ? L.map(a => `<div class="loan"><span class="mono">${esc(a.patrimonio)}</span><b>${esc(a.responsavel)}</b><p>${esc(a.nome)}</p><button class="btn sm" data-a="ret" data-id="${a.id}"><span>REGISTRAR DEVOLUÇÃO</span></button></div>`).join('') : '<p class="mono">Nenhum empréstimo ativo</p>';
  $('#log').innerHTML = S.logs.map(l => `<li><span>${new Date(l.ts.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}</span><b>${l.tipo}</b><span>${esc(l.patrimonio)}</span><span>${esc(l.detalhe)}</span></li>`).join('');
}
function open(mode, a) {
  $('#form').hidden = mode === 'loan'; $('#loanForm').hidden = mode !== 'loan'; $('#err').textContent = '';
  $('#loanErr').textContent = '';
  $('#dTitle').textContent = mode === 'loan' ? 'CHECK-OUT // ' + a.patrimonio : a ? 'EDITAR ATIVO' : 'NOVO ITEM';
  if (mode === 'loan') $('#loanPatrimonio').value = a.patrimonio;
  if (mode !== 'loan') { const f = $('#form'); f.reset(); if (a) for (const k of ['patrimonio', 'nome', 'categoria', 'localizacao', 'status', 'responsavel']) f[k].value = a[k]; else f.patrimonio.value = 'SNI-2026-' + String(S.assets.length + 40).padStart(3, '0'); }
  $('#drawer').classList.add('on'); $('#veil').classList.add('on');
}
const close = () => { $('#drawer').classList.remove('on'); $('#veil').classList.remove('on'); };
const setQrStatus = (message, state = '') => { $('#qrStatus').textContent = message; $('#qrStatus').dataset.state = state; };
async function stopQrScanner() {
  if (!qrScanner) return;
  const scanner = qrScanner;
  if (scanner.isScanning) await scanner.stop();
  scanner.clear();
  qrScanner = null;
  $('#btnQrStart').hidden = false;
  $('#btnQrStart').disabled = false;
  $('#btnQrStop').hidden = true;
}
async function checkoutByCode(value) {
  const code = String(value).trim();
  $('#qrPatrimonio').value = code;
  const asset = S.assets.find(item => item.patrimonio.toLowerCase() === code.toLowerCase());
  if (!asset) {
    if (lastQrCode !== code) setQrStatus(`Patrimônio "${code}" não encontrado. Confira o código e tente novamente.`, 'error');
    lastQrCode = code;
    return;
  }
  lastQrCode = code;
  if (asset.status !== 'Disponível') {
    setQrStatus(`${asset.patrimonio} está com status "${asset.status}" e não pode ser retirado.`, 'error');
    return;
  }
  if (qrHandling) return;
  qrHandling = true;
  try {
    await stopQrScanner();
    loanId = asset.id;
    open('loan', asset);
    $('#loanForm [name="aluno"]').focus();
    setQrStatus(`Item ${asset.patrimonio} localizado. Informe o estudante para confirmar a retirada.`, 'success');
  } catch (error) {
    console.error('Falha ao parar o leitor QR:', error);
    setQrStatus(`Não foi possível parar a câmera: ${error.message || error}`, 'error');
  } finally {
    qrHandling = false;
  }
}
async function startQrScanner() {
  if (!window.Html5Qrcode) {
    setQrStatus('O leitor de câmera não carregou. Use o campo para digitar o patrimônio.', 'error');
    return;
  }
  $('#btnQrStart').disabled = true;
  setQrStatus('Solicitando acesso à câmera…');
  qrScanner = new window.Html5Qrcode('qrReader');
  try {
    await qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      decodedText => checkoutByCode(decodedText),
      () => {}
    );
    lastQrCode = '';
    $('#btnQrStart').hidden = true;
    $('#btnQrStop').hidden = false;
    setQrStatus('Câmera ativa. Aponte para o QR code do patrimônio.');
  } catch (error) {
    console.error('Falha ao iniciar o leitor QR:', error);
    qrScanner = null;
    $('#btnQrStart').disabled = false;
    setQrStatus(`Não foi possível iniciar a câmera. Verifique a permissão ou digite o patrimônio. ${error.message || error}`, 'error');
  }
}
$('#btnNovo').onclick = () => { editId = null; open('form'); };
$('#btnX').onclick = $('#veil').onclick = close;
$('#btnQrStart').onclick = startQrScanner;
$('#btnQrStop').onclick = async () => {
  try { await stopQrScanner(); setQrStatus('Leitor parado.'); }
  catch (error) { console.error('Falha ao parar o leitor QR:', error); setQrStatus(`Não foi possível parar a câmera: ${error.message || error}`, 'error'); }
};
$('#qrManualForm').onsubmit = async e => {
  e.preventDefault();
  await checkoutByCode($('#qrPatrimonio').value);
};
['#q', '#fCat', '#fSt'].forEach(s => $(s).addEventListener('input', render));
$('#form').onsubmit = async e => {
  e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
  try { editId ? await api('/api/assets/' + editId, 'PUT', d) : await api('/api/assets', 'POST', d); close(); load(); } catch (x) { $('#err').textContent = x.message; }
};
$('#loanForm').onsubmit = async e => {
  e.preventDefault();
  const student = e.target.aluno.value.trim();
  try {
    await api(`/api/assets/${loanId}/checkout`, 'POST', { responsavel: student });
    e.target.reset(); close();
    setQrStatus(`Retirada registrada para ${student}.`);
    try { await load(); }
    catch (error) { console.error('Falha ao atualizar o inventário após a retirada:', error); setQrStatus(`Retirada registrada para ${student}, mas não foi possível atualizar a tela. Atualize a página.`, 'error'); }
  } catch (x) { $('#loanErr').textContent = x.message; }
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  if (b.dataset.a === 'add') { editId = null; open('form'); return; }
  const id = b.dataset.id, a = S.assets.find(x => x.id == id);
  if (b.dataset.a === 'out') { loanId = id; open('loan', a); }
  if (b.dataset.a === 'edit') { editId = id; open('form', a); }
  if (b.dataset.a === 'ret') { await api(`/api/assets/${id}/return`, 'POST'); load(); }
  if (b.dataset.a === 'del' && confirm('Excluir ' + a.patrimonio + '?')) { await api('/api/assets/' + id, 'DELETE'); load(); }
});
load();
