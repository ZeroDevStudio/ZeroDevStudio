(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let client = null;
  let user = null;
  let staff = null;
  let tickets = [];
  let selectedTicket = null;
  const manageableRoles = new Set(['owner','administrator','project_manager','support']);
  const canManage = () => manageableRoles.has(staff?.role);

  function notice(message, kind = 'info') {
    const target = $('#staff-banner'); target.textContent = message; target.dataset.kind = kind;
  }
  function switchView(name) {
    $$('[data-staff-view]').forEach((button) => { const active=button.dataset.staffView===name;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current'); });
    $$('[data-staff-panel]').forEach((panel) => { panel.hidden=panel.dataset.staffPanel!==name; });
    $('#staff-title').textContent = ({tickets:'Ticket queue',conversation:'Conversation',notifications:'Notifications',profile:'My staff profile'})[name] || 'Staff workspace';
  }
  function el(tag, cls, text) { const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node; }
  function friendlyDate(value) { const date=new Date(value);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(date); }
  function showError(error) { notice(error?.message || 'The staff action could not be completed.','error'); }

  async function loadTickets() {
    const { data, error } = await client.from('tickets')
      .select('id,ticket_number,client_id,title,service,status,created_at,description,quoted_amount,quoted_currency,quote_status,promo_discount_percent')
      .order('created_at',{ascending:false});
    if(error)throw error;
    tickets=data||[];
    $('#staff-total').textContent=String(tickets.length);
    $('#staff-new').textContent=String(tickets.filter(t=>['new','under_review','awaiting_client'].includes(t.status)).length);
    $('#staff-progress').textContent=String(tickets.filter(t=>t.status==='in_progress').length);
    const tbody=$('#staff-ticket-rows');tbody.replaceChildren();
    if(!tickets.length){const row=el('tr');const cell=el('td');cell.colSpan=5;cell.textContent='No project requests have been submitted yet.';row.append(cell);tbody.append(row);return;}
    tickets.forEach((ticket)=>{
      const row=el('tr');
      const request=el('td');request.append(el('strong','',ticket.title),el('small','',`${ticket.ticket_number} · ${ticket.service.replace(/_/g,' ')} · ${friendlyDate(ticket.created_at)}`));
      const statusCell=el('td');const status=el('select');status.setAttribute('aria-label',`Status for ${ticket.ticket_number}`);
      ['new','under_review','awaiting_client','in_progress','completed','closed'].forEach(value=>{const option=el('option','',window.ZeroDevApp.statusLabel(value));option.value=value;option.selected=ticket.status===value;status.append(option);});status.disabled=!canManage();statusCell.append(status);
      const quoteCell=el('td');const quote=el('input');quote.type='number';quote.min='0';quote.step='0.01';quote.placeholder='Amount';quote.value=ticket.quoted_amount??'';quote.setAttribute('aria-label',`Quotation for ${ticket.ticket_number}`);quote.disabled=!canManage();quoteCell.append(quote);
      const quoteStateCell=el('td');const quoteState=el('select');quoteState.setAttribute('aria-label',`Quote state for ${ticket.ticket_number}`);['not_sent','sent','accepted','declined'].forEach(value=>{const option=el('option','',window.ZeroDevApp.statusLabel(value));option.value=value;option.selected=ticket.quote_status===value;quoteState.append(option);});quoteState.disabled=!canManage();quoteStateCell.append(quoteState);
      const actionCell=el('td');const actions=el('div');actions.style.display='flex';actions.style.gap='6px';
      const open=el('button','release-action secondary','Open');open.type='button';open.addEventListener('click',()=>{selectedTicket=ticket;switchView('conversation');loadMessages(ticket).catch(showError);});
      const save=el('button','release-action','Save');save.type='button';save.disabled=!canManage();save.title=canManage()?'Save ticket updates':'Your staff role can reply but cannot change ticket status or quotations';
      save.addEventListener('click',async()=>{
        save.disabled=true;
        try{
          const raw=quote.value.trim();const amount=raw===''?null:Number(raw);
          if(amount!==null&&(!Number.isFinite(amount)||amount<0))throw new Error('Enter a valid quotation amount.');
          const {error:updateError}=await client.from('tickets').update({status:status.value,quoted_amount:amount,quoted_currency:'PHP',quote_status:quoteState.value}).eq('id',ticket.id);
          if(updateError)throw updateError;
          notice(`${ticket.ticket_number} updated. Ticket activity and client notifications were recorded.`, 'success');
          await loadTickets();
        }catch(error){showError(error);}
        finally{save.disabled=!canManage();}
      });
      actions.append(open,save);actionCell.append(actions);
      row.append(request,statusCell,quoteCell,quoteStateCell,actionCell);tbody.append(row);
    });
  }

  async function loadMessages(ticket) {
    $('#staff-thread-title').textContent=ticket.title;
    $('#staff-thread-subtitle').textContent=`${ticket.ticket_number} · ${ticket.status.replace(/_/g,' ')}`;
    const host=$('#staff-thread');host.replaceChildren(el('div','release-empty','Loading ticket messages…'));
    const {data,error}=await client.from('ticket_messages').select('id,sender_id,body,is_internal,created_at').eq('ticket_id',ticket.id).order('created_at',{ascending:true});
    if(error)throw error;
    host.replaceChildren();
    if(!data?.length)host.append(el('div','release-empty','No messages on this ticket yet.'));
    (data||[]).forEach((message)=>{
      const own=message.sender_id===user.id;const bubble=el('article',`release-message${own?' mine':''}${message.is_internal?' internal':''}`);
      bubble.append(el('small','',`${own?'You':'Client'}${message.is_internal?' · Internal note':''}`),el('p','',message.body),el('time','',friendlyDate(message.created_at)));
      host.append(bubble);
    });
    $('#staff-send').disabled=false;
  }

  async function loadNotifications() {
    const host=$('#staff-notifications');
    const {data,error}=await client.from('notifications').select('id,kind,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(40);
    if(error)throw error;host.replaceChildren();
    if(!data?.length){host.append(el('div','release-empty','No staff notifications yet.'));return;}
    data.forEach((item)=>{
      const row=el('article','release-notification');row.append(el('span','notification-icon',item.kind==='new_message'?'✉':'＋'));
      const body=el('div');body.append(el('strong','',item.title),el('p','',item.body),el('time','',friendlyDate(item.created_at)));row.append(body);
      if(!item.read_at){const button=el('button','release-action secondary','Mark read');button.type='button';button.addEventListener('click',async()=>{button.disabled=true;const {error:updateError}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',item.id);if(updateError){showError(updateError);button.disabled=false;}else row.remove();});row.append(button);}
      host.append(row);
    });
  }

  $('#staff-message-form').addEventListener('submit',async(event)=>{
    event.preventDefault();if(!selectedTicket){notice('Open a ticket before replying.','warning');return;}
    const body=$('#staff-message').value.trim();if(!body)return;
    const internal=$('#staff-internal-note').checked;const button=$('#staff-send');button.disabled=true;
    try{const {error}=await client.from('ticket_messages').insert({ticket_id:selectedTicket.id,body,is_internal:internal});if(error)throw error;$('#staff-message').value='';$('#staff-internal-note').checked=false;await loadMessages(selectedTicket);notice(internal?'Internal staff note saved. It is not visible to the client.':'Your reply was sent to the client.','success');}
    catch(error){showError(error);}finally{button.disabled=!selectedTicket;}
  });
  $('#staff-refresh').addEventListener('click',()=>loadTickets().then(()=>notice('Ticket queue refreshed.','success')).catch(showError));
  $('#staff-sign-out').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)showError(error);else window.location.href='../account/index.html';});
  $$('[data-staff-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.staffView)));

  async function init(){
    if(window.ZERO_DEV_BACKEND_CONFIG?.mode!=='live'){notice('DEMO MODE — staff access is disabled. No ticket or client records are shown until the secure backend is configured.','warning');return;}
    try{
      client=await window.ZeroDevApp.getClient();
      const {data,error}=await client.auth.getUser();if(error)throw error;user=data.user;
      if(!user){window.location.href='../account/index.html';return;}
      const {data:membership,error:membershipError}=await client.from('staff_members').select('role,is_active').eq('user_id',user.id).maybeSingle();
      if(membershipError)throw membershipError;
      if(!membership||!membership.is_active){notice('Access denied. This authenticated account is not an active ZeroDev Studio staff member.','error');return;}
      staff=membership;$('#staff-user-label').textContent=user.email||'Staff';$('#staff-email').textContent=user.email||'—';$('#staff-role').textContent=window.ZeroDevApp.statusLabel(staff.role);$('#staff-access-status').textContent='Active';
      notice(`Authorized staff session · ${window.ZeroDevApp.statusLabel(staff.role)}. ${canManage()?'Ticket management is enabled for this role.':'This role can review tickets and reply, but cannot edit ticket status or quotations.'}`,'success');
      await Promise.all([loadTickets(),loadNotifications()]);
    }catch(error){showError(error);}
  }
  void init();
})();
