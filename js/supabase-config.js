const SUPABASE_URL  = 'https://zgscyfpqwbmwemzqtvpx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_m0ifDrZ8vL6MSMHPp00trQ_dkG3KzBm';
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON = SUPABASE_ANON;

window.formatTel = function(input) {
  const pos = input.selectionStart;
  const digitsBeforeCursor = input.value.slice(0, pos).replace(/\D/g, '').length;
  const digits = input.value.replace(/\D/g, '').slice(0, 10);
  const formatted = digits.match(/.{1,2}/g)?.join(' ') ?? digits;
  input.value = formatted;
  let newPos = 0, count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) count++;
    if (count === digitsBeforeCursor) { newPos = i + 1; break; }
  }
  input.setSelectionRange(newPos, newPos);
};
