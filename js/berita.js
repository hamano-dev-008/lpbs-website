(() => {
  'use strict';
  const kategori = ['Aktiviti', 'Hebahan', 'Kenyataan'];
  const bulan = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
  function sah(item) {
    if (!item || !kategori.includes(item.kategori) || !/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(item.id) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.tarikh) || !Number.isFinite(Date.parse(item.tarikh)) || new Date(item.tarikh).toISOString().slice(0,10) !== item.tarikh ||
        typeof item.tajuk !== 'string' || !item.tajuk.trim() || typeof item.ringkasan !== 'string' ||
        item.ringkasan.length > 300 || typeof item.gambar !== 'string' ||
        (item.gambar && !/^assets\/berita\/[a-z0-9-]+\.(jpg|png|webp)$/.test(item.gambar))) {
      throw new Error('Maklumat berita tidak sah.');
    }
    return item;
  }
  function tarikh(value) {
    const [y,m,d] = value.split('-').map(Number);
    return `${d} ${bulan[m - 1]} ${y}`;
  }
  function unsur(tag, kelas, teks) {
    const el = document.createElement(tag);
    if (kelas) el.className = kelas;
    if (teks !== undefined) el.textContent = teks;
    return el;
  }
  function kad(item, base = '', imageURL) {
    sah(item);
    const card = unsur('article', 'kad-berita');
    if (item.gambar) {
      const img = unsur('img', 'berita-gambar');
      img.src = imageURL || base + item.gambar;
      img.alt = item.tajuk;
      img.loading = 'lazy';
      card.append(img);
    } else card.append(unsur('div', 'berita-bar'));
    const body = unsur('div', 'berita-kandungan');
    const meta = unsur('div', 'berita-meta');
    meta.append(unsur('span', `badge-kategori badge-${item.kategori.toLowerCase()}`, item.kategori), unsur('span', 'berita-tarikh', tarikh(item.tarikh)));
    body.append(meta, unsur('h3', '', item.tajuk), unsur('p', '', item.ringkasan));
    card.append(body);
    return card;
  }
  window.LPBSBerita = { sah, tarikh, kad, unsur };
  for (const id of ['senarai-berita', 'arkib-berita']) {
    const container = document.getElementById(id);
    if (!container) continue;
    const base = container.dataset.base || '';
    fetch(base + 'data/berita.json').then(res => {
      if (!res.ok) throw new Error();
      return res.json();
    }).then(items => {
      if (!Array.isArray(items)) throw new Error();
      items.forEach(sah);
      items.sort((a,b) => b.tarikh.localeCompare(a.tarikh));
      const shown = id === 'senarai-berita' ? items.slice(0,3) : items;
      const cards = shown.map(item => kad(item, base));
      container.replaceChildren(...(cards.length ? cards : [unsur('p', '', 'Tiada berita buat masa ini.')]));
    }).catch(() => { /* Kekalkan kad sandaran apabila data tidak tersedia. */ });
  }
})();
