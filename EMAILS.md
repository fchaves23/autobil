# Autobil: configurar o envio de e-mails (Resend)

Ao final, o Autobil envia sozinho:
- **convite de motorista**, quando o dono convida um e-mail na Garagem;
- **confirmação de conta** e **recuperação de senha**, do próprio Supabase, agora pelo Resend e em português.

Tempo total: uns 20 minutos, mais a espera do DNS (de minutos a algumas horas).

---

## Parte 1: Resend

1. Crie a conta em https://resend.com (o plano grátis envia 3.000 e-mails por mês e 100 por dia).
2. Vá em **Domains › Add Domain** e digite o domínio de onde os e-mails vão sair, por exemplo `acelerasupr.com.br`. Escolha a região **São Paulo (sa-east-1)** se aparecer a opção.
3. O Resend mostra de 3 a 4 registros de DNS (tipos **TXT** e **MX**, com nomes como `resend._domainkey` e `send`). Cadastre cada um, exatamente como aparece, no lugar onde o DNS do domínio é administrado (Registro.br, Cloudflare, Hostinger, GoDaddy…).
4. Volte ao Resend e clique em **Verify DNS Records**. Quando todos ficarem **Verified** ✅, o domínio está pronto.
5. Vá em **API Keys › Create API Key**, dê o nome `autobil` com permissão **Sending access** e copie a chave (`re_...`). Ela só aparece uma vez. **Não cole essa chave no chat nem em arquivos do projeto:** ela é secreta e vai só nos painéis abaixo.

## Parte 2: função de convite no Supabase

1. No Supabase, abra **Edge Functions › Deploy a new function › Via Editor**.
2. Nome da função: **`send-invite`** (exatamente assim).
3. Apague o código de exemplo, cole o conteúdo de [`supabase/functions/send-invite/index.ts`](supabase/functions/send-invite/index.ts) e clique em **Deploy function**.
4. Em **Edge Functions › Secrets**, adicione 3 segredos:

| Nome | Valor |
|---|---|
| `RESEND_API_KEY` | a chave `re_...` do Resend |
| `EMAIL_FROM` | `Autobil <autobil@acelerasupr.com.br>` (use o domínio verificado no Resend) |
| `APP_URL` | `http://localhost:5173` por enquanto; depois do deploy, o endereço da Vercel |

## Parte 3: e-mails de login pelo Resend (SMTP)

1. Em **Authentication › Emails › SMTP Settings**, ligue **Enable custom SMTP** e preencha:

| Campo | Valor |
|---|---|
| Sender email | `autobil@acelerasupr.com.br` (domínio verificado) |
| Sender name | `Autobil` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a mesma chave `re_...` do Resend |

2. Em **Authentication › Rate Limits**, suba **"Rate limit for sending emails"** para algo como `100` por hora.
3. Em **Authentication › Emails › Templates**, troque o assunto e o corpo de cada e-mail:

| Modelo | Assunto | Corpo (cole o arquivo) |
|---|---|---|
| Confirm signup | `Confirme seu e-mail no Autobil` | [`confirmar-conta.html`](supabase/email-templates/confirmar-conta.html) |
| Reset Password | `Crie uma nova senha no Autobil` | [`recuperar-senha.html`](supabase/email-templates/recuperar-senha.html) |
| Change Email Address | `Confirme seu novo e-mail no Autobil` | [`trocar-email.html`](supabase/email-templates/trocar-email.html) |

4. (Recomendado) Com o SMTP funcionando, religue **Authentication › Sign In / Providers › Email › Confirm email**. Assim só entra quem tem acesso ao próprio e-mail.

## Parte 4: testar

1. Na Garagem, convide um e-mail seu que ainda não tem conta. A caixa deve mostrar **"✓ Convite enviado para…"**, e o e-mail chega com o botão **Aceitar convite**.
2. Na tela de login, use **Esqueci a senha** com o seu e-mail. O link abre o app na tela **Criar nova senha**.

Se a caixa mostrar "O e-mail automático não saiu", a mensagem entre parênteses diz o motivo. Os mais comuns:
- **"Envio de e-mail não configurado":** faltou algum segredo da Parte 2.4.
- **"The domain is not verified":** o DNS ainda não propagou, ou o `EMAIL_FROM` usa outro domínio.
- **"Faça login de novo" / erro 401:** em **Edge Functions › send-invite › Details**, desligue **Verify JWT with legacy secret** (a função já confere o login por conta própria) e tente de novo.
