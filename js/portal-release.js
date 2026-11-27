(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const panels = ['overview','tickets','messages','notifications','profile'];
  let client = null;
  let user = null;
  let tickets = [];
  let notifications = [];
  let selectedTicket = null;
  let unreadByTicket = new Map();

  function notice(message, kind='info') { const banner=$('#portal-banner'); banner.textContent=message; banner.dataset.kind=kind; }
  function showPanel(name) {
    if(!panels.includes(name)) return;
    $$('.release-nav [data-panel]').forEach((button)=>{const active=button.dataset.panel===name;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    $$('[data-view]').forEach((panel)=>{panel.hidden=panel.dataset.view!==name;});
    $('#portal-title').textContent=name==='profile'?'Profile':name.charAt(0).toUpperCase()+name.slice(1);
  }
  function element(tag,className,text) { const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node; }
  function formatDate(value) { if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date); }
  function empty(container,heading,body) { if(!container)return;container.replaceChildren();const card=element('div','release-empty');card.append(element('strong','',heading),document.createTextNode(body));container.append(card); }
  function unreadCount(ticketId) { return unreadByTicket.get(ticketId)||0; }
  function makeTicketRow(ticket) {
    const row=element('button','release-ticket-row');row.type='button';row.setAttribute('aria-label',`${ticket.ticket_number}: ${ticket.title}, ${window.ZeroDevApp.statusLabel(ticket.status)}`);
    const main=element('span');main.append(element('strong','',ticket.title),element('small','',`${ticket.ticket_number} · ${ticket.service.replace(/_/g,' ')} · ${formatDate(ticket.created_at)}`));
    if(ticket.quoted_amount!==null&&ticket.quoted_amount!==undefined){
      const base=Number(ticket.quoted_amount)*(1-Number(ticket.promo_discount_percent||0)/100);
      const currency=ticket.quoted_currency||'PHP';
      const formatted=window.ZeroDevLocale?.format(base,currency)||`${currency} ${base.toFixed(2)}`;
      main.append(element('small','',`Quotation: ${formatted}${ticket.promo_discount_percent?` · ${ticket.promo_discount_percent}% NEW26 applied`:''} · ${window.ZeroDevApp.statusLabel(ticket.quote_status)}`));
      if(window.ZeroDevLocale&&currency!==window.ZeroDevLocale.currency){
        const fxLine=element('small','v11-fx-line','Indicative display equivalent: ');
        const fxValue=element('strong','');fxValue.dataset.fxDisplay='';fxValue.dataset.fxAmount=String(base);fxValue.dataset.fxBase=currency;fxValue.textContent='Updating…';fxLine.append(fxValue);main.append(fxLine);
      }
    }
    const meta=element('span');meta.append(element('span',`release-status status-${ticket.status}`,window.ZeroDevApp.statusLabel(ticket.status)));
    if(unreadCount(ticket.id)){const badge=element('span','v11-badge',`${unreadCount(ticket.id)} unread`);meta.append(badge);}
    row.append(main,meta);row.addEventListener('click',()=>{selectedTicket=ticket;showPanel('messages');loadMessages(ticket).then(markTicketMessagesRead).catch(showError);});
    return row;
  }
  function showError(error){notice(error?.message||'The workspace could not load. Refresh and try again.','error');}
  function filteredTickets(){
    const query=String($('#ticket-search')?.value||'').trim().toLowerCase();
    const status=$('#ticket-status-filter')?.value||'all';
    return tickets.filter((ticket)=>{
      const matchesStatus=status==='all'||ticket.status===status;
      const text=`${ticket.title} ${ticket.ticket_number} ${ticket.service}`.toLowerCase();
      return matchesStatus&&(!query||text.includes(query));
    });
  }
  function renderTickets(){
    const recent=tickets.slice(0,4);
    const overview=$('#overview-tickets');
    if(!tickets.length)empty(overview,'No project requests yet.','Start a project request and it will appear here.');
    else overview.replaceChildren(...recent.map(makeTicketRow));
    const list=$('#all-tickets');const filtered=filteredTickets();
    if(!filtered.length)empty(list,'No matching project requests.','Change the search or status filter to see other tickets.');
    else list.replaceChildren(...filtered.map(makeTicketRow));
    const messageList=$('#message-ticket-list');
    if(!tickets.length)empty(messageList,'No project requests yet.','Start a project request to begin a conversation.');
    else messageList.replaceChildren(...tickets.map(makeTicketRow));
    window.ZeroDevLocale?.refreshCurrencyDisplays();
  }
  async function loadTickets(){
    const {data,error}=await client.from('tickets').select('id,ticket_number,title,service,status,created_at,updated_at,quoted_amount,quoted_currency,quote_status,promo_discount_percent').order('created_at',{ascending:false});
    if(error)throw error;tickets=data||[];
    $('#stat-tickets').textContent=String(tickets.length);
    $('#stat-progress').textContent=String(tickets.filter((ticket)=>!['completed','closed'].includes(ticket.status)).length);
    renderTickets();
  }
  async function loadNotifications(){
    const {data,error}=await client.from('notifications').select('id,kind,title,body,read_at,created_at,ticket_id').order('created_at',{ascending:false}).limit(60);
    if(error)throw error;notifications=data||[];unreadByTicket=new Map();
    notifications.filter((item)=>!item.read_at&&item.ticket_id&&item.kind==='new_message').forEach((item)=>unreadByTicket.set(item.ticket_id,(unreadByTicket.get(item.ticket_id)||0)+1));
    $('#stat-unread').textContent=String(notifications.filter((item)=>!item.read_at).length);
    renderTickets();
    const host=$('#portal-notifications');host.replaceChildren();
    if(!notifications.length){empty(host,'You are all caught up.','New ticket updates and replies will appear here.');return;}
    notifications.forEach((item)=>{
      const row=element('article','release-notification');
      row.append(element('span','notification-icon',item.kind==='new_message'?'✉':item.kind==='ticket_created'?'＋':'↗'));
      const body=element('div');body.append(element('strong','',item.title),element('p','',item.body),element('time','',formatDate(item.created_at)));row.append(body);
      if(!item.read_at){const mark=element('button','release-action secondary','Mark read');mark.type='button';mark.addEventListener('click',async()=>{mark.disabled=true;try{const {error:updateError}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',item.id);if(updateError)throw updateError;item.read_at=new Date().toISOString();await loadNotifications();}catch(error){showError(error);mark.disabled=false;}});row.append(mark);}
      host.append(row);
    });
  }
  async function markTicketMessagesRead(){
    if(!selectedTicket)return;
    const unread=notifications.filter((item)=>item.ticket_id===selectedTicket.id&&item.kind==='new_message'&&!item.read_at);
    if(!unread.length)return;
    const {error}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('ticket_id',selectedTicket.id).eq('kind','new_message').is('read_at',null);
    if(error)throw error;
    await loadNotifications();
  }
  function renderTimeline(events){
    const box=$('#ticket-activity-preview');const list=$('#ticket-activity-list');list.replaceChildren();
    if(!events.length){box.hidden=true;return;}
    const timeline=element('div','v11-timeline');
    events.forEach((item)=>{const line=element('div','v11-timeline-item');line.append(element('span','v11-timeline-dot'));const content=element('div');content.append(element('p','',item.description||window.ZeroDevApp.statusLabel(item.event_type)),element('time','',formatDate(item.created_at)));line.append(content);timeline.append(line);});
    list.append(timeline);box.hidden=false;
  }
  async function loadMessages(ticket){
    $('#thread-title').textContent=ticket.title;$('#thread-subtitle').textContent=`${ticket.ticket_number} · ${window.ZeroDevApp.statusLabel(ticket.status)}`;
    const quoteBox=$('#ticket-quote-preview');
    quoteBox.replaceChildren();
    if(ticket.quoted_amount!==null&&ticket.quoted_amount!==undefined){
      const amount=Number(ticket.quoted_amount)*(1-Number(ticket.promo_discount_percent||0)/100);
      const currency=ticket.quoted_currency||'PHP';
      const formatted=window.ZeroDevLocale?.format(amount,currency)||`${currency} ${amount.toFixed(2)}`;
      quoteBox.append(element('span','',`Studio quotation: ${formatted}${ticket.promo_discount_percent?` (includes your ${ticket.promo_discount_percent}% NEW26 discount)`:''} · ${window.ZeroDevApp.statusLabel(ticket.quote_status)}. Confirm final scope and terms with the studio before making any payment.`));
      if(window.ZeroDevLocale&&currency!==window.ZeroDevLocale.currency){
        const fxLine=element('span','v11-fx-line','Indicative equivalent in your selected display currency: ');
        const fxValue=element('strong','');fxValue.dataset.fxDisplay='';fxValue.dataset.fxAmount=String(amount);fxValue.dataset.fxBase=currency;fxValue.textContent='Updating…';fxLine.append(fxValue);
        fxLine.append(document.createTextNode(' · your stored quotation remains in '+currency+'.'));quoteBox.append(fxLine);
      }
      quoteBox.hidden=false;window.ZeroDevLocale?.refreshCurrencyDisplays();
    }else{quoteBox.hidden=true;}
    const thread=$('#message-thread');empty(thread,'Loading messages…','');
    const {data,error}=await client.from('ticket_messages').select('id,sender_id,body,is_internal,created_at').eq('ticket_id',ticket.id).order('created_at',{ascending:true});
    if(error)throw error;thread.replaceChildren();
    if(!data?.length)empty(thread,'No messages yet.','Send the first message to begin the project conversation.');
    else data.forEach((item)=>{const own=item.sender_id===user.id;const bubble=element('article',`release-message${own?' mine':''}`);bubble.append(element('small','',own?'You':'ZeroDev Studio'),element('p','',item.body),element('time','',formatDate(item.created_at)));thread.append(bubble);});
    const {data:attachments,error:attachmentError}=await client.from('ticket_attachments').select('file_name,storage_path,content_type,byte_size').eq('ticket_id',ticket.id);
    if(attachmentError)throw attachmentError;
    for(const attachment of (attachments||[])){
      const {data:signed,error:signedError}=await client.storage.from('ticket-attachments').createSignedUrl(attachment.storage_path,300);
      const row=element('div','v11-attachment-row');
      if(signedError||!signed?.signedUrl){row.append(element('span','release-muted',`Attachment unavailable: ${attachment.file_name}`));thread.append(row);continue;}
      const link=element('a','release-text-link',`Open attachment: ${attachment.file_name} (${(Number(attachment.byte_size)/1024/1024).toFixed(2)} MB)`);link.href=signed.signedUrl;link.target='_blank';link.rel='noopener noreferrer';row.append(link);
      if(String(attachment.content_type||'').startsWith('image/')){const image=element('img','v11-attachment-preview');image.src=signed.signedUrl;image.alt=`Preview of ${attachment.file_name}`;image.loading='lazy';row.append(image);}
      thread.append(row);
    }
    const {data:events,error:eventError}=await client.from('ticket_events').select('event_type,description,created_at').eq('ticket_id',ticket.id).order('created_at',{ascending:false}).limit(25);
    if(eventError)throw eventError;renderTimeline(events||[]);
    $('#client-send-message').disabled=ticket.status==='closed';
    if(ticket.status==='closed')$('#thread-subtitle').textContent+=' · This ticket is closed';
  }
  async function loadPreferences(){
    const {data,error}=await client.from('notification_preferences').select('email_enabled,email_on_messages,email_on_project_updates').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    $('#pref-email-enabled').checked=Boolean(data?.email_enabled);
    $('#pref-email-messages').checked=data?.email_on_messages!==false;
    $('#pref-email-updates').checked=data?.email_on_project_updates!==false;
  }
  async function savePreferences(){
    const button=$('#save-notification-preferences');button.disabled=true;
    const status=$('#notification-preferences-status');status.textContent='Saving preferences…';
    try{
      const values={user_id:user.id,email_enabled:$('#pref-email-enabled').checked,email_on_messages:$('#pref-email-messages').checked,email_on_project_updates:$('#pref-email-updates').checked};
      const {error}=await client.from('notification_preferences').upsert(values,{onConflict:'user_id'});
      if(error)throw error;
      status.textContent=values.email_enabled?'Preferences saved. Email delivery starts only after the owner configures the private email worker.':'Preferences saved. Email notifications are disabled.';
    }catch(error){status.textContent=error.message||'Could not save preferences.';}
    finally{button.disabled=false;}
  }
  async function refresh(){await loadTickets();await loadNotifications();notice('Connected. Your private projects, conversations, activity, and notifications are loaded.','success');}

  $$('.release-nav [data-panel]').forEach((button)=>button.addEventListener('click',()=>showPanel(button.dataset.panel)));
  $('#ticket-search')?.addEventListener('input',renderTickets);
  $('#ticket-status-filter')?.addEventListener('change',renderTickets);
  $('#client-message-form').addEventListener('submit',async(event)=>{
    event.preventDefault();if(!selectedTicket){notice('Choose a ticket before sending a message.','warning');return;}
    const textarea=$('#client-message');const body=textarea.value.trim();if(!body)return;
    const button=$('#client-send-message');button.disabled=true;
    try{const {error}=await client.from('ticket_messages').insert({ticket_id:selectedTicket.id,body});if(error)throw error;textarea.value='';await loadMessages(selectedTicket);await refresh();notice('Your message was sent to the project team.','success');}
    catch(error){showError(error);}finally{button.disabled=selectedTicket?.status==='closed';}
  });
  $('#save-notification-preferences')?.addEventListener('click',savePreferences);
  $('#portal-refresh').addEventListener('click',()=>refresh().then(()=>selectedTicket?loadMessages(selectedTicket):undefined).catch(showError));
  $('#portal-sign-out').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)showError(error);else window.location.href='../account/index.html';});
  $('#portal-year').textContent=String(new Date().getFullYear());

  async function init(){
    if(window.ZERO_DEV_BACKEND_CONFIG?.mode!=='live'){
      notice('DEMO MODE — the connected workspace is disabled. No client records are shown as real data.','warning');
      empty($('#overview-tickets'),'Backend setup required.','Your private project requests will appear after the development backend is configured.');
      empty($('#all-tickets'),'Backend setup required.','Your project history will appear here after sign-in.');
      empty($('#message-ticket-list'),'No active connection.','Messages are available after sign-in and backend setup.');
      empty($('#message-thread'),'No conversation selected.','Select a ticket after your workspace loads.');
      empty($('#portal-notifications'),'No active connection.','Notifications are created from ticket and message activity.');
      return;
    }
    try{
      client=await window.ZeroDevApp.getClient();user=await window.ZeroDevApp.getVerifiedUser(client);if(!user)return;
      $('#portal-user-label').textContent=user.email||'Client';$('#portal-avatar').textContent=(user.email||'Z').slice(0,1).toUpperCase();
      $('#portal-welcome').textContent=`Welcome back, ${user.user_metadata?.full_name||user.email?.split('@')[0]||'there'}.`;
      $('#profile-email').textContent=user.email||'—';$('#profile-name').textContent=user.user_metadata?.full_name||'Not provided';$('#profile-verification').textContent='Verified';$('#profile-created').textContent=formatDate(user.created_at);
      await Promise.all([refresh(),loadPreferences()]);
    }catch(error){showError(error);}
  }
  void init();
})();
