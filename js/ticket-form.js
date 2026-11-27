(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const form = $('#project-request-form');
  if (!form) return;
  const modeNotice = $('#ticket-mode-notice');
  const authNotice = $('#ticket-auth-notice');
  const result = $('#ticket-result');
  const disabled = $('#ticket-disabled-state');
  const submitButton = form.querySelector('button[type="submit"]');
  const config = window.ZERO_DEV_BACKEND_CONFIG || {mode:'demo'};
  const allowedTypes = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
  let client = null;
  let currentUser = null;
  let currentDraftId = null;
  let createdTicketForRetry = null;
  let pendingRetryFiles = [];

  function say(element, message, kind = 'info') {
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
    element.hidden = !message;
  }
  function setDateMinimum() {
    const date = form.querySelector('[name="requested_deadline"]');
    if (date) date.min = new Date().toISOString().slice(0,10);
  }
  function showForm() {
    form.hidden = false;
    disabled.hidden = true;
    say(modeNotice,'Connected to the secure project request service. Your submission will be saved to your account.','success');
  }
  function cleanFileName(name) {
    return String(name).normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100) || 'attachment';
  }
  function previewFiles() {
    const host = $('#ticket-upload-list');
    const files = Array.from($('#ticket-attachments')?.files || []);
    if (!host) return;
    host.replaceChildren();
    files.forEach((file) => {
      const line = document.createElement('div'); line.className = 'v11-upload-item';
      const name = document.createElement('span'); name.textContent = file.name;
      const size = document.createElement('span'); size.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
      line.append(name,size); host.append(line);
    });
  }
  function draftPayload() {
    const values = Object.fromEntries(new FormData(form).entries());
    const numberOrNull = (value) => value === '' ? null : Number(value);
    return {
      title:String(values.title || '').trim(),
      service:values.service || null,
      budget_min:numberOrNull(values.budget_min),
      budget_max:numberOrNull(values.budget_max),
      budget_currency:values.budget_currency || 'PHP',
      requested_deadline:values.requested_deadline || null,
      description:String(values.description || '').trim()
    };
  }
  function applyDraft(draft) {
    for (const [key,value] of Object.entries(draft)) {
      const control = form.elements.namedItem(key);
      if (control && value !== null && value !== undefined) control.value = String(value);
    }
    currentDraftId = draft.id || null;
    if ($('#ticket-attachments')) $('#ticket-attachments').value = '';
    previewFiles();
    window.ZeroDevLocale?.updateBudgetPreview();
    say($('#ticket-upload-status'), 'Draft loaded. Attachments are not included in saved drafts; add them again before submitting.','success');
  }
  async function loadDraftList() {
    if (!client) return;
    const select = $('#saved-ticket-drafts');
    if (!select) return;
    const {data,error} = await client.from('ticket_drafts')
      .select('id,title,service,updated_at')
      .order('updated_at',{ascending:false}).limit(10);
    if (error) throw error;
    select.replaceChildren();
    const first = document.createElement('option'); first.value=''; first.textContent=data?.length ? 'Choose a saved draft' : 'No saved drafts'; select.append(first);
    (data || []).forEach((draft) => {
      const option=document.createElement('option'); option.value=draft.id;
      const title=draft.title || 'Untitled draft';
      const date=new Date(draft.updated_at);
      option.textContent=`${title} · ${Number.isNaN(date.getTime())?'Saved':date.toLocaleString()}`;
      select.append(option);
    });
    if (currentDraftId) select.value=currentDraftId;
  }
  async function saveDraft() {
    if (!client || !currentUser) throw new Error('Sign in with a verified account before saving drafts.');
    const payload=draftPayload();
    if (payload.budget_min !== null && (!Number.isFinite(payload.budget_min) || payload.budget_min < 0)) throw new Error('Enter a valid minimum budget.');
    if (payload.budget_max !== null && (!Number.isFinite(payload.budget_max) || payload.budget_max < 0)) throw new Error('Enter a valid maximum budget.');
    if (payload.budget_min !== null && payload.budget_max !== null && payload.budget_max < payload.budget_min) throw new Error('Your maximum budget must be at least your minimum budget.');
    let query;
    if (currentDraftId) query=client.from('ticket_drafts').update(payload).eq('id',currentDraftId);
    else query=client.from('ticket_drafts').insert(payload);
    const {data,error}=await query.select('id').single();
    if (error) throw error;
    currentDraftId=data.id;
    await loadDraftList();
    say($('#ticket-upload-status'),'Draft saved securely to your account. Attachments are not stored with drafts.','success');
  }
  async function uploadOne(ticket,file,index,total) {
    if (!allowedTypes.has(file.type)) throw new Error(`${file.name}: unsupported file type.`);
    if (file.size < 1 || file.size > 8*1024*1024) throw new Error(`${file.name}: file must be 8 MB or smaller.`);
    let lastError=null;
    for (let attempt=1; attempt<=2; attempt++) {
      const path=`${ticket.id}/${currentUser.id}/${Date.now()}-${index}-${cleanFileName(file.name)}`;
      say($('#ticket-upload-status'),`Uploading attachment ${index} of ${total}: ${file.name} · attempt ${attempt}/2`,'info');
      const {error:uploadError}=await client.storage.from('ticket-attachments').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if (uploadError) { lastError=uploadError; continue; }
      const {error:metadataError}=await client.from('ticket_attachments').insert({ticket_id:ticket.id,file_name:file.name.slice(0,180),storage_path:path,content_type:file.type,byte_size:file.size});
      if (!metadataError) return;
      await client.storage.from('ticket-attachments').remove([path]);
      lastError=metadataError;
    }
    throw new Error(`${file.name}: upload did not finish after two attempts. ${lastError?.message || ''}`.trim());
  }
  async function retryAttachments() {
    if (!createdTicketForRetry || !pendingRetryFiles.length) return;
    const retryButton=$('[data-retry-attachments]');
    if (retryButton) retryButton.disabled=true;
    const failed=[];
    const files=[...pendingRetryFiles];
    for (let i=0;i<files.length;i++) {
      try { await uploadOne(createdTicketForRetry,files[i],i+1,files.length); }
      catch (error) { failed.push(files[i]); say($('#ticket-upload-status'),error.message,'error'); }
    }
    pendingRetryFiles=failed;
    if (failed.length) {
      say($('#ticket-upload-status'),`Your project ${createdTicketForRetry.ticket_number} is saved. ${failed.length} attachment(s) still need retry. Keep this page open until the upload finishes.`,'warning');
      if (retryButton) retryButton.disabled=false;
    } else {
      say($('#ticket-upload-status'),'All attachments uploaded successfully.','success');
      if (retryButton) retryButton.remove();
      say($('#ticket-upload-status'),`Your project ${createdTicketForRetry.ticket_number} is saved and all attachments are uploaded. Open your client workspace to follow progress.`,'success');
    }
  }
  function addPortalLink() {
    const link=document.createElement('a'); link.className='result-link'; link.href='../portal/index.html'; link.textContent=' Open client portal →';
    result.append(link);
  }
  async function initialise() {
    $('#release-year').textContent=String(new Date().getFullYear());
    setDateMinimum();
    $('#ticket-attachments')?.addEventListener('change',previewFiles);
    $('#save-ticket-draft')?.addEventListener('click',async()=>{
      const button=$('#save-ticket-draft'); button.disabled=true;
      try { await saveDraft(); } catch(error) { say($('#ticket-upload-status'),error.message || 'Draft could not be saved.','error'); }
      finally { button.disabled=false; }
    });
    $('#load-ticket-draft')?.addEventListener('click',async()=>{
      const id=$('#saved-ticket-drafts')?.value; if(!id) return;
      try {
        const {data,error}=await client.from('ticket_drafts').select('id,title,service,budget_min,budget_max,budget_currency,requested_deadline,description').eq('id',id).single();
        if(error) throw error; applyDraft(data);
      } catch(error) { say($('#ticket-upload-status'),error.message || 'Draft could not be loaded.','error'); }
    });
    $('#delete-ticket-draft')?.addEventListener('click',async()=>{
      const id=$('#saved-ticket-drafts')?.value || currentDraftId; if(!id) return;
      if(!window.confirm('Delete this saved draft?')) return;
      try {
        const {error}=await client.from('ticket_drafts').delete().eq('id',id); if(error) throw error;
        if(currentDraftId===id) currentDraftId=null;
        await loadDraftList(); say($('#ticket-upload-status'),'Draft deleted.','success');
      } catch(error) { say($('#ticket-upload-status'),error.message || 'Draft could not be deleted.','error'); }
    });
    if (config.mode !== 'live') {
      say(modeNotice,'DEMO MODE — project submissions and saved drafts are disabled. No project details or files are sent or stored.','warning');
      say(authNotice,'To test real requests, the project owner must configure the backend and apply the v1.1 migration in a separate development project.','info');
      return;
    }
    try {
      client=await window.ZeroDevApp.getClient();
      currentUser=await window.ZeroDevApp.getVerifiedUser(client);
      if(!currentUser) { say(authNotice,'Sign in with a verified account before creating project requests or saving drafts.','warning'); return; }
      showForm();
      await loadDraftList();
    } catch(error) { say(modeNotice,error.message || 'The project service could not be reached.','error'); }
  }

  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(!client || !currentUser) { say(result,'The secure service is not ready. Your form has not been submitted.','warning'); return; }
    if(!form.reportValidity()) return;
    submitButton.disabled=true;
    say(result,'Submitting your request securely…','info');
    try {
      const values=draftPayload();
      if(values.title.length<4 || values.title.length>120) throw new Error('Project title must be between 4 and 120 characters.');
      if(values.description.length<20 || values.description.length>5000) throw new Error('Project description must be between 20 and 5,000 characters.');
      if(values.budget_min!==null && (!Number.isFinite(values.budget_min)||values.budget_min<0)) throw new Error('Enter a valid minimum budget.');
      if(values.budget_max!==null && (!Number.isFinite(values.budget_max)||values.budget_max<0)) throw new Error('Enter a valid maximum budget.');
      if(values.budget_min!==null&&values.budget_max!==null&&values.budget_max<values.budget_min) throw new Error('Your maximum budget must be at least your minimum budget.');
      const files=Array.from($('#ticket-attachments').files || []);
      if(files.length>5) throw new Error('Please attach no more than five files.');
      for(const file of files) if(!allowedTypes.has(file.type)||file.size<1||file.size>8*1024*1024) throw new Error('Attachments must be PDF, JPG, PNG, or WEBP files no larger than 8 MB each.');
      const {data:ticket,error}=await client.from('tickets').insert(values).select('id,ticket_number,title,status').single();
      if(error) throw error;
      let promoMessage='';
      try {
        const {data:discount,error:promoError}=await client.rpc('attach_promo_to_ticket',{p_ticket_id:ticket.id});
        if(promoError) throw promoError;
        if(Number(discount)>0) promoMessage=` Your NEW26 ${Number(discount)}% discount was attached.`;
      } catch(_) { promoMessage=' If you previously redeemed NEW26, contact support if it is not reflected in your quotation.'; }
      if(currentDraftId) { await client.from('ticket_drafts').delete().eq('id',currentDraftId); currentDraftId=null; }
      createdTicketForRetry=ticket;
      pendingRetryFiles=[...files];
      form.reset();
      form.hidden=true;
      say(result,`Request received. Your reference is ${ticket.ticket_number}.${promoMessage} You can follow it in your client workspace.`,'success');
      addPortalLink();
      if(pendingRetryFiles.length) {
        const retry=document.createElement('button'); retry.type='button'; retry.className='release-action secondary'; retry.dataset.retryAttachments='true'; retry.textContent='Retry attachment uploads';
        retry.addEventListener('click',retryAttachments); result.append(retry);
        await retryAttachments();
      }
    } catch(error) {
      say(result,error.message || 'Your request could not be submitted. Please try again.','error');
    } finally { submitButton.disabled=false; }
  });
  void initialise();
})();
