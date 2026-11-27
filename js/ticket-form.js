
(() => {
  'use strict';

  // ============================================================
  // ZERO DEV STUDIO
  // Project Intake — Client Workspace
  // Supabase Auth + Database + Private Storage
  // ============================================================

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const form = $('#project-request-form');

  if (!form) return;

  const modeNotice = $('#ticket-mode-notice');
  const authNotice = $('#ticket-auth-notice');
  const result = $('#ticket-result');
  const disabled = $('#ticket-disabled-state');

  const submitButton = form.querySelector(
    'button[type="submit"]'
  );

  const config = window.ZERO_DEV_BACKEND_CONFIG || {
    mode: 'demo'
  };

  const allowedTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);

  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const MAX_FILES = 5;
  const MIN_DESCRIPTION_LENGTH = 20;
  const MAX_DESCRIPTION_LENGTH = 5000;

  let client = null;
  let currentUser = null;
  let currentDraftId = null;

  let createdTicketForRetry = null;
  let pendingRetryFiles = [];

  let submissionInProgress = false;

  // ============================================================
  // UI HELPERS
  // ============================================================

  function say(element, message, kind = 'info') {
    if (!element) return;

    element.textContent = message;
    element.dataset.kind = kind;
    element.hidden = !message;
  }

  function setButtonBusy(button, busy) {
    if (!button) return;

    button.disabled = busy;

    if (busy) {
      button.setAttribute('aria-busy', 'true');
    } else {
      button.removeAttribute('aria-busy');
    }
  }

  function setFormBusy(busy) {
    if (submitButton) {
      setButtonBusy(submitButton, busy);
    }
  }

  function setDateMinimum() {
    const date = form.querySelector(
      '[name="requested_deadline"]'
    );

    if (!date) return;

    const today = new Date();
    const localDate = new Date(
      today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);

    date.min = localDate;
  }

  function showForm() {
    form.hidden = false;

    if (disabled) {
      disabled.hidden = true;
    }

    say(
      modeNotice,
      'Connected to the secure project request service. Your submission will be saved to your account.',
      'success'
    );
  }

  function showDisabled(message) {
    form.hidden = true;

    if (disabled) {
      disabled.hidden = false;
    }

    say(authNotice, message, 'warning');
  }

  function addPortalLink() {
    if (!result) return;

    const link = document.createElement('a');

    link.className = 'result-link';
    link.href = '../portal/index.html';
    link.textContent = 'Open client portal →';

    result.append(link);
  }

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  async function getAuthenticatedVerifiedUser() {
    if (!client) {
      throw new Error(
        'The authentication service is not initialized.'
      );
    }

    const {
      data,
      error
    } = await client.auth.getUser();

    if (error) throw error;

    const user = data?.user;

    if (!user?.id) {
      throw new Error(
        'Your session is missing. Please sign in again.'
      );
    }

    if (!user.email_confirmed_at) {
      throw new Error(
        'Your email is not verified. Complete email verification before continuing.'
      );
    }

    return user;
  }

  async function refreshAuthenticatedUser() {
    const user = await getAuthenticatedVerifiedUser();

    currentUser = user;

    return user;
  }

  // ============================================================
  // FILE HELPERS
  // ============================================================

  function cleanFileName(name) {
    return String(name)
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(-100) || 'attachment';
  }

  function validateFile(file) {
    if (!allowedTypes.has(file.type)) {
      throw new Error(
        `${file.name}: unsupported file type. Use PDF, JPG, PNG, or WEBP.`
      );
    }

    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      throw new Error(
        `${file.name}: file must be larger than 0 bytes and no more than 8 MB.`
      );
    }
  }

  function getSelectedFiles() {
    return Array.from(
      $('#ticket-attachments')?.files || []
    );
  }

  function previewFiles() {
    const host = $('#ticket-upload-list');

    if (!host) return;

    const files = getSelectedFiles();

    host.replaceChildren();

    files.forEach((file) => {
      const line = document.createElement('div');
      line.className = 'v11-upload-item';

      const name = document.createElement('span');
      name.textContent = file.name;

      const size = document.createElement('span');

      size.textContent =
        `${(file.size / 1024 / 1024).toFixed(2)} MB`;

      line.append(name, size);
      host.append(line);
    });
  }

  // ============================================================
  // FORM DATA
  // ============================================================

  function draftPayload() {
    const values = Object.fromEntries(
      new FormData(form).entries()
    );

    const numberOrNull = (value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }

      return Number(value);
    };

    return {
      title: String(values.title || '').trim(),

      service: values.service || null,

      budget_min: numberOrNull(values.budget_min),

      budget_max: numberOrNull(values.budget_max),

      budget_currency: values.budget_currency || 'PHP',

      requested_deadline:
        values.requested_deadline || null,

      description:
        String(values.description || '').trim()
    };
  }

  function validatePayload(values) {
    if (
      values.title.length < 4 ||
      values.title.length > 120
    ) {
      throw new Error(
        'Project title must be between 4 and 120 characters.'
      );
    }

    if (
      values.description.length < MIN_DESCRIPTION_LENGTH ||
      values.description.length > MAX_DESCRIPTION_LENGTH
    ) {
      throw new Error(
        'Project description must be between 20 and 5,000 characters.'
      );
    }

    if (
      values.budget_min !== null &&
      (
        !Number.isFinite(values.budget_min) ||
        values.budget_min < 0
      )
    ) {
      throw new Error(
        'Enter a valid minimum budget.'
      );
    }

    if (
      values.budget_max !== null &&
      (
        !Number.isFinite(values.budget_max) ||
        values.budget_max < 0
      )
    ) {
      throw new Error(
        'Enter a valid maximum budget.'
      );
    }

    if (
      values.budget_min !== null &&
      values.budget_max !== null &&
      values.budget_max < values.budget_min
    ) {
      throw new Error(
        'Your maximum budget must be at least your minimum budget.'
      );
    }

    const deadline = values.requested_deadline;

    if (deadline) {
      const selected = new Date(`${deadline}T00:00:00`);
      const minimum = new Date();

      minimum.setHours(0, 0, 0, 0);

      if (
        Number.isNaN(selected.getTime()) ||
        selected < minimum
      ) {
        throw new Error(
          'Choose a valid deadline that is not in the past.'
        );
      }
    }
  }

  function validateAttachments(files) {
    if (files.length > MAX_FILES) {
      throw new Error(
        'Please attach no more than five files.'
      );
    }

    files.forEach(validateFile);
  }

  // ============================================================
  // DRAFT MANAGEMENT
  // ============================================================

  function applyDraft(draft) {
    for (const [key, value] of Object.entries(draft)) {
      const control = form.elements.namedItem(key);

      if (
        control &&
        value !== null &&
        value !== undefined
      ) {
        control.value = String(value);
      }
    }

    currentDraftId = draft.id || null;

    const attachmentInput = $('#ticket-attachments');

    if (attachmentInput) {
      attachmentInput.value = '';
    }

    previewFiles();

    window.ZeroDevLocale?.updateBudgetPreview();

    say(
      $('#ticket-upload-status'),
      'Draft loaded. Attachments are not included in saved drafts; add them again before submitting.',
      'success'
    );
  }

  async function loadDraftList() {
    if (!client || !currentUser) return;

    const select = $('#saved-ticket-drafts');

    if (!select) return;

    const {
      data,
      error
    } = await client
      .from('ticket_drafts')
      .select('id,title,service,updated_at')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    select.replaceChildren();

    const first = document.createElement('option');

    first.value = '';

    first.textContent = data?.length
      ? 'Choose a saved draft'
      : 'No saved drafts';

    select.append(first);

    (data || []).forEach((draft) => {
      const option = document.createElement('option');

      option.value = draft.id;

      const title = draft.title || 'Untitled draft';

      const date = new Date(draft.updated_at);

      const savedDate = Number.isNaN(date.getTime())
        ? 'Saved'
        : date.toLocaleString();

      option.textContent = `${title} · ${savedDate}`;

      select.append(option);
    });

    if (currentDraftId) {
      select.value = currentDraftId;
    }
  }

  async function saveDraft() {
    if (!client || !currentUser) {
      throw new Error(
        'Sign in with a verified account before saving drafts.'
      );
    }

    const user = await refreshAuthenticatedUser();

    const payload = draftPayload();

    validatePayload(payload);

    let query;

    if (currentDraftId) {
      query = client
        .from('ticket_drafts')
        .update(payload)
        .eq('id', currentDraftId);
    } else {
      query = client
        .from('ticket_drafts')
        .insert(payload);
    }

    const {
      data,
      error
    } = await query
      .select('id')
      .single();

    if (error) throw error;

    currentUser = user;
    currentDraftId = data.id;

    await loadDraftList();

    say(
      $('#ticket-upload-status'),
      'Draft saved securely to your account. Attachments are not stored with drafts.',
      'success'
    );
  }

  async function loadSelectedDraft() {
    if (!client || !currentUser) {
      throw new Error(
        'Sign in before loading a saved draft.'
      );
    }

    const user = await refreshAuthenticatedUser();

    const id = $('#saved-ticket-drafts')?.value;

    if (!id) return;

    const {
      data,
      error
    } = await client
      .from('ticket_drafts')
      .select(
        'id,title,service,budget_min,budget_max,budget_currency,requested_deadline,description'
      )
      .eq('id', id)
      .single();

    if (error) throw error;

    currentUser = user;

    applyDraft(data);
  }

  async function deleteSelectedDraft() {
    if (!client || !currentUser) {
      throw new Error(
        'Sign in before deleting a saved draft.'
      );
    }

    const user = await refreshAuthenticatedUser();

    const id =
      $('#saved-ticket-drafts')?.value ||
      currentDraftId;

    if (!id) return;

    if (!window.confirm('Delete this saved draft?')) {
      return;
    }

    const {
      error
    } = await client
      .from('ticket_drafts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    currentUser = user;

    if (currentDraftId === id) {
      currentDraftId = null;
    }

    await loadDraftList();

    say(
      $('#ticket-upload-status'),
      'Draft deleted.',
      'success'
    );
  }

  // ============================================================
  // STORAGE UPLOADS
  // ============================================================

  async function uploadOne(ticket, file, index, total) {
    validateFile(file);

    // Refresh identity before each upload. Storage policies
    // require the uploader ID to match auth.uid().

    const uploader = await refreshAuthenticatedUser();

    const bucket = client.storage.from(
      'ticket-attachments'
    );

    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const path = [
        ticket.id,
        uploader.id,
        `${Date.now()}-${index}-${cleanFileName(file.name)}`
      ].join('/');

      say(
        $('#ticket-upload-status'),
        `Uploading attachment ${index} of ${total}: ${file.name} · attempt ${attempt}/2`,
        'info'
      );

      const {
        error: uploadError
      } = await bucket.upload(
        path,
        file,
        {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        }
      );

      if (uploadError) {
        lastError = uploadError;
        continue;
      }

      const {
        error: metadataError
      } = await client
        .from('ticket_attachments')
        .insert({
          ticket_id: ticket.id,
          file_name: file.name.slice(0, 180),
          storage_path: path,
          content_type: file.type,
          byte_size: file.size
        });

      if (!metadataError) {
        return;
      }

      // Remove the uploaded object if its metadata record
      // could not be saved.

      await bucket.remove([path]);

      lastError = metadataError;
    }

    throw new Error(
      `${file.name}: upload did not finish after two attempts. ${lastError?.message || ''}`.trim()
    );
  }

  async function retryAttachments() {
    if (
      !createdTicketForRetry ||
      !pendingRetryFiles.length
    ) {
      return;
    }

    const retryButton = $('[data-retry-attachments]');

    if (retryButton) {
      retryButton.disabled = true;
    }

    const files = [...pendingRetryFiles];
    const failed = [];

    for (let i = 0; i < files.length; i++) {
      try {
        await uploadOne(
          createdTicketForRetry,
          files[i],
          i + 1,
          files.length
        );
      } catch (error) {
        failed.push(files[i]);

        say(
          $('#ticket-upload-status'),
          error.message || 'An attachment could not be uploaded.',
          'error'
        );
      }
    }

    pendingRetryFiles = failed;

    if (failed.length) {
      say(
        $('#ticket-upload-status'),
        `Your project ${createdTicketForRetry.ticket_number} is saved. ${failed.length} attachment(s) still need retry.`,
        'warning'
      );

      if (retryButton) {
        retryButton.disabled = false;
      }

      return;
    }

    if (retryButton) {
      retryButton.remove();
    }

    say(
      $('#ticket-upload-status'),
      `Your project ${createdTicketForRetry.ticket_number} is saved and all attachments are uploaded. Open your client workspace to follow progress.`,
      'success'
    );
  }

  // ============================================================
  // PROMOTION
  // ============================================================

  async function attachPromotion(ticket) {
    try {
      const {
        data,
        error
      } = await client.rpc(
        'attach_promo_to_ticket',
        {
          p_ticket_id: ticket.id
        }
      );

      if (error) throw error;

      const discount = Number(data);

      if (
        Number.isFinite(discount) &&
        discount > 0
      ) {
        return ` Your NEW26 ${discount}% discount was attached.`;
      }

      return '';

    } catch (_) {
      return ' If you previously redeemed NEW26, contact support if it is not reflected in your quotation.';
    }
  }

  // ============================================================
  // CREATE TICKET
  // ============================================================

  async function createTicket(values) {
    // Always retrieve the authenticated Supabase user
    // immediately before creating a ticket.

    const user = await refreshAuthenticatedUser();

    if (!user.id || !user.email_confirmed_at) {
      throw new Error(
        'A verified account is required to submit a project request.'
      );
    }

    // CRITICAL RLS FIX:
    // tickets_insert_verified_client requires:
    //
    // client_id = auth.uid()
    // AND is_verified_account()
    //
    // Never take client_id from a form field or user input.

    const ticketPayload = {
      ...values,
      client_id: user.id
    };

    const {
      data: ticket,
      error
    } = await client
      .from('tickets')
      .insert(ticketPayload)
      .select('id,ticket_number,title,status')
      .single();

    if (error) throw error;

    if (!ticket?.id) {
      throw new Error(
        'The database did not return the created project request.'
      );
    }

    return ticket;
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function initialise() {
    const releaseYear = $('#release-year');

    if (releaseYear) {
      releaseYear.textContent =
        String(new Date().getFullYear());
    }

    setDateMinimum();

    $('#ticket-attachments')?.addEventListener(
      'change',
      previewFiles
    );

    $('#save-ticket-draft')?.addEventListener(
      'click',
      async () => {
        const button = $('#save-ticket-draft');

        setButtonBusy(button, true);

        try {
          await saveDraft();
        } catch (error) {
          say(
            $('#ticket-upload-status'),
            error.message || 'Draft could not be saved.',
            'error'
          );
        } finally {
          setButtonBusy(button, false);
        }
      }
    );

    $('#load-ticket-draft')?.addEventListener(
      'click',
      async () => {
        try {
          await loadSelectedDraft();
        } catch (error) {
          say(
            $('#ticket-upload-status'),
            error.message || 'Draft could not be loaded.',
            'error'
          );
        }
      }
    );

    $('#delete-ticket-draft')?.addEventListener(
      'click',
      async () => {
        const button = $('#delete-ticket-draft');

        setButtonBusy(button, true);

        try {
          await deleteSelectedDraft();
        } catch (error) {
          say(
            $('#ticket-upload-status'),
            error.message || 'Draft could not be deleted.',
            'error'
          );
        } finally {
          setButtonBusy(button, false);
        }
      }
    );

    // ----------------------------------------------------------
    // DEMO MODE
    // ----------------------------------------------------------

    if (config.mode !== 'live') {
      say(
        modeNotice,
        'DEMO MODE — project submissions and saved drafts are disabled. No project details or files are sent or stored.',
        'warning'
      );

      say(
        authNotice,
        'Live project requests require an approved backend configuration and database migrations.',
        'info'
      );

      return;
    }

    // ----------------------------------------------------------
    // LIVE MODE
    // ----------------------------------------------------------

    try {
      if (!window.ZeroDevApp?.getClient) {
        throw new Error(
          'The ZeroDev application client is unavailable. Check the shared application scripts.'
        );
      }

      client = await window.ZeroDevApp.getClient();

      if (!client) {
        throw new Error(
          'The Supabase client could not be initialized.'
        );
      }

      currentUser = await window.ZeroDevApp.getVerifiedUser(
        client
      );

      if (!currentUser) {
        showDisabled(
          'Sign in with a verified account before creating project requests or saving drafts.'
        );

        return;
      }

      // Confirm that the user returned by the application
      // helper is also the user authenticated by Supabase.

      currentUser = await refreshAuthenticatedUser();

      showForm();

      await loadDraftList();

    } catch (error) {
      say(
        modeNotice,
        error.message || 'The project service could not be reached.',
        'error'
      );

      showDisabled(
        'The secure project service is not ready. Please sign in again or contact support.'
      );
    }
  }

  // ============================================================
  // SUBMISSION HANDLER
  // ============================================================

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (submissionInProgress) return;

    if (!client || !currentUser) {
      say(
        result,
        'The secure service is not ready. Your form has not been submitted.',
        'warning'
      );

      return;
    }

    if (!form.reportValidity()) return;

    submissionInProgress = true;

    setFormBusy(true);

    say(
      result,
      'Submitting your request securely…',
      'info'
    );

    try {
      // --------------------------------------------------------
      // 1. Validate project details
      // --------------------------------------------------------

      const values = draftPayload();

      validatePayload(values);

      // --------------------------------------------------------
      // 2. Validate attachments
      // --------------------------------------------------------

      const files = getSelectedFiles();

      validateAttachments(files);

      // --------------------------------------------------------
      // 3. Confirm the authenticated user
      // --------------------------------------------------------

      const user = await refreshAuthenticatedUser();

      if (!user?.id) {
        throw new Error(
          'Your sign-in session is unavailable. Please sign in again.'
        );
      }

      // --------------------------------------------------------
      // 4. Insert ticket with authenticated client_id
      // --------------------------------------------------------

      const ticket = await createTicket(values);

      // --------------------------------------------------------
      // 5. Attach NEW26 promotion when eligible
      // --------------------------------------------------------

      const promoMessage = await attachPromotion(ticket);

      // --------------------------------------------------------
      // 6. Remove successfully submitted draft
      // --------------------------------------------------------

      if (currentDraftId) {
        const {
          error: draftDeleteError
        } = await client
          .from('ticket_drafts')
          .delete()
          .eq('id', currentDraftId);

        if (draftDeleteError) {
          console.warn(
            'Ticket saved, but the draft could not be removed:',
            draftDeleteError.message
          );
        }

        currentDraftId = null;

        try {
          await loadDraftList();
        } catch (error) {
          console.warn(
            'Could not refresh draft list:',
            error.message
          );
        }
      }

      // --------------------------------------------------------
      // 7. Remember ticket and pending attachments
      // --------------------------------------------------------

      createdTicketForRetry = ticket;

      pendingRetryFiles = [...files];

      // --------------------------------------------------------
      // 8. Show successful ticket creation
      // --------------------------------------------------------

      form.reset();

      previewFiles();

      form.hidden = true;

      say(
        result,
        `Request received. Your reference is ${ticket.ticket_number}.${promoMessage} You can follow it in your client workspace.`,
        'success'
      );

      addPortalLink();

      // --------------------------------------------------------
      // 9. Upload optional attachments
      // --------------------------------------------------------

      if (pendingRetryFiles.length) {
        const retryButton = document.createElement('button');

        retryButton.type = 'button';

        retryButton.className =
          'release-action secondary';

        retryButton.dataset.retryAttachments = 'true';

        retryButton.textContent =
          'Retry attachment uploads';

        retryButton.addEventListener(
          'click',
          () => void retryAttachments()
        );

        result?.append(retryButton);

        await retryAttachments();
      }

    } catch (error) {
      say(
        result,
        error.message ||
          'Your request could not be submitted. Please try again.',
        'error'
      );

    } finally {
      submissionInProgress = false;

      setFormBusy(false);
    }
  });

  // ============================================================
  // START
  // ============================================================

  void initialise();

})();
