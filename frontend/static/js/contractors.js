// -------- utilities --------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getCsrf() {
  const m = document.querySelector('meta[name="csrf-token"]');
  return m && m.content ? m.content : null;
}

function setCounts(deltaActive = 0, deltaPending = 0) {
  const toInt = (el) => parseInt(el.textContent.trim(), 10) || 0;
  const activeEl = $('#active-count');
  const pendingEl = $('#pending-count');
  if (activeEl) activeEl.textContent = toInt(activeEl) + deltaActive;
  if (pendingEl) pendingEl.textContent = Math.max(0, toInt(pendingEl) + deltaPending);
}

// -------- tabs --------
function switchTab(tabName) {
  $$('.tab-content').forEach(c => c.classList.remove('active'));
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(`${tabName}-contractors`);
  if (target) target.classList.add('active');
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');
}

// -------- profile modal (phone removed) --------
let currentContractorId = null;

function viewContractorProfile(contractorId) {
  currentContractorId = contractorId;
  fetch(`/api/contractor/profile/${contractorId}`)
    .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
    .then(c => {
      $('#contractor-profile-title').textContent = c.name || 'Contractor Profile';
      $('#contractor-company').textContent = c.company ?? '-';
      $('#contractor-email').textContent = c.email ?? '-';
      $('#contractor-specialization').textContent = c.specialization ?? '-';
      $('#contractor-jobs-assigned').textContent = c.jobs_assigned ?? 0;
      $('#contractor-jobs-completed').textContent = c.jobs_completed ?? 0;
      const removeBtn = $('#remove-contractor-btn');
      if (removeBtn) removeBtn.onclick = () => removeContractor(contractorId);
      $('#contractor-profile-modal').classList.add('active');
      $('#overlay').classList.add('active');
    })
    .catch(() => alert('Failed to load contractor profile.'));
}

function closeContractorProfileModal() {
  $('#contractor-profile-modal').classList.remove('active');
  $('#overlay').classList.remove('active');
}

function removeContractor(contractorId) {
  if (!confirm('Remove this contractor?')) return;
  fetch(`/admin/contractor/remove/${contractorId}`, { method: 'POST' })
    .then(r => r.json())
    .then(res => { alert(res.message || 'Removed'); location.reload(); })
    .catch(() => alert('Error removing contractor.'));
}

// -------- approve flow with popup --------
let approveCtx = { id: null, row: null, btn: null };

function openApproveModal(contractorId, btnEl) {
  const row = btnEl.closest('tr');
  approveCtx = { id: contractorId, row, btn: btnEl };
  const company = row?.children[1]?.textContent?.trim() || 'this contractor';
  $('#approve-text').textContent = `Approve ${company}?`;
  $('#approve-modal').classList.add('active');
  $('#overlay').classList.add('active');
}

function closeApproveModal() {
  $('#approve-modal').classList.remove('active');
  $('#overlay').classList.remove('active');
  approveCtx = { id: null, row: null, btn: null };
}

async function confirmApprove() {
  if (!approveCtx.id) return;

  // disable button while processing
  if (approveCtx.btn) {
    approveCtx.btn.disabled = true;
    approveCtx.btn.textContent = 'Approving...';
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    const csrf = getCsrf();
    if (csrf) headers['X-CSRFToken'] = csrf;

    const res = await fetch(`/admin/contractors/approve/${approveCtx.id}`, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ contractor_id: approveCtx.id })
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    const data = await res.json();

    // move row to Active table
    const row = approveCtx.row;
    if (row) {
      const id = row.children[0].textContent.trim();
      const company = row.children[1].textContent.trim();
      const email = row.children[2].textContent.trim();

      const newRow = document.createElement('tr');
      newRow.innerHTML = `
        <td>${id}</td>
        <td>${company}</td>
        <td>${email}</td>
        <td>0</td>
      `;
      $('#active-contractors tbody').appendChild(newRow);
      row.remove();
      setCounts(+1, -1);
    }

    closeApproveModal();
    alert(data.message || 'Contractor approved');
  } catch (err) {
    console.error(err);
    alert('Error approving contractor. Check server route and CSRF.');
    if (approveCtx.btn) {
      approveCtx.btn.disabled = false;
      approveCtx.btn.textContent = 'Approve';
    }
  }
}

// bind modal confirm button
document.addEventListener('DOMContentLoaded', () => {
  switchTab('active');
  const confirmBtn = $('#approve-confirm-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmApprove);
});

// -------- expose for inline calls --------
window.switchTab = switchTab;
window.viewContractorProfile = viewContractorProfile;
window.closeContractorProfileModal = closeContractorProfileModal;
window.openApproveModal = openApproveModal;
window.closeApproveModal = closeApproveModal;
