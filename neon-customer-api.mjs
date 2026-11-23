// Customer-side Neon Auth + Data API client. This module is intentionally not
// loaded by index.html yet: the existing Supabase customer flow remains active
// until the Neon migration has been applied and reviewed on a non-production branch.

export async function createNeonCustomerApi({authUrl, dataUrl}) {
  if (!authUrl || !dataUrl) throw new Error('Neon Auth/Data API URL 설정이 필요합니다.');
  const {createAuthClient} = await import('https://esm.sh/@neondatabase/auth@0.4.0-beta');
  const auth = createAuthClient(authUrl, {allowAnonymous: false});

  async function token(required = true) {
    const result = await auth.getSession();
    const session = result?.data ?? result;
    if (!session?.user) {
      if (!required) return null;
      throw Object.assign(new Error('로그인해 주세요.'), {status: 401});
    }
    if (!session.user.emailVerified) {
      throw Object.assign(new Error('이메일 인증이 필요합니다.'), {code: 'EMAIL_REQUIRED'});
    }
    const jwt = await auth.getJWTToken();
    if (!jwt) throw new Error('Neon 로그인 토큰을 가져오지 못했습니다.');
    return {jwt, user: session.user};
  }

  async function rpc(name, body = {}) {
    const current = await token();
    const response = await fetch(`${dataUrl.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {'Authorization': `Bearer ${current.jwt}`, 'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const message = result?.message || `Neon RPC 요청 실패 (HTTP ${response.status}).`;
      throw Object.assign(new Error(message), {status: response.status, code: message});
    }
    return result;
  }

  return {
    auth,
    async signup(email, password, profile) {
      const result = await auth.signUp.email({email, password, name: profile?.shop_name || email});
      if (result?.error) throw Object.assign(new Error(result.error.message || '회원가입에 실패했습니다.'), result.error);
      return result?.data ?? result;
    },
    async login(email, password) {
      const result = await auth.signIn.email({email, password});
      if (result?.error) throw Object.assign(new Error(result.error.message || '로그인에 실패했습니다.'), result.error);
      const current = await token();
      const profile = await rpc('hansol_my_profile');
      return {id: current.user.id, accountId: current.user.id, name: profile?.shop_name || current.user.name || email,
        email: current.user.email, profile, emailConfirmed: Boolean(current.user.emailVerified)};
    },
    async completeSignup(profile) {
      await token();
      return rpc('hansol_complete_signup', {p_profile: profile});
    },
    async submitOrder(order) {
      return rpc('hansol_submit_order', {
        p_id: order.id, p_lines: order.lines, p_recipient: order.recipient,
        p_phone: order.phone, p_address: order.address, p_customs: order.customs || '',
      });
    },
    async submitInquiry(inquiry) {
      return rpc('hansol_submit_inquiry', {
        p_id: inquiry.id, p_subject: inquiry.subject, p_message: inquiry.message,
      });
    },
    async signOut() {
      const result = await auth.signOut();
      if (result?.error) throw Object.assign(new Error(result.error.message || '로그아웃에 실패했습니다.'), result.error);
      return result?.data ?? result;
    },
  };
}
