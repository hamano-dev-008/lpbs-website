'use strict';
const OWNER = 'hamano-dev-008';
const REPO = 'lpbs-website';
const BASE_BRANCH = 'main';
const REQUIRE_DIFFERENT_APPROVER = true;

(() => {
  const $ = id => document.getElementById(id);
  const { sah, kad, unsur } = window.LPBSBerita;
  const ROOT = `/repos/${OWNER}/${REPO}`;
  const KEY = 'lpbs-github-token';
  let token = '', user = null, image = null, imageVersion = 0, imageBusy = false, submitting = false;
  const pending = new Set();
  function status(message, error = false) {
    $('status').textContent = message;
    $('status').className = error ? 'ralat' : '';
  }
  function errorText(error) {
    if (error instanceof SyntaxError) return 'Format data berita tidak sah. Semak fail atau permintaan tarik di GitHub.';
    if (error.status === 401) return 'Token salah atau tamat tempoh. Sila log masuk semula.';
    if (error.status === 429 || error.rateLimit) return 'Had permintaan GitHub telah dicapai. Cuba lagi kemudian.';
    if (error.status === 403 || error.status === 404) return 'Tiada kebenaran atau repositori tidak dapat dicapai. Semak akses token anda.';
    if (error.status === 405) return 'Permintaan belum boleh digabungkan. Semak syarat kelulusan dan perlindungan cabang di GitHub.';
    if ([409,422].includes(error.status)) return 'Perubahan bertindih atau permintaan tidak dapat diproses. Muat semula dan cuba lagi.';
    if (error instanceof TypeError) return 'Tiada sambungan. Semak rangkaian anda dan cuba lagi.';
    return error.message || 'Ralat berlaku. Sila cuba lagi.';
  }
  async function api(path, method = 'GET', body) {
    if (!token) throw new Error('Sila log masuk semula.');
    // Laluan relatif sahaja; token tidak pernah dihantar kepada hos lain.
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Laluan tidak sah.');
    const res = await fetch('https://api.github.com' + path, {
      method, redirect:'error', credentials:'omit', cache:'no-store',
      headers: { Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28', ...(body ? {'Content-Type':'application/json'} : {}) },
      ...(body ? {body:JSON.stringify(body)} : {})
    });
    if (!res.ok) {
      const error = new Error('GitHub tidak dapat melengkapkan tindakan ini.');
      error.status = res.status;
      const detail = await res.json().catch(() => ({}));
      error.rateLimit = res.headers.get('x-ratelimit-remaining') === '0' || /rate limit|secondary rate/i.test(detail.message || '');
      throw error;
    }
    return res.status === 204 ? null : res.json();
  }
  async function list(path) {
    const all = [];
    for (let page = 1; ; page++) {
      const items = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      all.push(...items);
      if (items.length < 100) return all;
    }
  }
  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function decode(text) {
    return new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')), c => c.charCodeAt(0)));
  }
  async function file(path, ref = BASE_BRANCH) {
    return api(`${ROOT}/contents/${path}?ref=${encodeURIComponent(ref)}`);
  }
  async function exists(path) {
    try { await file(path); return true; } catch (error) { if (error.status === 404) return false; throw error; }
  }
  function clearStorage() {
    for (const storage of [localStorage, sessionStorage]) storage.removeItem(KEY);
  }
  function loggedIn() {
    $('log-masuk').hidden = true;
    $('editor').hidden = false;
    $('keluar').hidden = false;
    $('pengguna').textContent = `Log masuk sebagai ${user.login}`;
  }
  $('borang-login').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    token = $('token').value.trim();
    try {
      user = await api('/user');
      clearStorage();
      ($('ingat').checked ? localStorage : sessionStorage).setItem(KEY, token);
      $('token').value = '';
      loggedIn();
      status('Log masuk berjaya.');
    } catch (error) { token = ''; user = null; clearStorage(); status(errorText(error), true); }
    finally { button.disabled = false; }
  });
  $('keluar').addEventListener('click', () => {
    clearStorage(); token = ''; user = null;
    $('editor').hidden = true; $('keluar').hidden = true; $('log-masuk').hidden = false;
    $('token').value = ''; $('pengguna').textContent = '';
    $('senarai-menunggu').replaceChildren(); $('senarai-disiarkan').replaceChildren();
    status('Anda telah log keluar.');
  });
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  $('tarikh').value = today();
  function formItem() {
    return {
      id:`${$('tarikh').value || today()}-pratonton`, kategori:$('kategori').value,
      tarikh:$('tarikh').value || today(), tajuk:$('tajuk').value.trim() || 'Tajuk berita',
      ringkasan:$('ringkasan').value.trim(), gambar:image ? 'assets/berita/pratonton.jpg' : ''
    };
  }
  function preview() {
    $('kiraan').textContent = `${$('ringkasan').value.length}/300`;
    $('pratonton').replaceChildren(kad(formItem(), '../', image?.url));
  }
  $('borang-berita').addEventListener('input', preview);
  $('gambar').addEventListener('change', async () => {
    const version = ++imageVersion;
    if (image) URL.revokeObjectURL(image.url);
    image = null;
    const original = $('gambar').files[0];
    preview();
    if (!original) { imageBusy = false; $('hantar').disabled = submitting; return; }
    imageBusy = true; $('hantar').disabled = true;
    let source;
    try {
      if (!['image/jpeg','image/png','image/webp'].includes(original.type)) throw new Error('Pilih gambar JPG, PNG atau WebP sahaja.');
      if (original.size > 15 * 1024 * 1024) throw new Error('Gambar asal melebihi 15 MB. Sila pilih gambar lebih kecil.');
      source = URL.createObjectURL(original);
      const img = new Image(); img.src = source;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1200, img.naturalWidth);
      canvas.height = Math.max(1, Math.round(img.naturalHeight * canvas.width / img.naturalWidth));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.8));
      if (!blob) throw new Error('Gambar tidak dapat diproses. Pilih gambar lain.');
      const data = await new Promise((resolve,reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      if (version !== imageVersion) return;
      image = { data, url:URL.createObjectURL(blob) };
      $('saiz').textContent = `JPEG siap: ${(blob.size/1024).toFixed(1)} KB · ${canvas.width} × ${canvas.height} piksel`;
      preview();
    } catch (error) {
      if (version === imageVersion) { $('gambar').value = ''; $('saiz').textContent = 'Tiada gambar dipilih.'; status(error.name === 'Error' ? error.message : 'Gambar tidak dapat diproses. Pilih gambar lain.',true); }
    } finally {
      if (source) URL.revokeObjectURL(source);
      if (version === imageVersion) { imageBusy = false; $('hantar').disabled = submitting; }
    }
  });
  function slug(text) {
    return text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75).replace(/-$/,'') || 'berita';
  }
  function parsePR(pr) {
    const match = /```json\s*\r?\n([\s\S]*?)\r?\n```/.exec(pr.body || '');
    if (!match) throw new Error('Maklumat berita dalam permintaan tarik tidak sah. Semak di GitHub.');
    return sah(JSON.parse(match[1]));
  }
  async function createNews(item, photo) {
    const prs = await list(`${ROOT}/pulls?state=open`);
    const used = new Set(prs.filter(pr => pr.head.ref.startsWith('berita-')).map(pr => { try { return parsePR(pr).id; } catch { return ''; } }));
    const original = `${item.tarikh}-${slug(item.tajuk)}`;
    let id = original, suffix = 2;
    while (used.has(id) || await exists(`data/berita/${id}.json`)) id = `${original}-${suffix++}`;
    item.id = id; item.gambar = photo ? `assets/berita/${id}.jpg` : '';
    sah(item);
    const main = await api(`${ROOT}/git/ref/heads/${BASE_BRANCH}`);
    const parent = await api(`${ROOT}/git/commits/${main.object.sha}`);
    const tree = [{path:`data/berita/${id}.json`,mode:'100644',type:'blob',content:JSON.stringify(item,null,2)+'\n'}];
    if (photo) {
      const blob = await api(`${ROOT}/git/blobs`,'POST',{content:photo.data,encoding:'base64'});
      tree.push({path:item.gambar,mode:'100644',type:'blob',sha:blob.sha});
    }
    const newTree = await api(`${ROOT}/git/trees`,'POST',{base_tree:parent.tree.sha,tree});
    const commit = await api(`${ROOT}/git/commits`,'POST',{message:`Berita: ${item.tajuk}`,tree:newTree.sha,parents:[main.object.sha]});
    const branch = `berita-${id}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
    await api(`${ROOT}/git/refs`,'POST',{ref:`refs/heads/${branch}`,sha:commit.sha});
    try {
      return await api(`${ROOT}/pulls`,'POST',{
        title:`Berita: ${item.tajuk}`,head:branch,base:BASE_BRANCH,
        body:`Dihantar oleh: @${user.login}\n\n\`\`\`json\n${JSON.stringify(item,null,2).replace(/`/g,'\\u0060')}\n\`\`\`\n`
      });
    } catch (error) {
      // Kekalkan cabang untuk pemulihan jika GitHub telah menerima permintaan tetapi respons terputus.
      throw new Error(`Permintaan tarik belum dapat disahkan. Semak cabang ${branch} di GitHub sebelum menghantar semula. ${errorText(error)}`);
    }
  }
  $('borang-berita').addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || imageBusy) return;
    if (!$('tajuk').value.trim() || !$('ringkasan').value.trim()) { status('Sila isi tajuk dan ringkasan.', true); return; }
    submitting = true; $('hantar').disabled = true; $('keluar').disabled = true;
    const fields = [...$('borang-berita').querySelectorAll('input,select,textarea')];
    fields.forEach(el => el.disabled = true);
    try {
      await createNews(formItem(), image);
      $('borang-berita').reset(); $('tarikh').value = today();
      if (image) URL.revokeObjectURL(image.url);
      image = null; $('saiz').textContent = 'JPG, PNG atau WebP. Saiz asal maksimum 15 MB.'; preview();
      status('Dihantar. Menunggu kelulusan webmaster lain.');
    } catch (error) { status(errorText(error),true); }
    finally { submitting = false; $('hantar').disabled = false; $('keluar').disabled = false; fields.forEach(el => el.disabled = false); }
  });
  async function rebuild() {
    // Bina daripada satu syot kilat; kemas kini hanya jika main belum berubah.
    for (let attempt = 0; attempt < 3; attempt++) {
      const head = await api(`${ROOT}/git/ref/heads/${BASE_BRANCH}`);
      const snapshot = head.object.sha;
      const entries = await file('data/berita',snapshot);
      if (!Array.isArray(entries)) throw new Error('Folder berita tidak sah.');
      const items = await Promise.all(entries.filter(entry => entry.type === 'file' && entry.name.endsWith('.json')).map(async entry => {
        const data = await file(`data/berita/${entry.name}`,snapshot);
        const item = sah(JSON.parse(decode(data.content)));
        if (entry.name !== `${item.id}.json`) throw new Error('Nama fail berita tidak sepadan dengan ID.');
        return item;
      }));
      items.sort((a,b) => b.tarikh.localeCompare(a.tarikh) || a.id.localeCompare(b.id));
      const parent = await api(`${ROOT}/git/commits/${snapshot}`);
      const tree = await api(`${ROOT}/git/trees`,'POST',{base_tree:parent.tree.sha,tree:[{path:'data/berita.json',mode:'100644',type:'blob',content:JSON.stringify(items,null,2)+'\n'}]});
      const commit = await api(`${ROOT}/git/commits`,'POST',{message:'Kemaskini senarai berita',tree:tree.sha,parents:[snapshot]});
      try {
        await api(`${ROOT}/git/refs/heads/${BASE_BRANCH}`,'PATCH',{sha:commit.sha,force:false});
        return items;
      } catch (error) { if (![409,422].includes(error.status) || attempt === 2) throw error; }
    }
  }
  async function deleteBranch(pr) {
    if (pr.head.repo?.full_name !== `${OWNER}/${REPO}` || !pr.head.ref.startsWith('berita-')) return;
    try { await api(`${ROOT}/git/refs/heads/${encodeURIComponent(pr.head.ref)}`,'DELETE'); }
    catch (error) { if (error.status !== 404) throw error; }
  }
  async function approve(pr) {
    const current = await api(`${ROOT}/pulls/${pr.number}`);
    if (current.state !== 'open' || current.base.ref !== BASE_BRANCH || current.head.repo?.full_name !== `${OWNER}/${REPO}`) throw new Error('Permintaan tarik tidak lagi tersedia untuk kelulusan.');
    if (REQUIRE_DIFFERENT_APPROVER && current.user.login.toLowerCase() === user.login.toLowerCase()) throw new Error('Perlu diluluskan oleh webmaster lain.');
    // Pastikan data dalam kad sama dengan fail yang akan digabungkan.
    const item = parsePR(current);
    const proposed = sah(JSON.parse(decode((await file(`data/berita/${item.id}.json`,current.head.sha)).content)));
    if (JSON.stringify(item) !== JSON.stringify(proposed)) throw new Error('Data pratonton berbeza daripada fail. Semak permintaan tarik di GitHub.');
    const changes = await list(`${ROOT}/pulls/${pr.number}/files`);
    const allowed = new Set([`data/berita/${item.id}.json`,...(item.gambar ? [item.gambar] : [])]);
    if (changes.length !== allowed.size || changes.some(change => !allowed.has(change.filename) || change.status !== 'added')) throw new Error('Permintaan mengandungi perubahan lain. Semak di GitHub sebelum diluluskan.');
    const result = await api(`${ROOT}/pulls/${pr.number}/merge`,'PUT',{merge_method:'squash',sha:current.head.sha});
    if (!result.merged) throw new Error('Permintaan belum berjaya digabungkan. Semak di GitHub.');
    let branchError = false;
    try { await deleteBranch(current); } catch { branchError = true; }
    try { await rebuild(); }
    catch (error) { throw new Error(`Berita telah digabungkan tetapi senarai belum dikemas kini. Tekan Segerakkan Senarai di tab Disiarkan. ${errorText(error)}`); }
    status(branchError ? 'Berita diterbitkan. Cabang belum dipadam; sila padam di GitHub.' : 'Berita diluluskan dan diterbitkan.');
  }
  async function reject(pr) {
    const reason = window.prompt('Sebab penolakan (pilihan). Tekan Batal untuk membatalkan tindakan.','');
    if (reason === null) return false;
    const current = await api(`${ROOT}/pulls/${pr.number}`);
    if (current.state !== 'open' || current.merged) throw new Error('Permintaan tarik tidak lagi menunggu kelulusan.');
    if (reason.trim()) await api(`${ROOT}/issues/${pr.number}/comments`,'POST',{body:reason.trim()});
    await api(`${ROOT}/pulls/${pr.number}`,'PATCH',{state:'closed'});
    try { await deleteBranch(current); }
    catch { status('Berita ditolak. Cabang belum dipadam; sila padam di GitHub.'); return true; }
    status('Berita ditolak. Tiada berita diterbitkan.');
    return true;
  }
  async function action(pr, button, fn) {
    if (pending.has(pr.number)) return;
    pending.add(pr.number); button.disabled = true; $('keluar').disabled = true;
    let ok = false;
    try { ok = (await fn(pr)) !== false; }
    catch (error) { status(errorText(error),true); }
    finally { pending.delete(pr.number); button.disabled = false; $('keluar').disabled = false; }
    if (ok) await loadPending();
  }
  async function loadPending() {
    const container = $('senarai-menunggu');
    container.replaceChildren(unsur('p','','Memuatkan permintaan…'));
    try {
      const prs = (await list(`${ROOT}/pulls?state=open&base=${BASE_BRANCH}`)).filter(pr => pr.head.ref.startsWith('berita-') && pr.head.repo?.full_name === `${OWNER}/${REPO}`);
      const cards = prs.map(pr => {
        const wrapper = unsur('div');
        try {
          const item = parsePR(pr);
          const raw = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${encodeURIComponent(pr.head.ref)}/${item.gambar}`;
          wrapper.append(kad(item,'../',item.gambar ? raw : undefined));
        } catch { wrapper.append(unsur('p','nota','Maklumat berita tidak sah. Semak permintaan tarik di GitHub.')); return wrapper; }
        wrapper.append(unsur('p','nota',`Dihantar oleh ${pr.user.login} · ${new Date(pr.created_at).toLocaleString('ms-MY')}`));
        const actions = unsur('div','actions');
        const approveButton = unsur('button','','Lulus & Terbit');
        approveButton.type = 'button';
        approveButton.disabled = REQUIRE_DIFFERENT_APPROVER && pr.user.login.toLowerCase() === user.login.toLowerCase();
        if (approveButton.disabled) wrapper.append(unsur('p','nota','Perlu diluluskan oleh webmaster lain.'));
        approveButton.addEventListener('click',() => action(pr,approveButton,approve));
        const rejectButton = unsur('button','tolak','Tolak'); rejectButton.type = 'button';
        rejectButton.addEventListener('click',() => action(pr,rejectButton,reject));
        actions.append(approveButton,rejectButton); wrapper.append(actions);
        return wrapper;
      });
      container.replaceChildren(...(cards.length ? cards : [unsur('p','','Tiada berita menunggu kelulusan.')]));
    } catch (error) { container.replaceChildren(unsur('p','',errorText(error))); }
  }
  async function loadPublished() {
    const container = $('senarai-disiarkan');
    container.replaceChildren(unsur('p','','Memuatkan berita…'));
    try {
      const data = await file('data/berita.json');
      const items = JSON.parse(decode(data.content));
      if (!Array.isArray(items)) throw new Error('Senarai berita tidak sah.');
      items.forEach(sah); items.sort((a,b) => b.tarikh.localeCompare(a.tarikh));
      container.replaceChildren(...(items.length ? items.map(item => kad(item,'../',item.gambar ? `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BASE_BRANCH}/${item.gambar}?v=${data.sha}` : undefined)) : [unsur('p','','Tiada berita buat masa ini.')]));
    } catch (error) { container.replaceChildren(unsur('p','',errorText(error))); }
  }
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click',() => {
    document.querySelectorAll('[data-tab]').forEach(tab => tab.setAttribute('aria-pressed',String(tab === button)));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.hidden = panel.id !== button.dataset.tab);
    if (button.dataset.tab === 'menunggu') loadPending();
    if (button.dataset.tab === 'disiarkan') loadPublished();
  }));
  $('muat-semula').addEventListener('click',loadPending);
  $('segerak').addEventListener('click',async () => {
    $('segerak').disabled = true; $('keluar').disabled = true;
    try { await rebuild(); status('Senarai berita berjaya disegerakkan.'); await loadPublished(); }
    catch (error) { status(errorText(error),true); }
    finally { $('segerak').disabled = false; $('keluar').disabled = false; }
  });
  preview();
  (async () => {
    try {
      token = localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || '';
      if (!token) return;
      user = await api('/user'); loggedIn();
    } catch (error) { token = ''; user = null; clearStorage(); status(errorText(error),true); }
  })();
})();
