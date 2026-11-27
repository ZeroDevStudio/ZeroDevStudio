(() => {
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  let client=null,user=null,staff=null,tickets=[],team=[],selectedTicket=null;
  const manageableRoles=new Set(['owner','administrator','project_manager','support']);
  const canManage=()=>manageableRoles.has(staff?.role);

  function notice(message,kind='info'){const target=$('#staff-banner');target.textContent=message;target.dataset.kind=kind;}
  function switchView(name){
    $$('[data-staff-view]').forEach((button)=>{const active=button.dataset.staffView===name;button.classList.toggle('is-active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    $$('[data-staff-panel]').forEach((panel)=>{panel.hidden=panel.dataset.staffPanel!==name;});
    $('#staff-title').textContent=({tickets:'Ticket queue',conversation:'Conversation',notifications:'Notifications',activity:'Activity log',profile:'My staff profile'})[name]||'Staff workspace';
  }
  function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
  function dateLabel(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(date);}
  function formatMoney(value,currency){return window.ZeroDevLocale?.format(Number(value),currency)||`${currency} ${Number(value).toFixed(2)}`;}
  function showError(error){notice(error?.message||'The staff action could not be completed.','error');}
  function visibleTickets(){
    const query=String($('#staff-ticket-search')?.value||'').toLowerCase().trim();
    const status=$('#staff-status-filter')?.value||'all';
    return tickets.filter((ticket)=>{
      const text=`${ticket.ticket_number} ${ticket.title} ${ticket.service} ${ticket.client_id}`.toLowerCase();
      return (status==='all'||ticket.status===status)&&(!query||text.includes(query));
    });
  }
  function createStatusSelect(ticket){
    const select=el('select');select.setAttribute('aria-label',`Status for ${ticket.ticket_number}`);
    ['new','under_review','awaiting_client','in_progress','completed','closed'].forEach((value)=>{const option=el('option','',window.ZeroDevApp.statusLabel(value));option.value=value;option.selected=value===ticket.status;select.append(option);});
    select.disabled=!canManage();return select;
  }
  function createAssigneeSelect(ticket){
    const select=el('select');select.setAttribute('aria-label',`Assignee for ${ticket.ticket_number}`);
    const none=el('option','','Unassigned');none.value='';none.selected=!ticket.assigned_staff_id;select.append(none);
    team.forEach((person)=>{const option=el('option','',`${person.email||person.user_id.slice(0,8)} · ${window.ZeroDevApp.statusLabel(person.role)}`);option.value=person.user_id;option.selected=person.user_id===ticket.assigned_staff_id;select.append(option);});
    select.disabled=!canManage();return select;
  }
  function createCurrencySelect(ticket){
    const select=el('select');select.setAttribute('aria-label',`Quotation currency for ${ticket.ticket_number}`);
    (window.ZeroDevLocale?.currencies||['PHP','USD']).forEach((code)=>{const option=el('option','',code);option.value=code;option.selected=code===(ticket.quoted_currency||'PHP');select.append(option);});
    select.disabled=!canManage();return select;
  }
  async function loadTeam(){
    if(!canManage()){team=[];return;}
    const {data,error}=await client.from('staff_members').select('user_id,role,is_active').eq('is_active',true).order('role');
    if(error)throw error;
    team=(data||[]).map((row)=>({...row,email:row.user_id===user.id?user.email:null}));
  }
  function renderTeamWorkload(){
    const host=$('#staff-workload-list');if(!host)return;
    if(!canManage())return;
    const active=tickets.filter((ticket)=>!['completed','closed'].includes(ticket.status));
    const rows=team.map((person)=>({person,count:active.filter((ticket)=>ticket.assigned_staff_id===person.user_id).length}));
    const unassigned=active.filter((ticket)=>!ticket.assigned_staff_id).length;
    host.replaceChildren();
    if(!rows.length){host.append(el('div','release-empty','No active staff members are enrolled. The owner must add staff after verifying their accounts.'));return;}
    const grid=el('div','v11-workload-grid');
    rows.forEach(({person,count})=>{const card=el('div','v11-workload-card');card.append(el('strong','',person.email||`Staff ${person.user_id.slice(0,8)}`),el('span','',window.ZeroDevApp.statusLabel(person.role)),el('b','',`${count} open ${count===1?'ticket':'tickets'}`));grid.append(card);});
    const card=el('div','v11-workload-card');card.append(el('strong','','Unassigned'),el('span','','Needs allocation'),el('b','',`${unassigned} open ${unassigned===1?'ticket':'tickets'}`));grid.append(card);host.append(grid);
  }
  async function loadTickets(){
    const {data,error}=await client.from('tickets').select('id,ticket_number,client_id,title,service,status,created_at,description,assigned_staff_id,quoted_amount,quoted_currency,quote_status,promo_discount_percent').order('created_at',{ascending:false});
    if(error)throw error;tickets=data||[];
    $('#staff-total').textContent=String(tickets.length);
    $('#staff-new').textContent=String(tickets.filter((t)=>['new','under_review','awaiting_client'].includes(t.status)).length);
    $('#staff-progress').textContent=String(tickets.filter((t)=>t.status==='in_progress').length);
    if($('#staff-assigned'))$('#staff-assigned').textContent=String(tickets.filter((t)=>t.assigned_staff_id===user.id&&!['completed','closed'].includes(t.status)).length);
    renderQueue();
    renderTeamWorkload();
  }
  function renderQueue(){
    const tbody=$('#staff-ticket-rows');tbody.replaceChildren();const list=visibleTickets();
    if(!list.length){const row=el('tr');const cell=el('td');cell.colSpan=6;cell.textContent='No tickets match this filter or are visible to your role.';row.append(cell);tbody.append(row);return;}
    list.forEach((ticket)=>{
      const row=el('tr');
      const request=el('td');request.append(el('strong','',ticket.title),el('small','',`${ticket.ticket_number} · ${ticket.service.replace(/_/g,' ')} · ${dateLabel(ticket.created_at)}`));
      const statusCell=el('td');const status=createStatusSelect(ticket);statusCell.append(status);
      const assigneeCell=el('td');const assignee=createAssigneeSelect(ticket);assigneeCell.append(assignee);
      const quoteCell=el('td');const quoteWrap=el('div');quoteWrap.style.display='grid';quoteWrap.style.gap='5px';
      const quote=el('input');quote.type='number';quote.min='0';quote.step='0.01';quote.placeholder='Base amount';quote.value=ticket.quoted_amount??'';quote.setAttribute('aria-label',`Base quotation amount before any attached promotion for ${ticket.ticket_number}`);quote.title='Enter the base quotation before any attached promotion discount.';quote.disabled=!canManage();
      const currency=createCurrencySelect(ticket);quoteWrap.append(quote,currency);quoteCell.append(quoteWrap);
      const quoteStateCell=el('td');const quoteState=el('select');quoteState.setAttribute('aria-label',`Quote state for ${ticket.ticket_number}`);['not_sent','sent','accepted','declined'].forEach((value)=>{const option=el('option','',window.ZeroDevApp.statusLabel(value));option.value=value;option.selected=value===ticket.quote_status;quoteState.append(option);});quoteState.disabled=!canManage();quoteStateCell.append(quoteState);
      const actionCell=el('td');const actions=el('div');actions.style.display='flex';actions.style.gap='6px';
      const open=el('button','release-action secondary','Open');open.type='button';open.addEventListener('click',()=>{selectedTicket=ticket;switchView('conversation');loadMessages(ticket).catch(showError);});
      const save=el('button','release-action','Save');save.type='button';save.disabled=!canManage();save.title=canManage()?'Save ticket updates':'This role can read and reply, but cannot change ticket details.';
      save.addEventListener('click',async()=>{
        save.disabled=true;
        try{
          const raw=quote.value.trim();const amount=raw===''?null:Number(raw);
          if(amount!==null&&(!Number.isFinite(amount)||amount<0))throw new Error('Enter a valid quotation amount.');
          const update={status:status.value,assigned_staff_id:assignee.value||null,quoted_amount:amount,quoted_currency:currency.value,quote_status:quoteState.value};
          const {error:updateError}=await client.from('tickets').update(update).eq('id',ticket.id);if(updateError)throw updateError;
          notice(`${ticket.ticket_number} updated. Database activity and client notification triggers will process the changes.`,'success');
          await Promise.all([loadTickets(),loadActivity()]);
        }catch(error){showError(error);}finally{save.disabled=!canManage();}
      });
      actions.append(open,save);actionCell.append(actions);row.append(request,statusCell,assigneeCell,quoteCell,quoteStateCell,actionCell);tbody.append(row);
    });
  }
  async function loadMessages(ticket){
    $('#staff-thread-title').textContent=ticket.title;$('#staff-thread-subtitle').textContent=`${ticket.ticket_number} · ${window.ZeroDevApp.statusLabel(ticket.status)}`;
    const host=$('#staff-thread');host.replaceChildren(el('div','release-empty','Loading ticket messages…'));
    const {data,error}=await client.from('ticket_messages').select('id,sender_id,body,is_internal,created_at').eq('ticket_id',ticket.id).order('created_at',{ascending:true});if(error)throw error;
    host.replaceChildren();if(!data?.length)host.append(el('div','release-empty','No ticket messages yet.'));
    (data||[]).forEach((message)=>{const own=message.sender_id===user.id;const bubble=el('article',`release-message${own?' mine':''}${message.is_internal?' internal':''}`);bubble.append(el('small','',`${own?'You':'Client'}${message.is_internal?' · Internal note':''}`),el('p','',message.body),el('time','',dateLabel(message.created_at)));host.append(bubble);});
    const {data:attachments,error:attachmentError}=await client.from('ticket_attachments').select('file_name,storage_path,content_type,byte_size').eq('ticket_id',ticket.id);if(attachmentError)throw attachmentError;
    for(const file of attachments||[]){const {data:signed,error:signedError}=await client.storage.from('ticket-attachments').createSignedUrl(file.storage_path,300);const row=el('div','v11-attachment-row');if(signedError||!signed?.signedUrl){row.append(el('span','release-muted',`Attachment unavailable: ${file.file_name}`));}else{const link=el('a','release-text-link',`Open ${file.file_name}`);link.href=signed.signedUrl;link.target='_blank';link.rel='noopener noreferrer';row.append(link);if(String(file.content_type).startsWith('image/')){const img=el('img','v11-attachment-preview');img.src=signed.signedUrl;img.alt=`Preview of ${file.file_name}`;row.append(img);}}host.append(row);}
    $('#staff-send').disabled=false;
  }
  async function loadNotifications(){
    const host=$('#staff-notifications');const {data,error}=await client.from('notifications').select('id,kind,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(50);if(error)throw error;host.replaceChildren();
    if(!data?.length){host.append(el('div','release-empty','No staff notifications yet.'));return;}
    (data||[]).forEach((item)=>{const row=el('article','release-notification');row.append(el('span','notification-icon',item.kind==='new_message'?'✉':'＋'));const body=el('div');body.append(el('strong','',item.title),el('p','',item.body),el('time','',dateLabel(item.created_at)));row.append(body);if(!item.read_at){const button=el('button','release-action secondary','Mark read');button.type='button';button.addEventListener('click',async()=>{button.disabled=true;try{const {error:updateError}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',item.id);if(updateError)throw updateError;row.remove();}catch(error){showError(error);button.disabled=false;}});row.append(button);}host.append(row);});
  }
  async function loadActivity(){
    const host=$('#staff-activity-log');if(!host)return;
    if(!tickets.length){host.replaceChildren(el('div','release-empty','No ticket activity available.'));return;}
    const {data,error}=await client.from('ticket_events').select('ticket_id,event_type,description,created_at,actor_id').order('created_at',{ascending:false}).limit(60);if(error)throw error;
    const map=new Map(tickets.map((ticket)=>[ticket.id,ticket]));host.replaceChildren();
    const events=(data||[]).filter((item)=>map.has(item.ticket_id));
    if(!events.length){host.append(el('div','release-empty','No activity events are visible to this staff role yet.'));return;}
    const timeline=el('div','v11-timeline');events.forEach((item)=>{const ticket=map.get(item.ticket_id);const line=el('div','v11-timeline-item');line.append(el('span','v11-timeline-dot'));const content=el('div');content.append(el('p','',`${ticket.ticket_number} · ${item.description||window.ZeroDevApp.statusLabel(item.event_type)}`),el('time','',dateLabel(item.created_at)));line.append(content);timeline.append(line);});host.append(timeline);
  }
  $('#staff-message-form').addEventListener('submit',async(event)=>{
    event.preventDefault();if(!selectedTicket){notice('Open a ticket before replying.','warning');return;}
    const body=$('#staff-message').value.trim();if(!body)return;const internal=$('#staff-internal-note').checked;const button=$('#staff-send');button.disabled=true;
    try{const {error}=await client.from('ticket_messages').insert({ticket_id:selectedTicket.id,body,is_internal:internal});if(error)throw error;$('#staff-message').value='';$('#staff-internal-note').checked=false;await loadMessages(selectedTicket);await loadNotifications();notice(internal?'Internal staff note saved. It is not visible to the client.':'Your reply was sent to the client.','success');}
    catch(error){showError(error);}finally{button.disabled=!selectedTicket;}
  });
  $('#staff-refresh').addEventListener('click',()=>Promise.all([loadTickets(),loadNotifications(),loadActivity()]).then(()=>notice('Ticket queue, activity, and notifications refreshed.','success')).catch(showError));
  $('#staff-ticket-search')?.addEventListener('input',renderQueue);
  $('#staff-status-filter')?.addEventListener('change',renderQueue);
  $('#staff-sign-out').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)showError(error);else window.location.href='../account/index.html';});
  $$('[data-staff-view]').forEach((button)=>button.addEventListener('click',()=>switchView(button.dataset.staffView)));

  async function init(){
    if(window.ZERO_DEV_BACKEND_CONFIG?.mode!=='live'){notice('DEMO MODE — staff access is disabled. No ticket or client records are shown until the secure backend is configured.','warning');return;}
    try{
      client=await window.ZeroDevApp.getClient();user=await window.ZeroDevApp.getVerifiedUser(client);if(!user)return;
      const {data:membership,error:membershipError}=await client.from('staff_members').select('role,is_active').eq('user_id',user.id).maybeSingle();if(membershipError)throw membershipError;
      if(!membership||!membership.is_active){notice('Access denied. This authenticated account is not an active ZeroDev Studio staff member.','error');return;}
      staff=membership;$('#staff-user-label').textContent=user.email||'Staff';$('#staff-email').textContent=user.email||'—';$('#staff-role').textContent=window.ZeroDevApp.statusLabel(staff.role);$('#staff-access-status').textContent='Active';
      notice(`Authorized staff session · ${window.ZeroDevApp.statusLabel(staff.role)}. ${canManage()?'Ticket management and assignment are enabled.':'This role can review assigned tickets and reply, but cannot change ticket status or quotations.'}`,'success');
      $('#staff-workload-panel').hidden=!canManage();
      $('#staff-internal-note').disabled=!canManage();
      if(!canManage())$('#staff-internal-note').parentElement.title='Internal notes are restricted to management roles.';
      await loadTeam();await Promise.all([loadTickets(),loadNotifications()]);await loadActivity();
    }catch(error){showError(error);}
  }
  void init();
})();
