(() => {
  'use strict';
  const authUrl = 'https://ep-still-bar-bic6rvg9.neonauth.c-5.ap-southeast-1.aws.neon.tech/neondb/auth';
  const dataUrl = 'https://ep-still-bar-bic6rvg9.apirest.c-5.ap-southeast-1.aws.neon.tech/neondb/rest/v1';
  const catalogPath = '/hansol_catalog?id=eq.1';
  const api = window.hansolCatalog;
  let guest;
  let guestRequest;

  function request(url, options = {}) {
    return fetch(url, {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), ...options});
  }

  async function publicToken() {
    if (guest?.token && guest.expires_at > Date.now() / 1000 + 30) return guest.token;
    guestRequest ??= request(authUrl + '/token/anonymous').then(async response => {
      if (!response.ok) throw new Error('방문객 상품 연결 실패 (HTTP ' + response.status + ').');
      guest = await response.json();
      if (!guest?.token) throw new Error('방문객 상품 연결을 확인할 수 없습니다.');
      return guest.token;
    }).finally(() => { guestRequest = undefined; });
    return guestRequest;
  }

  async function data(path, {token, method = 'GET', body, prefer} = {}) {
    const headers = {Authorization: 'Bearer ' + (token ?? await publicToken())};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    const response = await request(dataUrl + path, {method, headers, body: JSON.stringify(body)});
    if (!response.ok) throw Object.assign(new Error('상품 서버 요청 실패 (HTTP ' + response.status + ').'), {status: response.status});
    return response.status === 204 ? null : response.json();
  }

  function rpcValue(result, name) {
    const row = Array.isArray(result) && result.length === 1 ? result[0] : result;
    return row && typeof row === 'object' && Object.hasOwn(row, name) ? row[name] : row;
  }

  async function getManager() {
    const response = await request(authUrl + '/get-session', {credentials: 'include'});
    if (!response.ok) return null;
    const session = await response.json();
    const token = response.headers.get('Set-Auth-Jwt');
    if (!token || !session?.user?.emailVerified) return null;
    const name = 'hansol_is_catalog_admin';
    const result = await data('/rpc/' + name, {token, method: 'POST', body: {}});
    return rpcValue(result, name) === true ? {token, user: session.user} : null;
  }

  async function managerToken() {
    const session = await getManager();
    if (!session) throw Object.assign(new Error('Neon 상품 관리자 로그인이 필요합니다.'), {status: 403});
    return session.token;
  }

  async function readCatalog(columns) {
    const [row] = await data(catalogPath + '&select=' + columns);
    if (!row || !Number.isSafeInteger(row.revision)) throw new Error('상품 목록을 찾을 수 없습니다.');
    return row;
  }

  Object.assign(api, {
    async readRevision() { return readCatalog('revision,next_id'); },
    async read() { return readCatalog('revision,next_id,items'); },
    async shopReady() { return false; },
    async cartSnapshot() { return []; },
    async saveOneProduct(revision, id, product, changes) {
      const current = await readCatalog('revision,next_id,items');
      if (current.revision !== revision) return null;
      const itemId = id ?? current.next_id;
      const existing = current.items.find(item => item.id === itemId);
      if (id !== null && !existing) return null;
      const imgs = [0, 1, 2].map(slot => changes[slot] ?? existing?.imgs?.[slot] ?? '');
      const item = {...existing, ...product, id: itemId, imgs};
      const items = id === null ? [...current.items, item]
        : current.items.map(entry => entry.id === id ? item : entry);
      const saved = await this.write(current, items, id === null ? itemId + 1 : current.next_id);
      return {item_id: itemId, revision: saved.revision, next_id: saved.next_id};
    },
    async write(previous, items, nextId) {
      const [row] = await data(catalogPath + '&revision=eq.' + previous.revision + '&select=revision,next_id', {
        token: await managerToken(), method: 'PATCH', prefer: 'return=representation',
        body: {revision: previous.revision + 1, next_id: nextId, items},
      });
      if (!row) throw Object.assign(new Error('상품이 변경되었습니다. 다시 열어 주세요.'), {conflict: true});
      return {...row, items};
    },
  });

  window.hansolNeonManager = {
    async restore() {
      const session = await getManager();
      if (!session) return null;
      return {id: 'flowerday1585', accountId: session.user.id, email: session.user.email,
        name: session.user.name || '관리자', neonCatalogManager: true};
    },
    async logout() {
      const response = await request(authUrl + '/sign-out', {
        method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json'}, body: '{}',
      });
      if (!response.ok) throw new Error('Neon 로그아웃에 실패했습니다.');
    },
  };
})();
