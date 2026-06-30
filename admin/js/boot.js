function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `show ${type}`;
  setTimeout(() => t.className = '', 3500);
}
window.addEventListener('DOMContentLoaded', () => {
  token = localStorage.getItem('bde_admin_token') || '';
  document.getElementById('btn-logout').style.display = 'none';
  if (token) init();
});