// Autobil — Edge Function "send-invite"
// Envia, pelo Resend, o e-mail de convite de motorista.
// O app chama esta função logo depois que o dono convida um e-mail na Garagem.
//
// Segredos necessários (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY  chave da API do Resend (re_...)
//   EMAIL_FROM      remetente, ex.: Autobil <convite@seudominio.com.br>
//   APP_URL         endereço do app, ex.: https://autobil.vercel.app

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!resendKey || !from) return json({ error: 'Envio de e-mail não configurado (RESEND_API_KEY / EMAIL_FROM).' }, 500)

  const authorization = req.headers.get('Authorization') ?? ''
  const apikey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const appUrl = (Deno.env.get('APP_URL') ?? req.headers.get('origin') ?? '').replace(/\/$/, '')

  let inviteId = ''
  try {
    inviteId = (await req.json()).invite_id
  } catch {
    return json({ error: 'Corpo inválido.' }, 400)
  }
  if (!inviteId) return json({ error: 'Informe invite_id.' }, 400)

  // Cliente com o login de quem chamou: as regras do banco garantem
  // que só o dono do carro enxerga (e portanto envia) o convite.
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, apikey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await sb.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (userError || !userData.user) return json({ error: 'Faça login de novo.' }, 401)

  const { data: invite, error } = await sb
    .from('vehicle_invites')
    .select('email, vehicles(name, plate, invite_code), profiles(name)')
    .eq('id', inviteId)
    .maybeSingle()

  if (error) return json({ error: error.message }, 400)
  if (!invite) return json({ error: 'Convite não encontrado ou você não é o dono do carro.' }, 404)

  const vehicle = invite.vehicles as unknown as { name: string; plate: string; invite_code: string }
  const owner = (invite.profiles as unknown as { name: string } | null)?.name || 'O dono do carro'
  const link = `${appUrl}/?codigo=${vehicle.invite_code}`
  const car = escape(vehicle.name) + (vehicle.plate ? ` (${escape(vehicle.plate)})` : '')

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f1524">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#3a5bff;padding:22px 28px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">auto<span style="color:#ffb224">bil</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">Você foi convidado para o ${car}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4a5368">${escape(owner)} adicionou você como motorista no Autobil. Lá vocês registram juntos abastecimentos, despesas e manutenções do carro.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:14px;background:#3a5bff">
<a href="${link}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Aceitar convite</a>
</td></tr></table>
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#7d869a">Crie sua conta com <strong>${escape(invite.email)}</strong> e o carro aparece na hora. Se preferir, use o código <strong style="letter-spacing:2px">${vehicle.invite_code}</strong> na tela de login.</p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e3e7f0;font-size:12px;color:#7d869a">Não conhece quem enviou? É só ignorar este e-mail.</td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = `${owner} adicionou você como motorista do ${vehicle.name} no Autobil.\n\nAceite o convite: ${link}\n\nCrie sua conta com ${invite.email} ou use o código ${vehicle.invite_code} na tela de login.`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [invite.email],
      subject: `${owner} te convidou para o ${vehicle.name} no Autobil`,
      html,
      text,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    return json({ error: `O Resend recusou o envio: ${detail}` }, 502)
  }
  return json({ sent: true })
})
