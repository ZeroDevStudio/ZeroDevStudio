// ZeroDev Studio v1.1 private email outbox worker.
// Deploy with JWT verification disabled only because this worker authenticates
// using NOTIFICATION_WORKER_SECRET. Keep every value below in Edge Function
// secrets. Never copy service-role or Resend keys into browser files.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const htmlEscapes: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
};
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const workerSecret = Deno.env.get('NOTIFICATION_WORKER_SECRET') || '';
  const suppliedSecret = request.headers.get('x-worker-secret') || '';
  const constantTimeEqual = (left: string, right: string) => {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  };
  if (workerSecret.length < 32 || suppliedSecret.length < 32 || !constantTimeEqual(suppliedSecret, workerSecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';
  const from = Deno.env.get('EMAIL_FROM') || '';
  if (!supabaseUrl || !serviceKey || !resendKey || !from) {
    return json({ error: 'Worker configuration is incomplete' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: jobs, error: claimError } = await supabase.rpc('claim_v11_email_jobs', { p_limit: 25 });
  if (claimError) return json({ error: 'Could not claim email queue jobs' }, 500);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of jobs || []) {
    try {
      const [{ data: userResult, error: userError }, { data: notification, error: notificationError }, { data: preferences, error: preferenceError }] = await Promise.all([
        supabase.auth.admin.getUserById(job.recipient_user_id),
        supabase.from('notifications').select('title,body,kind,ticket_id').eq('id', job.notification_id).maybeSingle(),
        supabase.from('notification_preferences').select('email_enabled,email_on_messages,email_on_project_updates').eq('user_id', job.recipient_user_id).maybeSingle()
      ]);
      if (userError || notificationError || preferenceError || !notification) {
        throw new Error('Notification recipient, preference, or record is unavailable.');
      }
      const categoryEnabled = notification.kind === 'new_message'
        ? preferences?.email_on_messages === true
        : preferences?.email_on_project_updates === true;
      if (preferences?.email_enabled !== true || !categoryEnabled) {
        const { error: skipError } = await supabase.from('email_notification_jobs').update({
          status: 'skipped', locked_at: null,
          last_error: 'Skipped because email notifications were disabled before delivery.'
        }).eq('id', job.id);
        if (skipError) throw new Error('Could not safely mark opted-out notification as skipped.');
        skipped++;
        continue;
      }

      const recipient = userResult?.user;
      if (!recipient?.email || !recipient.email_confirmed_at) {
        const { error: skipError } = await supabase.from('email_notification_jobs').update({
          status: 'skipped', locked_at: null,
          last_error: 'Skipped because the recipient no longer has a verified email address.'
        }).eq('id', job.id);
        if (skipError) throw new Error('Could not safely mark the unverified recipient job as skipped.');
        skipped++;
        continue;
      }

      const subject = `ZeroDev Studio · ${String(notification.title || 'Project update').slice(0, 120)}`;
      const title = escapeHtml(notification.title || 'Project update');
      const body = escapeHtml(notification.body || 'There is a new update in your client workspace.').replace(/\r?\n/g, '<br>');
      const html = `<!doctype html><html><body style="margin:0;padding:32px;background:#f5f7fb;font-family:Arial,sans-serif;color:#142033"><table role="presentation" style="max-width:560px;margin:auto;background:#fff;border:1px solid #e3e9f1;border-radius:14px;padding:28px;width:100%"><tr><td><p style="font-weight:bold;color:#2563eb;letter-spacing:2px;font-size:11px">ZERO DEV STUDIO</p><h1 style="font-size:22px">${title}</h1><p style="font-size:14px;line-height:1.7">${body}</p><p style="font-size:12px;color:#68778c">Sign in to your client workspace to review the update. Do not reply with passwords, PINs, or one-time codes.</p><p style="font-size:12px;color:#68778c">Started with zero. Built with purpose.</p></td></tr></table></body></html>`;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${resendKey}`,
          'content-type': 'application/json',
          'Idempotency-Key': `zerodev-notification-${job.id}`
        },
        body: JSON.stringify({
          from,
          to: [recipient.email],
          subject,
          html,
          text: `${notification.title || 'Project update'}\n\n${notification.body || 'Sign in to your client workspace to review the update.'}\n\nZeroDev Studio`
        })
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mail provider rejected the message (${response.status}): ${detail.slice(0, 180)}`);
      }
      const { error: updateError } = await supabase.from('email_notification_jobs').update({
        status: 'sent', sent_at: new Date().toISOString(), locked_at: null, last_error: null
      }).eq('id', job.id);
      if (updateError) throw new Error('Email sent but queue status update failed. Review worker logs before retrying.');
      sent++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error || 'Unknown email delivery error');
      const attempts = Number(job.attempts || 1);
      const terminal = attempts >= 5;
      const nextAttempt = Math.min(60, 2 ** Math.min(5, attempts));
      const { error: retryUpdateError } = await supabase.from('email_notification_jobs').update({
        status: terminal ? 'failed' : 'pending',
        locked_at: null,
        next_attempt_at: new Date(Date.now() + nextAttempt * 60_000).toISOString(),
        last_error: message.slice(0, 500)
      }).eq('id', job.id);
      if (retryUpdateError) console.error('Could not update email job retry state:', job.id, retryUpdateError.message);
    }
  }

  return json({ processed: (jobs || []).length, sent, failed, skipped });
});
