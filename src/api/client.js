import axios from 'axios';

// 백엔드(FastAPI) 인증 방식:
// - access token(15분)은 메모리에만 두고 Authorization 헤더로 보내요. localStorage에 넣지 않아요.
// - refresh token은 HttpOnly 쿠키(Path=/auth)라 JS에서 볼 수 없고, POST /auth/refresh가 알아서 써요.
// - 401 TOKEN_EXPIRED → refresh 한 번 → 원래 요청 재시도
// - 409 REFRESH_ROTATED → 다른 탭이 방금 갱신함. 잠깐 기다렸다 refresh 다시

const baseURL = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL, withCredentials: true });
const authApi = axios.create({ baseURL, withCredentials: true }); // 인터셉터 없이 refresh 전용

let accessToken = null;
let refreshPromise = null;
const listeners = new Set();

export function setAccessToken(token) {
  accessToken = token || null;
}

/** 로그인 상태가 바뀌면(refresh 실패 등) 알려 줘요. AuthContext가 구독해요. */
export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function doRefresh() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await authApi.post('/auth/refresh');
      setAccessToken(res.data.access_token);
      listeners.forEach((fn) => fn(res.data.user));
      return res.data;
    } catch (err) {
      if (errorCode(err) === 'REFRESH_ROTATED') {
        await sleep(300 * (attempt + 1));
        continue;
      }
      setAccessToken(null);
      if (err.response?.status === 401) listeners.forEach((fn) => fn(null));
      throw err;
    }
  }
  throw new Error('refresh failed');
}

/** 동시에 여러 요청이 401을 받아도 refresh는 한 번만 해요. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const code = errorCode(err);
    if (original && !original._retried && (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID')) {
      original._retried = true;
      try {
        await refreshSession();
      } catch {
        return Promise.reject(err);
      }
      return api(original);
    }
    return Promise.reject(err);
  }
);

export function errorCode(err) {
  return err?.response?.data?.error?.code;
}

/** 백엔드 오류를 화면에 보여 줄 문구로. 422면 첫 항목의 이유를 써요. */
export function errorMessage(err, fallback = '오류가 발생했습니다.') {
  const error = err?.response?.data?.error;
  if (!error) return fallback;
  if (error.code === 'VALIDATION_ERROR' && error.details?.length) return error.details[0].msg;
  return error.message || fallback;
}

export default api;
