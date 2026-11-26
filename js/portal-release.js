(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const panelNames = ['overview','tickets','messages','notifications','profile'];
  let client = null;
  let user = null;
  let tickets = [];
  let selectedTicket = null;

  function notice(message, kind = 'info') {
    const banner = $('#portal-banner');
    banner.textContent = message;
    banner.dataset.kind = kind;
  }

  function showPanel(name) {
    if (!panelNames.includes(name)) return;
    $$('[data-panel]').forEach((button) => {
      const active = button.dataset.panel === name;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    });
    $$('[data-view]').forEach((panel) => { panel.hidden = panel.dataset.view !== name; });
    $('#portal-title').textContent = name === 'profile' ? 'Profile' : name.charAt(0).toUpperCase() + name.slice(1);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(date);
  }

  function empty(container, heading, body) {
    container.replaceChildren();
    const card = element('div','release-empty');
    card.append(element('strong','',heading), document.createTextNode(body));
    container.append(card);
  }

  function makeTicketRow(ticket, clickable = true) {
    const row = element('button','release-ticket-row');
    row.type = 'button';
    row.setAttribute('aria-label', `${ticket.ticket_number}: ${ticket.title}, ${window.ZeroDevApp.statusLabel(ticket.status)}`);
    const main = element('span');
    main.append(element('strong','',ticket.title), element('small','',`${ticket.ticket_number} · ${ticket.service.replace(/_/g,' ')} · ${formatDate(ticket.created_at)}`));
    if (ticket.quoted_amount !== null && ticket.quoted_amount !== undefined) {
      const amount = Number(ticket.quoted_amount);
      const discounted = amount * (1 - Number(ticket.promo_discount_percent || 0) / 100);
      const formatted = new Intl.NumberFormat(undefined, { style:'currency', currency:ticket.quoted_currency || 'PHP', maximumFractionDigits:2 }).format(discounted);
      main.append(element('small','',`Quotation: ${formatted}${ticket.promo_discount_percent ? ` · ${ticket.promo_discount_percent}% NEW26 applied` : ''} · ${window.ZeroDevApp.statusLabel(ticket.quote_status)}`));
    }
    const meta = element('span');
    meta.append(element('span',`release-status status-${ticket.status}`,window.ZeroDevApp.statusLabel(ticket.status)));
    row.append(main,meta);
    if (clickable) row.addEventListener('click', () => { selectedTicket = ticket; showPanel('messages'); loadMessages(ticket).catch(showError); });
    return row;
  }

  function showError(error) {
    notice(error?.message || 'The workspace could not load. Refresh and try again.', 'error');
  }

  async function loadTickets() {
    const { data, error } = await client.from('tickets')
      .select('id,ticket_number,title,service,status,created_at,updated_at,quoted_amount,quoted_currency,quote_status,promo_discount_percent')
      .order('created_at',{ascending:false});
    if (error) throw error;
    tickets = data || [];
    const active = tickets.filter((ticket) => !['completed','closed'].includes(ticket.status)).length;
    $('#stat-tickets').textContent = String(tickets.length);
    $('#stat-progress').textContent = String(active);
    const targets = [$('#overview-tickets'),$('#all-tickets'),$('#message-ticket-list')];
    targets.forEach((target) => {
      if (!tickets.length) { empty(target,'No project requests yet.','Start a project request and it will appear here.'); return; }
      target.replaceChildren(...tickets.map((ticket) => makeTicketRow(ticket)));
    });
  }

  async function loadMessages(ticket) {
    $('#thread-title').textContent = ticket.title;
    $('#thread-subtitle').textContent = `${ticket.ticket_number} · ${window.ZeroDevApp.statusLabel(ticket.status)}`;
    const quoteBox = $('#ticket-quote-preview');
    if (ticket.quoted_amount !== null && ticket.quoted_amount !== undefined) {
      const original = Number(ticket.quoted_amount);
      const discounted = original * (1 - Number(ticket.promo_discount_percent || 0) / 100);
      const formatter = new Intl.NumberFormat(undefined,{style:'currency',currency:ticket.quoted_currency || 'PHP',maximumFractionDigits:2});
      quoteBox.textContent = `Studio quotation: ${formatter.format(discounted)}${ticket.promo_discount_percent ? ` (includes your ${ticket.promo_discount_percent}% NEW26 discount)` : ''} · ${window.ZeroDevApp.statusLabel(ticket.quote_status)}. Confirm final scope and terms with the studio before making any payment.`;
      quoteBox.hidden = false;
    } else { quoteBox.hidden = true; quoteBox.textContent = ''; }
    const thread = $('#message-thread');
    empty(thread,'Loading messages…','');
    const { data, error } = await client.from('ticket_messages')
      .select('id,sender_id,body,is_internal,created_at')
      .eq('ticket_id',ticket.id).order('created_at',{ascending:true});
    if (error) throw error;
    thread.replaceChildren();
    if (!data?.length) empty(thread,'No messages yet.','Send the first message to begin the project conversation.');
    else data.forEach((message) => {
      const isMine = message.sender_id === user.id;
      const bubble = element('article',`release-message${isMine ? ' mine' : ''}`);
      bubble.append(element('small','',isMine ? 'You' : 'ZeroDev Studio'),element('p','',message.body));
      bubble.append(element('time','',formatDate(message.created_at)));
      thread.append(bubble);
    });
    const { data: attachments, error: attachmentError } = await client.from('ticket_attachments').select('file_name,storage_path').eq('ticket_id',ticket.id);
    if (attachmentError) throw attachmentError;
    for (const attachment of (attachments || [])) {
      const { data: signed, error: signedError } = await client.storage.from('ticket-attachments').createSignedUrl(attachment.storage_path, 90);
      if (signedError || !signed?.signedUrl) continue;
      const link = element('a','release-text-link',`Attachment: ${attachment.file_name}`);
      link.href = signed.signedUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; thread.append(link);
    }
    const activityBox = $('#ticket-activity-preview');
    const activityList = $('#ticket-activity-list');
    const { data: events, error: eventError } = await client.from('ticket_events').select('event_type,description,created_at').eq('ticket_id',ticket.id).order('created_at',{ascending:false}).limit(8);
    if (eventError) throw eventError;
    activityList.replaceChildren();
    (events || []).forEach((item) => { const line = element('p','release-activity-item',`${item.description} · ${formatDate(item.created_at)}`); activityList.append(line); });
    activityBox.hidden = !(events || []).length;
    $('#client-send-message').disabled = ['closed'].includes(ticket.status);
    if (ticket.status === 'closed') $('#thread-subtitle').textContent += ' · This ticket is closed';
  }

  async function loadNotifications() {
    const host = $('#portal-notifications');
    const { data, error } = await client.from('notifications')
      .select('id,kind,title,body,read_at,created_at,ticket_id')
      .order('created_at',{ascending:false}).limit(40);
    if (error) throw error;
    $('#stat-unread').textContent = String((data || []).filter((item) => !item.read_at).length);
    host.replaceChildren();
    if (!data?.length) { empty(host,'You are all caught up.','New ticket updates and replies will appear here.'); return; }
    data.forEach((item) => {
      const row = element('article','release-notification');
      const icon = element('span','notification-icon',item.kind === 'new_message' ? '✉' : item.kind === 'ticket_created' ? '＋' : '↗');
      const body = element('div');
      body.append(element('strong','',item.title),element('p','',item.body),element('time','',formatDate(item.created_at)));
      row.append(icon,body);
      if (!item.read_at) {
        const mark = element('button','release-action secondary','Mark read');
        mark.type = 'button';
        mark.addEventListener('click', async () => {
          mark.disabled = true;
          const { error: updateError } = await client.from('notifications').update({ read_at:new Date().toISOString() }).eq('id',item.id);
          if (updateError) { showError(updateError); mark.disabled = false; return; }
          row.remove();
          const count = Math.max(0, Number($('#stat-unread').textContent || 0) - 1);
          $('#stat-unread').textContent = String(count);
          if (!host.children.length) empty(host,'You are all caught up.','New ticket updates and replies will appear here.');
        });
        row.append(mark);
      }
      host.append(row);
    });
  }

  async function refresh() {
    await loadTickets();
    await loadNotifications();
    notice('Connected. Ticket records, messages, and notifications are loaded from your private account workspace.','success');
  }

  $$('.release-nav [data-panel]').forEach((button) => button.addEventListener('click',() => showPanel(button.dataset.panel)));
  $('#client-message-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedTicket) { notice('Choose a ticket before sending a message.','warning'); return; }
    const textarea = $('#client-message');
    const body = textarea.value.trim();
    if (!body) return;
    const button = $('#client-send-message'); button.disabled = true;
    try {
      const { error } = await client.from('ticket_messages').insert({ ticket_id:selectedTicket.id, body });
      if (error) throw error;
      textarea.value = '';
      await loadMessages(selectedTicket);
      notice('Your message was sent to the project team.','success');
    } catch (error) { showError(error); }
    finally { button.disabled = selectedTicket?.status === 'closed'; }
  });

  $('#portal-refresh').addEventListener('click', () => refresh().then(() => { if (selectedTicket) return loadMessages(selectedTicket); }).catch(showError));

  $('#portal-sign-out').addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) showError(error); else window.location.href = '../account/index.html';
  });
  $('#portal-year').textContent = String(new Date().getFullYear());

  async function init() {
    if (window.ZERO_DEV_BACKEND_CONFIG?.mode !== 'live') {
      notice('DEMO MODE — the connected workspace is disabled. No sample ticket data is shown as real client information. Configure the backend to activate private accounts and project tools.','warning');
      empty($('#overview-tickets'),'Backend setup required.','The project list will populate after the v1.0 database migration is installed.');
      empty($('#all-tickets'),'Backend setup required.','Your private project requests will appear here.');
      empty($('#message-ticket-list'),'No active connection.','Messages are available after sign-in and backend setup.');
      empty($('#message-thread'),'No conversation selected.','Select a ticket after your workspace loads.');
      empty($('#portal-notifications'),'No active connection.','Notifications are created by ticket and message activity.');
      return;
    }
    try {
      client = await window.ZeroDevApp.getClient();
      user = await window.ZeroDevApp.requireUser(client);
      if (!user) return;
      $('#portal-user-label').textContent = user.email;
      $('#portal-avatar').textContent = (user.email || 'Z').slice(0,1).toUpperCase();
      $('#portal-welcome').textContent = `Welcome back, ${user.user_metadata?.full_name || user.email?.split('@')[0] || 'there'}.`;
      $('#profile-email').textContent = user.email || '—';
      $('#profile-name').textContent = user.user_metadata?.full_name || 'Not provided';
      $('#profile-verification').textContent = user.email_confirmed_at ? 'Verified' : 'Not verified';
      $('#profile-created').textContent = formatDate(user.created_at);
      await refresh();
    } catch (error) { showError(error); }
  }
  void init();
})();
