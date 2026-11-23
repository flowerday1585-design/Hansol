const authUrl = 'https://ep-still-bar-bic6rvg9.neonauth.c-5.ap-southeast-1.aws.neon.tech/neondb/auth';
const dataUrl = 'https://ep-still-bar-bic6rvg9.apirest.c-5.ap-southeast-1.aws.neon.tech/neondb/rest/v1';

const login = document.querySelector('#login');
const submit = document.querySelector('#submit');
const email = document.querySelector('#email');
const password = document.querySelector('#password');
const status = document.querySelector('#status');
const manager = document.querySelector('#manager');
const logout = document.querySelector('#logout');
const heading = document.querySelector('#heading');

function unwrap(result) {
  if (result?.error) {
    const { code, status: httpStatus } = result.error;
    const messages = {
      INVALID_EMAIL_OR_PASSWORD: '이메일 또는 비밀번호가 일치하지 않습니다.',
      EMAIL_NOT_VERIFIED: '이 계정은 이메일 인증이 필요합니다.',
      INVALID_ORIGIN: '운영 홈페이지의 Neon 인증 허용 설정을 확인해 주세요.',
      INVALID_CALLBACK_URL: '운영 홈페이지의 Neon 리디렉션 설정을 확인해 주세요.',
    };
    throw new Error(messages[code] || (httpStatus === 429
      ? '잠시 후 다시 로그인해 주세요.'
      : 'Neon 로그인 요청이 실패했습니다' + (httpStatus ? ' (HTTP ' + httpStatus + ')' : '') + '.'));
  }
  return result?.data;
}

async function readData(path, token, method = 'GET') {
  const headers = { Authorization: 'Bearer ' + token };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  const response = await fetch(dataUrl + path, {
    method, headers, body: method === 'POST' ? '{}' : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Neon 관리자 데이터 요청이 실패했습니다 (HTTP ' + response.status + ').');
  return response.json();
}

function showList(selector, labels, emptyMessage) {
  const list = document.querySelector(selector);
  const rows = labels.length ? labels : [emptyMessage];
  list.replaceChildren(...rows.map(label => {
    const row = document.createElement('li');
    row.textContent = label;
    return row;
  }));
}

async function showManager(auth, user) {
  if (!user?.emailVerified) throw new Error('이 계정은 이메일 인증이 필요합니다.');
  const token = await auth.getJWTToken();
  if (!token) throw new Error('Neon 로그인 토큰을 받지 못했습니다.');
  if (await readData('/rpc/hansol_is_catalog_admin', token, 'POST') !== true) {
    throw new Error('이 계정에 상품·배너 관리자 권한이 없습니다.');
  }
  document.querySelector('#account').textContent = user.email;
  heading.textContent = '상품·배너 관리자';
  login.hidden = true;
  manager.hidden = false;
  status.textContent = '관리자 로그인 완료. 운영 데이터를 불러오는 중입니다.';
  try {
    const [catalog, banners] = await Promise.all([
      readData('/hansol_catalog?id=eq.1&select=items', token),
      readData('/hansol_banners?select=id,settings', token),
    ]);
    showList('#products', (catalog[0]?.items ?? []).map(item => item.name), '등록된 상품이 없습니다.');
    showList('#banners', banners.map(banner => {
      const label = banner.id === 'home' ? '홈 배너' : '공지사항 배너';
      return banner.settings?.title ? label + ' · ' + banner.settings.title : label;
    }), '등록된 배너가 없습니다.');
    status.textContent = 'Neon 운영 DB에 관리자 계정으로 연결됐습니다.';
  } catch (error) {
    showList('#products', [], '상품을 불러오지 못했습니다.');
    showList('#banners', [], '배너를 불러오지 못했습니다.');
    status.textContent = error.message;
  }
}

async function initialize() {
  const { createAuthClient } = await import('https://esm.sh/@neondatabase/auth@0.4.0-beta');
  const auth = createAuthClient(authUrl, { allowAnonymous: false });
  login.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = 'Neon에 로그인하고 있습니다.';
    const credentials = { email: email.value.trim(), password: password.value };
    password.value = '';
    let authenticated = false;
    try {
      const data = unwrap(await auth.signIn.email(credentials));
      authenticated = true;
      await showManager(auth, data?.user);
    } catch (error) {
      if (authenticated) await auth.signOut().catch(() => {});
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      unwrap(await auth.signOut());
      heading.textContent = '관리자 로그인';
      manager.hidden = true;
      document.querySelector('#account').textContent = '';
      showList('#products', [], '');
      showList('#banners', [], '');
      login.hidden = false;
      status.textContent = '로그아웃했습니다.';
      email.focus();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      logout.disabled = false;
    }
  });
  try {
    const session = unwrap(await auth.getSession());
    if (session?.user) {
      await showManager(auth, session.user);
    } else {
      status.textContent = '';
    }
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

initialize().catch(() => {
  status.textContent = 'Neon 로그인 모듈을 불러오지 못했습니다. 새로고침해 주세요.';
});
