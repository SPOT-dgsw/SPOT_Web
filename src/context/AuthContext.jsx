import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);
const AUTH_POLL_INTERVAL_MS = 60000;
// visibilitychange와 focus가 같은 사용자 조작에 대해 연달아 발생하는 경우가 많아 쓰로틀링 적용
const AUTH_FETCH_THROTTLE_MS = 5000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastFetchTsRef = useRef(0);

  const fetchUser = useCallback(() => {
    lastFetchTsRef.current = Date.now();
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUser();

    const fetchIfStale = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchTsRef.current < AUTH_FETCH_THROTTLE_MS) return;
      fetchUser();
    };

    // 주기적 세션 갱신 + 포커스/가시성 복귀 시 즉시 갱신 (쓰로틀링으로 중복 호출 방지)
    const interval = setInterval(fetchIfStale, AUTH_POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', fetchIfStale);
    window.addEventListener('focus', fetchIfStale);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', fetchIfStale);
      window.removeEventListener('focus', fetchIfStale);
    };
  }, [fetchUser]);

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
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
