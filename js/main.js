/* ============================================
   LPBS - Lembaga Padi dan Beras Sabah
   Skrip Utama JavaScript
   ============================================ */

// --- Menu Hamburger untuk Mudah Alih ---
const hamburger = document.querySelector('.hamburger');
const navDalam = document.querySelector('.nav-dalam');

if (hamburger && navDalam) {
  hamburger.addEventListener('click', () => {
    navDalam.classList.toggle('buka');
    const garisan = hamburger.querySelectorAll('span');
    garisan[0].style.transform = navDalam.classList.contains('buka') ? 'rotate(45deg) translate(5px, 5px)' : '';
    garisan[1].style.opacity  = navDalam.classList.contains('buka') ? '0' : '1';
    garisan[2].style.transform = navDalam.classList.contains('buka') ? 'rotate(-45deg) translate(5px, -5px)' : '';
  });
}

// --- Dropdown pada Mudah Alih (klik) ---
if (window.innerWidth <= 768) {
  document.querySelectorAll('.nav-item > a').forEach(pautan => {
    const dropdown = pautan.nextElementSibling;
    if (dropdown && dropdown.classList.contains('dropdown')) {
      pautan.addEventListener('click', (e) => {
        e.preventDefault();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
      });
    }
  });
}

// --- Animasi Kaunter Statistik ---
function animasiKaunter(elemen, sasaran, tempoh) {
  const mula = performance.now();
  const nilaiasal = 0;

  function kemaskini(masa) {
    const berlalu = masa - mula;
    const kemajuan = Math.min(berlalu / tempoh, 1);
    // Fungsi easing easeOutQuart
    const kemudahan = 1 - Math.pow(1 - kemajuan, 4);
    const semasa = Math.floor(kemudahan * sasaran);

    if (sasaran >= 1000) {
      elemen.textContent = semasa.toLocaleString('ms-MY');
    } else if (elemen.dataset.sufiks) {
      elemen.textContent = semasa + elemen.dataset.sufiks;
    } else {
      elemen.textContent = semasa;
    }

    if (kemajuan < 1) {
      requestAnimationFrame(kemaskini);
    } else {
      if (sasaran >= 1000) {
        elemen.textContent = sasaran.toLocaleString('ms-MY');
      } else if (elemen.dataset.sufiks) {
        elemen.textContent = sasaran + elemen.dataset.sufiks;
      } else {
        elemen.textContent = sasaran;
      }
    }
  }
  requestAnimationFrame(kemaskini);
}

// Gunakan IntersectionObserver untuk mulakan kaunter bila kelihatan
const pemerhati = new IntersectionObserver((entri) => {
  entri.forEach(entri => {
    if (entri.isIntersecting) {
      const elemen = entri.target;
      const sasaran = parseInt(elemen.dataset.sasaran);
      animasiKaunter(elemen, sasaran, 2000);
      pemerhati.unobserve(elemen);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.stat-nombor[data-sasaran]').forEach(el => {
  pemerhati.observe(el);
});

// --- Tandakan Pautan Nav Aktif ---
const halamanSemasa = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-item > a').forEach(pautan => {
  const href = pautan.getAttribute('href');
  if (href && (href === halamanSemasa || href.includes(halamanSemasa))) {
    pautan.classList.add('aktif');
  }
});

// --- Tatal Lembut untuk Pautan Sauh ---
document.querySelectorAll('a[href^="#"]').forEach(sauh => {
  sauh.addEventListener('click', function(e) {
    const id = this.getAttribute('href').slice(1);
    const sasaran = document.getElementById(id);
    if (sasaran) {
      e.preventDefault();
      sasaran.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
