import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api, { onAuthChange, refreshSession, setAccessToken } from '../api/client';

const AuthContext = createContext(null);
const AUTH_POLL_INTERVAL_MS = 60000;
// visibilitychange와 focus가 같은 사용자 조작에 대해 연달아 발생하는 경우가 많아 쓰로틀링 적용
const AUTH_FETCH_THROTTLE_MS = 5000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastFetchTsRef = useRef(0);

  // 차단·역할 변경을 반영하려고 주기적으로 /auth/me를 다시 읽어요 (만료되면 client가 refresh)
  const fetchUser = useCallback(() => {
    lastFetchTsRef.current = Date.now();
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);

    // 새로고침·로그인 직후: refresh 쿠키로 access token을 받아요. 쿠키가 없으면 비로그인
    lastFetchTsRef.current = Date.now();
    refreshSession()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    const fetchIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchTsRef.current < AUTH_FETCH_THROTTLE_MS) return;
      fetchUser();
    };

    const interval = setInterval(fetchIfStale, AUTH_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', fetchIfStale);
    window.addEventListener('focus', fetchIfStale);

    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', fetchIfStale);
      window.removeEventListener('focus', fetchIfStale);
    };
  }, [fetchUser]);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
