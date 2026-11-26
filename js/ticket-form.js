(() => {
  'use strict';
  const form = document.querySelector('#project-request-form');
  if (!form) return;
  const modeNotice = document.querySelector('#ticket-mode-notice');
  const authNotice = document.querySelector('#ticket-auth-notice');
  const result = document.querySelector('#ticket-result');
  const disabled = document.querySelector('#ticket-disabled-state');
  const submitButton = form.querySelector('button[type="submit"]');
  const config = window.ZERO_DEV_BACKEND_CONFIG || { mode: 'demo' };
  let client = null;
  let currentUser = null;

  const say = (element, message, kind = 'info') => {
    element.textContent = message;
    element.dataset.kind = kind;
    element.hidden = !message;
  };

  function setDateMinimum() {
    const dateInput = form.querySelector('input[name="requested_deadline"]');
    if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);
  }

  function showForm() {
    form.hidden = false;
    disabled.hidden = true;
    say(modeNotice, 'Connected to the secure project request service. Your submission will be saved to your account.', 'success');
  }

  async function initialise() {
    document.querySelector('#release-year').textContent = String(new Date().getFullYear());
    setDateMinimum();
    if (config.mode !== 'live') {
      say(modeNotice, 'DEMO MODE — project submissions are disabled. No project details or files are sent or stored.', 'warning');
      say(authNotice, 'To test a real request, a project owner must configure the backend and apply the v1.0 migration in a separate development project.', 'info');
      return;
    }
    try {
      client = await window.ZeroDevApp.getClient();
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      currentUser = data.user;
      if (!currentUser) {
        say(authNotice, 'Sign in with a verified account before submitting a project request.', 'warning');
        disabled.innerHTML = '<span class="release-disabled-icon">◎</span><h3>Sign in to continue</h3><p>Project requests are attached to a verified client account so only you and authorized staff can access them.</p><a class="release-button-secondary" href="../account/index.html?next=%2Fprojects%2Fnew.html">Sign in or create an account</a>';
        return;
      }
      if (!currentUser.email_confirmed_at) {
        say(authNotice, 'Please verify your email address before submitting a project request.', 'warning');
        return;
      }
      showForm();
    } catch (error) {
      say(modeNotice, error.message || 'The project service could not be reached.', 'error');
    }
  }

  function cleanFileName(name) {
    return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'attachment';
  }

  async function uploadAttachments(ticket, files) {
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (files.length > 5) throw new Error('Please attach no more than five files.');
    const uploaded = [];
    for (const file of files) {
      if (!allowed.has(file.type)) throw new Error(`${file.name}: file type is not supported.`);
      if (file.size < 1 || file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: each file must be 8 MB or smaller.`);
      const path = `${ticket.id}/${currentUser.id}/${Date.now()}-${cleanFileName(file.name)}`;
      const { error: uploadError } = await client.storage.from('ticket-attachments').upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type
      });
      if (uploadError) throw new Error(`Ticket created, but ${file.name} could not be uploaded: ${uploadError.message}`);
      const { error: metadataError } = await client.from('ticket_attachments').insert({
        ticket_id: ticket.id,
        file_name: file.name.slice(0, 180),
        storage_path: path,
        content_type: file.type,
        byte_size: file.size
      });
      if (metadataError) {
        await client.storage.from('ticket-attachments').remove([path]);
        throw new Error(`Ticket created, but attachment details could not be saved: ${metadataError.message}`);
      }
      uploaded.push(file.name);
    }
    return uploaded;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client || !currentUser) {
      say(result, 'The secure service is not ready. Your form has not been submitted.', 'warning');
      return;
    }
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    say(result, 'Submitting your request securely…', 'info');
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const min = values.budget_min === '' ? null : Number(values.budget_min);
      const max = values.budget_max === '' ? null : Number(values.budget_max);
      if (min !== null && (!Number.isFinite(min) || min < 0)) throw new Error('Enter a valid minimum budget.');
      if (max !== null && (!Number.isFinite(max) || max < 0)) throw new Error('Enter a valid maximum budget.');
      if (min !== null && max !== null && max < min) throw new Error('Your maximum budget must be at least your minimum budget.');
      const files = Array.from(form.querySelector('#ticket-attachments').files || []);
      if (files.length > 5) throw new Error('Please attach no more than five files.');
      for (const file of files) {
        if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
          throw new Error('Attachments must be PDF, JPG, PNG, or WEBP files no larger than 8 MB each.');
        }
      }

      const { data: ticket, error } = await client.from('tickets').insert({
        title: String(values.title).trim(),
        service: values.service,
        budget_min: min,
        budget_max: max,
        budget_currency: values.budget_currency,
        requested_deadline: values.requested_deadline || null,
        description: String(values.description).trim()
      }).select('id,ticket_number,title,status').single();
      if (error) throw error;

      let discount = 0;
      let discountMessage = '';
      try {
        const { data: applied, error: promoError } = await client.rpc('attach_promo_to_ticket', { p_ticket_id: ticket.id });
        if (promoError) throw promoError;
        discount = Number(applied || 0);
        if (discount > 0) discountMessage = ` Your NEW26 ${discount}% discount has been attached to this project.`;
      } catch (promoError) {
        discountMessage = ' Your project was saved, but the promotion could not be attached automatically; contact support before approving a quotation.';
      }

      let fileMessage = '';
      if (files.length) {
        try {
          const names = await uploadAttachments(ticket, files);
          fileMessage = ` ${names.length} attachment${names.length === 1 ? '' : 's'} uploaded.`;
        } catch (uploadError) {
          fileMessage = ` ${uploadError.message}`;
        }
      }

      form.reset();
      say(result, `Request received! Your reference is ${ticket.ticket_number}. You can follow updates in your client portal.${discountMessage}${fileMessage}`, 'success');
      result.insertAdjacentHTML('beforeend', ' <a class="result-link" href="../portal/index.html">Open client portal →</a>');
      form.hidden = true;
    } catch (error) {
      say(result, error.message || 'Your request could not be submitted. Please try again.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });

  void initialise();
})();
