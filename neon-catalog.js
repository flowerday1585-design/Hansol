(() => {
  'use strict';
  const authUrl = 'https://ep-still-bar-bic6rvg9.neonauth.c-5.ap-southeast-1.aws.neon.tech/neondb/auth';
  const dataUrl = 'https://ep-still-bar-bic6rvg9.apirest.c-5.ap-southeast-1.aws.neon.tech/neondb/rest/v1';
  const catalogPath = '/hansol_catalog?id=eq.1';
  const api = window.hansolCatalog;
  let guest;
  let guestRequest;

  const photos = new WeakMap();
  const photoPrefix = location.origin + '/#product-photo-';

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

  async function showPhoto(image, reference) {
    const previous = photos.get(image);
    if (previous?.reference === reference) return;
    if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
    const current = {reference};
    photos.set(image, current);
    image.removeAttribute('src');
    if (!reference) return;
    if (!reference.startsWith(photoPrefix)) {
      image.src = reference;
      return;
    }
    const id = reference.slice(photoPrefix.length);
    if (!/^[0-9a-f-]{36}$/.test(id)) return;
    try {
      const [photo] = await data('/hansol_product_photos?id=eq.' + id + '&select=mime,content');
      if (!image.isConnected || photos.get(image) !== current || !photo
        || !/^image\/(webp|gif)$/.test(photo.mime) || !/^\\x[0-9a-f]+$/i.test(photo.content)) return;
      const bytes = Uint8Array.fromHex(photo.content.slice(2));
      current.objectUrl = URL.createObjectURL(new Blob([bytes], {type: photo.mime}));
      image.src = current.objectUrl;
    } catch {
      if (photos.get(image) === current) photos.delete(image);
    }
  }

  const photoObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      photoObserver.unobserve(entry.target);
      void showPhoto(entry.target, entry.target.dataset.neonPhoto);
    }
  }, {rootMargin: '180px'});

  function visitPhotos(node, action) {
    if (!(node instanceof Element)) return;
    if (node.matches('img[data-neon-photo]')) action(node);
    node.querySelectorAll('img[data-neon-photo]').forEach(action);
  }

  new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => visitPhotos(node, image => photoObserver.observe(image)));
      record.removedNodes.forEach(node => visitPhotos(node, image => {
        if (image.isConnected) return;
        photoObserver.unobserve(image);
        const previous = photos.get(image);
        if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
        photos.delete(image);
      }));
    }
  }).observe(document.body, {childList: true, subtree: true});

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
    async uploadProductPhoto(blob) {
      if (!(blob instanceof Blob) || !/^image\/(webp|gif)$/.test(blob.type) || blob.size > 400 * 1024) {
        throw new Error('사진을 400KB 이하로 줄일 수 없습니다. 더 작은 사진을 선택해 주세요.');
      }
      const id = crypto.randomUUID();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      await data('/hansol_product_photos', {
        token: await managerToken(), method: 'POST', prefer: 'return=minimal',
        body: {id, mime: blob.type, content: '\\x' + hex},
      });
      return photoPrefix + id;
    },
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
    isStoredPhoto(reference) { return reference.startsWith(photoPrefix); },
    showPhoto,
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
