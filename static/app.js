/* ═══════════════════════════════════════════════════════════
   DRONE COMPLY — Application Logic + 3D Scene
   ═══════════════════════════════════════════════════════════ */

const API = window.location.origin;

// ── 3D Background Scene (Three.js) ─────────────────────────
(function init3D() {
  const canvas = document.getElementById('bg-canvas');
  if (!window.THREE) return;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  camera.position.set(0, 0, 30);

  // Wireframe globe
  const globeGeo  = new THREE.IcosahedronGeometry(10, 2);
  const globeMat  = new THREE.MeshBasicMaterial({
    color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.06
  });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  scene.add(globe);

  // Floating ring
  const ringGeo = new THREE.TorusGeometry(14, 0.08, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6, transparent: true, opacity: 0.12
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 3;
  scene.add(ring);

  // Second ring
  const ring2Geo = new THREE.TorusGeometry(12, 0.05, 16, 80);
  const ring2Mat = new THREE.MeshBasicMaterial({
    color: 0x3b82f6, transparent: true, opacity: 0.08
  });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.rotation.x = -Math.PI / 4;
  ring2.rotation.y = Math.PI / 5;
  scene.add(ring2);

  // Particle field
  const particleCount = 300;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x06b6d4, size: 0.08, transparent: true, opacity: 0.5
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Floating octahedron (drone metaphor)
  const octoGeo = new THREE.OctahedronGeometry(2, 0);
  const octoMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.15
  });
  const octo = new THREE.Mesh(octoGeo, octoMat);
  octo.position.set(8, 4, -5);
  scene.add(octo);

  // Mouse parallax
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / innerWidth - 0.5) * 2;
    mouseY = (e.clientY / innerHeight - 0.5) * 2;
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    const t = Date.now() * 0.001;

    globe.rotation.y += 0.001;
    globe.rotation.x += 0.0005;

    ring.rotation.z += 0.002;
    ring2.rotation.z -= 0.0015;

    particles.rotation.y += 0.0003;

    octo.rotation.y += 0.008;
    octo.rotation.x += 0.005;
    octo.position.y = 4 + Math.sin(t * 0.8) * 1.5;
    octo.position.x = 8 + Math.cos(t * 0.5) * 1;

    // Parallax
    camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 2 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();

// ── HTML Particles ──────────────────────────────────────────
(function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.animationDuration = (6 + Math.random() * 6) + 's';
    const hue = Math.random() > 0.5 ? '188' : '260';
    p.style.background = `hsl(${hue}, 80%, 60%)`;
    p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
    container.appendChild(p);
  }
})();

// ── Tab Switching ───────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ── API Health Check ────────────────────────────────────────
async function checkHealth() {
  const dot  = document.getElementById('apiStatus');
  const text = document.getElementById('apiStatusText');
  try {
    const r = await fetch(API + '/health');
    if (r.ok) {
      const d = await r.json();
      dot.className = 'status-dot online';
      text.textContent = 'API v' + d.version;
    } else throw new Error();
  } catch {
    dot.className = 'status-dot offline';
    text.textContent = 'Offline';
  }
}
checkHealth();
setInterval(checkHealth, 15000);

// ── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'error') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── SORA Form ───────────────────────────────────────────────
document.getElementById('soraForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('soraSubmitBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  const body = {
    mtom_grams:                parseFloat(document.getElementById('mtom_grams').value),
    max_speed_ms:              parseFloat(document.getElementById('max_speed_ms').value),
    characteristic_dimension_m: parseFloat(document.getElementById('characteristic_dimension_m').value),
    population_density_band:    document.querySelector('input[name="population_density_band"]:checked').value,
    arc:                        document.getElementById('arc').value,
    altitude_m:                 parseFloat(document.getElementById('altitude_m').value),
  };

  const cc = document.getElementById('country_code').value.trim();
  if (cc) body.country_code = cc;

  try {
    const res = await fetch(API + '/sora/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    renderSoraResults(data);
    showToast('SORA assessment completed successfully', 'success');
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

function renderSoraResults(d) {
  document.getElementById('soraEmptyState').style.display = 'none';
  const cards = document.getElementById('soraResultCards');
  cards.classList.remove('hidden');

  // Re-trigger animations
  cards.style.display = 'none';
  void cards.offsetHeight;
  cards.style.display = '';

  // Metrics
  const bypassEl = document.getElementById('valBypass');
  bypassEl.textContent = d.bypass_applied ? 'ACTIVE' : 'N/A';
  bypassEl.style.color = d.bypass_applied ? '#22c55e' : '#8b8fa8';

  document.getElementById('valKE').textContent = d.kinetic_energy_j !== null
    ? d.kinetic_energy_j.toFixed(1) + ' J' : '—';
  document.getElementById('valGRC').textContent = d.igrc;
  document.getElementById('valSAIL').textContent = d.sail;
  document.getElementById('valARC').textContent = d.arc;

  // Color code GRC
  const grcEl = document.getElementById('valGRC');
  if (d.igrc <= 2) grcEl.style.color = '#22c55e';
  else if (d.igrc <= 4) grcEl.style.color = '#f59e0b';
  else if (d.igrc <= 6) grcEl.style.color = '#ef4444';
  else grcEl.style.color = '#dc2626';

  // Color code SAIL
  const sailEl = document.getElementById('valSAIL');
  if (d.sail <= 2) sailEl.style.color = '#22c55e';
  else if (d.sail <= 4) sailEl.style.color = '#f59e0b';
  else sailEl.style.color = '#ef4444';

  // Gauge: SAIL 1-6 → 0-100%
  const pct = Math.min(((d.sail) / 6) * 100, 100);
  document.getElementById('gaugeFill').style.width = pct + '%';
  document.getElementById('gaugeMarker').style.left = pct + '%';

  // Gauge color
  const fill = document.getElementById('gaugeFill');
  if (pct <= 33) fill.style.background = 'linear-gradient(90deg, #22c55e, #06b6d4)';
  else if (pct <= 66) fill.style.background = 'linear-gradient(90deg, #06b6d4, #f59e0b)';
  else fill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';

  // OSO table
  const tbody = document.getElementById('osoTableBody');
  tbody.innerHTML = '';
  document.getElementById('osoCount').textContent = d.oso_requirements.length + ' OSOs';

  d.oso_requirements.forEach((oso, i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = (i * 0.03) + 's';
    const robClass = 'rob-' + oso.robustness;
    tr.innerHTML = `
      <td><span class="oso-num">OSO #${oso.oso_number}</span></td>
      <td>${escapeHtml(oso.title)}</td>
      <td><span class="robustness-badge ${robClass}">${escapeHtml(oso.robustness)}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Country flags
  const countryCard = document.getElementById('countryCard');
  const flagsDiv = document.getElementById('countryFlags');
  if (d.country_flags && d.country_flags.length > 0) {
    countryCard.classList.remove('hidden');
    flagsDiv.innerHTML = '';
    d.country_flags.forEach(f => {
      const item = document.createElement('div');
      item.className = 'country-flag-item';
      item.innerHTML = `<span class="flag-key">${escapeHtml(f.rule_key)}</span><span class="flag-desc">${escapeHtml(f.description)}</span>`;
      flagsDiv.appendChild(item);
    });
  } else {
    countryCard.classList.add('hidden');
  }
}

// ── DMA Form ────────────────────────────────────────────────

// Add score row
document.getElementById('addScoreRow').addEventListener('click', () => {
  const editor = document.getElementById('scoresEditor');
  const row = document.createElement('div');
  row.className = 'score-row';
  row.innerHTML = `
    <input type="text" class="score-key field-input" placeholder="question_key" />
    <input type="number" class="score-value field-input" placeholder="score" min="0" step="any" />
    <button type="button" class="btn-icon btn-remove-score" title="Remove">✕</button>
  `;
  editor.appendChild(row);
});

// Remove score row
document.getElementById('scoresEditor').addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-remove-score')) {
    const rows = document.querySelectorAll('.score-row');
    if (rows.length > 1) e.target.closest('.score-row').remove();
  }
});

document.getElementById('dmaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('dmaSubmitBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  // Collect scores
  const scores = {};
  document.querySelectorAll('.score-row').forEach(row => {
    const key = row.querySelector('.score-key').value.trim();
    const val = row.querySelector('.score-value').value.trim();
    if (key && val !== '') scores[key] = parseFloat(val);
  });

  const body = {
    dimension: document.getElementById('dma_dimension').value.trim(),
    scores,
  };

  try {
    if (Object.keys(scores).length === 0) throw new Error('Add at least one score entry');

    const res = await fetch(API + '/dma/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    renderDmaResults(data);
    showToast('DMA evaluation completed successfully', 'success');
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

function renderDmaResults(d) {
  document.getElementById('dmaEmptyState').style.display = 'none';
  const cards = document.getElementById('dmaResultCards');
  cards.classList.remove('hidden');
  cards.style.display = 'none';
  void cards.offsetHeight;
  cards.style.display = '';

  document.getElementById('valDimension').textContent = d.dimension;
  document.getElementById('valMaturityLevel').textContent = 'Level ' + d.maturity_level;
  document.getElementById('valMaturityLabel').textContent = d.maturity_label;

  // Color code maturity level
  const lvlEl = document.getElementById('valMaturityLevel');
  const colors = ['', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4'];
  lvlEl.style.color = colors[d.maturity_level] || '#8b8fa8';

  document.getElementById('valRawScore').textContent = d.raw_weighted_score.toFixed(2);
  document.getElementById('valMaxScore').textContent = d.max_weighted_score.toFixed(2);
  document.getElementById('valNormPct').textContent = d.normalised_pct.toFixed(1) + '%';
  document.getElementById('valPct').textContent = Math.round(d.normalised_pct) + '%';

  // Animate ring
  const arc = document.getElementById('maturityArc');
  const circumference = 2 * Math.PI * 60; // r=60
  const offset = circumference - (d.normalised_pct / 100) * circumference;
  arc.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)';
  arc.style.strokeDashoffset = offset;
}
