import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { Banner, Brand, Button, Card, Field } from '../../ui';
import { useAuth } from '../../app/auth';
import { t } from '../../i18n';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card tone="strong" className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Brand size={34} />
          <p className="text-[13px] text-ink-2">{t('auth.login.subtitle')}</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field id="login-email" type="email" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <Field id="login-password" type="password" label={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          {error && <Banner tone="danger">{error}</Banner>}
          <Button variant="primary" type="submit" disabled={busy}>
            <LogIn size={16} />
            {busy ? t('auth.signin.loading') : t('auth.signin')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
