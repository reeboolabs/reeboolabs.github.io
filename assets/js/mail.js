/* Write-to-us panel. Every mailto link opens a small panel: copy the address, open Gmail / Outlook.com in the browser,
   or the computer's mail app. Without JavaScript the plain mailto link and the visible address still work. */
(() => {
  'use strict';
  const links = document.querySelectorAll('a[href^="mailto:"]');
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const dlg = el('dialog', 'mailbox');
  dlg.setAttribute('aria-labelledby', 'mailbox-title');
  const close = el('button', 'mailbox__close', 'Close');
  close.type = 'button';
  const title = el('h2', 'mailbox__title', 'Write to us');
  title.id = 'mailbox-title';
  const lead = el('p', 'mailbox__lead', 'Send a clip or a short description of your project. We reply by email.');
  const row = el('div', 'mailbox__row');
  const addr = el('span', 'mailbox__addr');
  const copy = el('button', 'btn btn--sm mailbox__copy', 'Copy address');
  copy.type = 'button';
  row.append(addr, copy);
  const status = el('p', 'mailbox__status');
  status.setAttribute('role', 'status');
  const opts = el('div', 'mailbox__opts');
  const mk = (label, cls) => { const a = el('a', 'btn btn--sm btn--ghost ' + cls, label); return a; };
  const gmail = mk('Open in Gmail', 'mailbox__gmail');
  const outlook = mk('Open in Outlook', 'mailbox__outlook');
  const app = mk('Use my mail app', 'mailbox__app');
  for (const a of [gmail, outlook]) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  opts.append(gmail, outlook, app);
  dlg.append(close, title, lead, row, status, opts);
  document.body.append(dlg);

  let to = '';
  const fill = (href) => {
    const u = new URL(href);
    to = decodeURIComponent(u.pathname);
    const subject = u.searchParams.get('subject') || 'Hello REEBOO Labs';
    addr.textContent = to;
    status.textContent = '';
    copy.textContent = 'Copy address';
    gmail.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to) + '&su=' + encodeURIComponent(subject);
    outlook.href = 'https://outlook.live.com/mail/0/deeplink/compose?to=' + encodeURIComponent(to) + '&subject=' + encodeURIComponent(subject);
    app.href = href;
  };
  fill(links[0].href);
  const open = (href) => {
    fill(href);
    dlg.showModal();
    copy.focus();
  };

  for (const a of links) {
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', (ev) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      open(a.href);
    });
  }

  const selectAddr = () => { const r = document.createRange(); r.selectNodeContents(addr); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(to);
      copy.textContent = 'Copied';
      status.textContent = 'Address copied. Paste it into any email.';
    } catch (_) {
      selectAddr();
      status.textContent = 'Press Ctrl+C (or Cmd+C) to copy the selected address.';
    }
  });
  app.addEventListener('click', () => { status.textContent = 'If nothing opens, your computer has no mail app set up. Use Gmail, Outlook or copy the address.'; });
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
})();
