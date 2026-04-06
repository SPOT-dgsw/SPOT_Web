import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import SongCard from '../components/SongCard';
import ApprovalDetail from '../components/approval/ApprovalDetail';
import RejectModal from '../components/approval/RejectModal';

const kstDateInputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const kstDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});

function toKstDateInputValue(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return kstDateInputFormatter.format(date);
}

function getWakeupScheduleMinDateInputValue(date = new Date()) {
  const parts = kstDateTimeFormatter.formatToParts(date);
  const pick = (type) => Number(parts.find((p) => p.type === type)?.value);
  const pad = (n) => String(n).padStart(2, '0');

  const current = {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
  };

  if (current.hour >= 8) {
    const nextDate = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
    return `${nextDate.getUTCFullYear()}-${pad(nextDate.getUTCMonth() + 1)}-${pad(nextDate.getUTCDate())}`;
  }

  return `${current.year}-${pad(current.month)}-${pad(current.day)}`;
}

function WakeupQueue() {
  const [songs, setSongs] = useState([]);
  const [todaySongs, setTodaySongs] = useState([]);
  const [approvedSongs, setApprovedSongs] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const [unapproving, setUnapproving] = useState(null);
  const [selectedDate, setSelectedDate] = useState({});
  const { showToast } = useToast();
  const minScheduleDateInputValue = getWakeupScheduleMinDateInputValue();

  const load = useCallback(
    () => api.get('/api/admin/wakeup/queue').then(r => setSongs(r.data.songs)),
    []
  );
  const loadToday = useCallback(
    () => api.get('/api/songs/today').then(r => setTodaySongs(r.data.songs)),
    []
  );
  const loadApproved = useCallback(
    () => api.get('/api/songs/schedule').then(r => setApprovedSongs(r.data.songs)),
    []
  );
  const refresh = useCallback(
    () => Promise.all([load(), loadToday(), loadApproved()]),
    [load, loadToday, loadApproved]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reject = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setDeleting(id);
    try {
      await api.delete(`/api/admin/wakeup/${id}`);
      showToast('기상송이 삭제되었습니다.', 'success');
      await refresh();
    } catch (err) {
      showToast(err.response?.data?.error || '삭제에 실패했습니다.', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const updateSchedule = async (id) => {
    const date = selectedDate[id];
    if (!date) {
      showToast('날짜를 선택해주세요.', 'warning');
      return;
    }

    setScheduling(id);
    try {
      await api.patch(`/api/admin/wakeup/${id}/schedule`, { play_date: date });
      showToast('스케줄이 변경되었습니다.', 'success');
      setSelectedDate(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
      await refresh();
    } catch (err) {
      showToast(err.response?.data?.error || '스케줄 변경에 실패했습니다.', 'error');
    } finally {
      setScheduling(null);
    }
  };

  const cancelApproval = async (id) => {
    if (!confirm('이 기상송의 승인을 취소하시겠습니까?')) return;

    setUnapproving(id);
    try {
      await api.patch(`/api/admin/wakeup/${id}/unapprove`);
      showToast('기상송 승인이 취소되었습니다.', 'success');
      await refresh();
    } catch (err) {
      showToast(err.response?.data?.error || '승인 취소에 실패했습니다.', 'error');
    } finally {
      setUnapproving(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">기상송 대기열</h3>
        {songs.length === 0 ? (
          <p className="cu-empty">대기 중인 기상송이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                showUser
                actions={
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row gap-1">
                      <input
                        type="date"
                        value={selectedDate[song.id] || ''}
                        onChange={(e) => setSelectedDate(prev => ({ ...prev, [song.id]: e.target.value }))}
                        min={minScheduleDateInputValue}
                        className="cu-input w-full sm:w-auto text-xs"
                      />
                      <button
                        onClick={() => updateSchedule(song.id)}
                        disabled={scheduling === song.id || !selectedDate[song.id]}
                        className="cu-btn cu-btn-primary w-full sm:w-auto"
                      >
                        {scheduling === song.id ? '승인 중...' : '승인'}
                      </button>
                    </div>
                    <button
                      onClick={() => reject(song.id)}
                      disabled={deleting === song.id}
                      className="cu-btn cu-btn-danger w-full sm:w-auto"
                    >
                      {deleting === song.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
        <p className="text-xs mt-3" style={{ color: 'var(--dds-color-text-secondary)' }}>
          매일 오전 8시에 상위 2곡이 자동 승인됩니다.
        </p>
      </div>

      {(todaySongs.length > 0 || approvedSongs.length > 0) && (
        <div>
          <h3 className="text-lg font-semibold mb-3">승인된 기상송 스케줄</h3>
          <div className="space-y-3">
            {[...todaySongs, ...approvedSongs].map((song) => (
              <SongCard
                key={song.id}
                song={song}
                showUser
                actions={
                  <div className="flex flex-col sm:flex-row gap-1">
                    <input
                      type="date"
                      value={selectedDate[song.id] || toKstDateInputValue(song.play_date)}
                      onChange={(e) => setSelectedDate(prev => ({ ...prev, [song.id]: e.target.value }))}
                      min={minScheduleDateInputValue}
                      className="cu-input w-full sm:w-auto text-xs"
                    />
                    <button
                      onClick={() => updateSchedule(song.id)}
                      disabled={scheduling === song.id || !selectedDate[song.id]}
                      className="cu-btn cu-btn-secondary w-full sm:w-auto"
                    >
                      {scheduling === song.id ? '변경 중...' : '날짜 변경'}
                    </button>
                    {song.status === 'APPROVED' && (
                      <button
                        onClick={() => cancelApproval(song.id)}
                        disabled={unapproving === song.id}
                        className="cu-btn cu-btn-danger w-full sm:w-auto"
                      >
                        {unapproving === song.id ? '취소 중...' : '승인 취소'}
                      </button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RadioManagement() {
  const [applications, setApplications] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [ytStatus, setYtStatus] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [processing, setProcessing] = useState(null);
  const { showToast } = useToast();

  const loadApps = useCallback(
    () => api.get('/api/admin/radio/applications').then(r => setApplications(r.data.songs)),
    []
  );
  const loadPlaylist = useCallback(
    () => api.get('/api/admin/radio/playlist').then(r => setPlaylist(r.data.songs)),
    []
  );
  const loadYt = useCallback(
    () => api.get('/api/admin/youtube/status').then(r => setYtStatus(r.data.connected)),
    []
  );
  const refreshRadioData = useCallback(
    () => Promise.all([loadApps(), loadPlaylist()]),
    [loadApps, loadPlaylist]
  );

  useEffect(() => {
    Promise.all([refreshRadioData(), loadYt()]);
  }, [refreshRadioData, loadYt]);

  const approve = async (id) => {
    setProcessing({ id, action: 'approve' });
    try {
      await api.patch(`/api/admin/radio/${id}/approve`);
      showToast('신청이 승인되었습니다.', 'success');
      await refreshRadioData();
    } catch (err) {
      showToast(err.response?.data?.error || '승인에 실패했습니다.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (id) => {
    setProcessing({ id, action: 'reject' });
    try {
      await api.patch(`/api/admin/radio/${id}/reject`);
      showToast('신청이 거절되었습니다.', 'info');
      await refreshRadioData();
    } catch (err) {
      showToast(err.response?.data?.error || '거절에 실패했습니다.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const approveAll = async () => {
    if (applications.length === 0) return;
    if (!confirm('대기 중인 점심방송 신청을 모두 승인하시겠습니까?')) return;

    setBulkApproving(true);
    try {
      const res = await api.patch('/api/admin/radio/approve-all');
      const count = res.data?.updatedCount ?? 0;
      if (count > 0) {
        showToast(`${count}개 신청이 일괄 승인되었습니다.`, 'success');
      } else {
        showToast('승인할 신청이 없습니다.', 'info');
      }
      await refreshRadioData();
    } catch (err) {
      showToast(err.response?.data?.error || '일괄 승인에 실패했습니다.', 'error');
    } finally {
      setBulkApproving(false);
    }
  };

  const exportPlaylist = async () => {
    if (playlist.length === 0) return;
    setExporting(true);
    try {
      const res = await api.post('/api/admin/youtube/export', {
        songIds: playlist.map(s => s.id),
      });
      showToast('YouTube 재생목록이 생성되었습니다!', 'success');
      window.open(res.data.url, '_blank');
    } catch (err) {
      showToast(err.response?.data?.error || '재생목록 생성에 실패했습니다.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold">점심방송 신청 목록</h3>
          <button
            onClick={approveAll}
            disabled={applications.length === 0 || bulkApproving || processing !== null}
            className="cu-btn cu-btn-primary w-full sm:w-auto"
          >
            {bulkApproving ? '일괄 승인 중...' : '일괄 승인'}
          </button>
        </div>
        {applications.length === 0 ? (
          <p className="cu-empty">대기 중인 신청이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {applications.map(song => (
              <SongCard
                key={song.id}
                song={song}
                showUser
                actions={
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => approve(song.id)}
                      disabled={processing?.id === song.id || bulkApproving}
                      className="cu-btn cu-btn-success"
                    >
                      {processing?.id === song.id && processing?.action === 'approve' ? '승인 중...' : '승인'}
                    </button>
                    <button
                      onClick={() => reject(song.id)}
                      disabled={processing?.id === song.id || bulkApproving}
                      className="cu-btn cu-btn-danger"
                    >
                      {processing?.id === song.id && processing?.action === 'reject' ? '거절 중...' : '거절'}
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold">오늘의 방송 목록</h3>
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2">
            {!ytStatus && (
              <span className="cu-badge cu-badge-warning">YouTube 미연결</span>
            )}
            <button
              onClick={exportPlaylist}
              disabled={playlist.length === 0 || !ytStatus || exporting}
              className="cu-btn cu-btn-primary w-full sm:w-auto"
            >
              {exporting ? '생성 중...' : 'YouTube 재생목록 내보내기'}
            </button>
          </div>
        </div>
        {playlist.length === 0 ? (
          <p className="cu-empty">승인된 곡이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {playlist.map(song => (
              <SongCard key={song.id} song={song} showUser />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserManagement() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [updating, setUpdating] = useState(null);
  const { showToast } = useToast();

  const search = async () => {
    if (!query.trim()) return;
    const res = await api.get(`/api/admin/users?q=${encodeURIComponent(query)}`);
    setUsers(res.data.users);
  };

  const toggleBlacklist = async (id) => {
    setUpdating(id);
    try {
      await api.patch(`/api/admin/users/${id}/blacklist`);
      const user = users.find(u => u.id === id);
      showToast(
        user?.is_blacklisted ? '차단이 해제되었습니다.' : '사용자가 차단되었습니다.',
        user?.is_blacklisted ? 'success' : 'warning'
      );
      search();
    } catch (err) {
      showToast(err.response?.data?.error || '처리에 실패했습니다.', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const updateRole = async (id, role) => {
    setUpdating(id);
    try {
      await api.patch(`/api/admin/users/${id}/role`, { role });
      showToast('역할이 변경되었습니다.', 'success');
      search();
    } catch (err) {
      showToast(err.response?.data?.error || '역할 변경에 실패했습니다.', 'error');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">사용자 관리</h3>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="이메일 또는 이름으로 검색..."
          className="cu-input flex-1"
        />
        <button
          onClick={search}
          className="cu-btn cu-btn-primary w-full sm:w-auto"
        >
          검색
        </button>
      </div>
      {users.length > 0 && (
        <div className="cu-table-wrap">
          <table className="cu-table min-w-[600px]">
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>역할</th>
                <th>상태</th>
                <th className="text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td style={{ color: 'var(--dds-color-text-secondary)' }}>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => updateRole(u.id, e.target.value)}
                      disabled={updating === u.id}
                      className="cu-input text-xs !w-auto disabled:opacity-50"
                    >
                      <option value="USER">USER</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="LEADER">LEADER</option>
                    </select>
                  </td>
                  <td>
                    <span className={`cu-badge ${u.is_blacklisted ? 'cu-badge-danger' : 'cu-badge-success'}`}>
                      {u.is_blacklisted ? '차단' : '정상'}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => toggleBlacklist(u.id)}
                      disabled={updating === u.id}
                      className={`cu-btn disabled:opacity-50 ${u.is_blacklisted ? 'cu-btn-success' : 'cu-btn-danger'}`}
                    >
                      {updating === u.id ? '처리 중...' : (u.is_blacklisted ? '차단 해제' : '차단')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pageSize: 30,
    totalPages: 1,
  });
  const { showToast } = useToast();

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/admin/audit/logs', {
          params: {
            page,
            pageSize: 30,
            q: query || undefined,
          },
        });

        setLogs(res.data.logs || []);
        setPagination(res.data.pagination || {
          total: 0,
          page: 1,
          pageSize: 30,
          totalPages: 1,
        });
      } catch (err) {
        showToast(err.response?.data?.error || '감사 로그를 불러오는데 실패했습니다.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [page, query, showToast]);

  const handleSearch = () => {
    setPage(1);
    setQuery(queryInput.trim());
  };

  const formatJsonText = (text) => {
    if (!text) return '-';
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">감사</h3>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={queryInput}
          onChange={e => setQueryInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="이름/이메일/경로/메서드 검색..."
          className="cu-input flex-1"
        />
        <button
          onClick={handleSearch}
          className="cu-btn cu-btn-primary w-full sm:w-auto"
        >
          검색
        </button>
      </div>

      {loading ? (
        <p className="cu-empty">로그를 불러오는 중...</p>
      ) : logs.length === 0 ? (
        <p className="cu-empty">조회된 로그가 없습니다.</p>
      ) : (
        <div className="cu-table-wrap">
          <table className="cu-table min-w-[1000px]">
            <thead>
              <tr>
                <th>시각</th>
                <th>사용자</th>
                <th>역할</th>
                <th>요청</th>
                <th>결과</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-xs whitespace-nowrap" style={{ color: 'var(--dds-color-text-secondary)' }}>
                    {new Date(log.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td>
                    <div className="font-medium">{log.user_name || '-'}</div>
                    <div className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>{log.user_email || '-'}</div>
                  </td>
                  <td>{log.user_role || '-'}</td>
                  <td>
                    <span className="cu-badge cu-badge-muted mr-2">
                      {log.method}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>{log.path}</span>
                  </td>
                  <td>
                    <div>{log.status_code}</div>
                    <div className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>{log.duration_ms ?? '-'}ms</div>
                  </td>
                  <td>
                    <details className="text-xs">
                      <summary className="cursor-pointer" style={{ color: 'var(--dds-color-brand-primary)' }}>보기</summary>
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="mb-1" style={{ color: 'var(--dds-color-text-secondary)' }}>query</div>
                          <pre className="p-2 rounded whitespace-pre-wrap break-all cu-subcard">{formatJsonText(log.request_query)}</pre>
                        </div>
                        <div>
                          <div className="mb-1" style={{ color: 'var(--dds-color-text-secondary)' }}>body</div>
                          <pre className="p-2 rounded whitespace-pre-wrap break-all cu-subcard">{formatJsonText(log.request_body)}</pre>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4">
        <p className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>총 {pagination.total}건</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
            className="cu-btn cu-btn-muted disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={loading || page >= pagination.totalPages}
            className="cu-btn cu-btn-muted disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}

function YoutubeSettings() {
  const [connected, setConnected] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    api.get('/api/admin/youtube/status').then(r => setConnected(r.data.connected));
  }, []);

  const connectYoutube = async () => {
    try {
      const res = await api.get('/api/admin/youtube/auth');
      window.open(res.data.url, '_blank', 'width=500,height=600');
      showToast('YouTube 인증 창이 열렸습니다.', 'info');
    } catch {
      showToast('YouTube 연결에 실패했습니다.', 'error');
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">YouTube 연결</h3>
      <div className="cu-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium">방송부 YouTube 계정</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dds-color-text-secondary)' }}>
              {connected ? '연결됨 — 재생목록을 생성할 수 있습니다.' : '연결되지 않음 — 연결 후 재생목록 내보내기를 사용할 수 있습니다.'}
            </p>
          </div>
          <button
            onClick={connectYoutube}
            className={`cu-btn ${connected ? 'cu-btn-muted' : 'cu-btn-primary'}`}
          >
            {connected ? '재연결' : '연결하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplyNoticeSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({
    wakeupPrimary: '',
    radioPrimary: '',
    common: '',
  });

  useEffect(() => {
    api.get('/api/admin/settings/apply-notice')
      .then((res) => {
        setNotice({
          wakeupPrimary: res.data?.notice?.wakeupPrimary || '',
          radioPrimary: res.data?.notice?.radioPrimary || '',
          common: res.data?.notice?.common || '',
        });
      })
      .catch((err) => {
        showToast(err.response?.data?.error || '신청 안내사항을 불러오는데 실패했습니다.', 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [showToast]);

  const handleChange = (key, value) => {
    setNotice((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch('/api/admin/settings/apply-notice', notice);
      setNotice(res.data.notice);
      showToast(res.data.message || '저장되었습니다.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || '저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="cu-empty">안내사항을 불러오는 중...</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">노래신청 안내사항 관리</h3>
      <div className="cu-card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">기상송 안내 문구</label>
          <textarea
            value={notice.wakeupPrimary}
            onChange={(e) => handleChange('wakeupPrimary', e.target.value)}
            maxLength={200}
            rows={2}
            className="cu-input resize-y min-h-20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">점심방송 안내 문구</label>
          <textarea
            value={notice.radioPrimary}
            onChange={(e) => handleChange('radioPrimary', e.target.value)}
            maxLength={200}
            rows={2}
            className="cu-input resize-y min-h-20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">공통 안내 문구</label>
          <textarea
            value={notice.common}
            onChange={(e) => handleChange('common', e.target.value)}
            maxLength={200}
            rows={2}
            className="cu-input resize-y min-h-20"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="cu-btn cu-btn-primary w-full sm:w-auto"
          >
            {saving ? '저장 중...' : '안내사항 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

const TEMPLATE_LABELS = {
  EQUIPMENT: '장비 대여',
  EVENT: '행사 지원',
  BUDGET: '예산 사용',
  GENERAL: '일반 품의',
};

const APPROVAL_STATUS_LABELS = {
  PENDING: '대기중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
  CANCELLED: '취소됨',
};

const APPROVAL_STATUS_BADGE = {
  PENDING: 'cu-badge-warning',
  APPROVED: 'cu-badge-success',
  REJECTED: 'cu-badge-danger',
  CANCELLED: 'cu-badge-muted',
};

function ApprovalManagement() {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [historyApprovals, setHistoryApprovals] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [subTab, setSubTab] = useState('pending');
  const [processing, setProcessing] = useState(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyQueryInput, setHistoryQueryInput] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyTemplate, setHistoryTemplate] = useState('');
  const { showToast } = useToast();

  const loadPending = useCallback(async () => {
    try {
      // pageSize=50(서버 상한)으로 대기 목록 전체 로드
      const res = await api.get('/api/approval/admin/pending', { params: { pageSize: 50 } });
      setPendingApprovals(res.data.approvals || []);
    } catch {
      // 에러는 개별 조작 시 처리
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const params = { page: historyPage, pageSize: 20 };
      if (historyQuery) params.q = historyQuery;
      if (historyStatus) params.status = historyStatus;
      if (historyTemplate) params.template = historyTemplate;
      const res = await api.get('/api/approval/admin/history', { params });
      setHistoryApprovals(res.data.approvals || []);
      setHistoryPagination(res.data.pagination || { total: 0, page: 1, totalPages: 1 });
    } catch {
      // silent
    }
  }, [historyPage, historyQuery, historyStatus, historyTemplate]);

  useEffect(() => { loadPending(); }, [loadPending]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleApprove = async (id) => {
    if (!confirm('이 결재를 승인하시겠습니까?')) return;
    setProcessing(id);
    try {
      await api.patch(`/api/approval/admin/${id}/approve`);
      showToast('결재가 승인되었습니다.', 'success');
      await loadPending();
      await loadHistory();
    } catch (err) {
      showToast(err.response?.data?.error || '승인에 실패했습니다.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectConfirm = async (id, comment) => {
    setProcessing(id);
    try {
      await api.patch(`/api/approval/admin/${id}/reject`, { comment });
      showToast('결재가 반려되었습니다.', 'info');
      setRejectTarget(null);
      await loadPending();
      await loadHistory();
    } catch (err) {
      showToast(err.response?.data?.error || '반려에 실패했습니다.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async () => {
    if (pendingApprovals.length === 0) return;
    if (!confirm(`대기 중인 결재 ${pendingApprovals.length}건을 모두 승인하시겠습니까?`)) return;
    setBulkApproving(true);
    try {
      const res = await api.patch('/api/approval/admin/approve-all');
      showToast(res.data.message || '일괄 승인되었습니다.', 'success');
      await loadPending();
      await loadHistory();
    } catch (err) {
      showToast(err.response?.data?.error || '일괄 승인에 실패했습니다.', 'error');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleHistorySearch = () => {
    setHistoryPage(1);
    setHistoryQuery(historyQueryInput.trim());
  };

  return (
    <div className="space-y-4">
      {/* 서브 탭 */}
      <div className="cu-tabbar">
        <button
          onClick={() => setSubTab('pending')}
          className={`cu-tab ${subTab === 'pending' ? 'is-active' : ''}`}
        >
          결재 대기
          {pendingApprovals.length > 0 && (
            <span className="ml-1.5 cu-badge cu-badge-danger">{pendingApprovals.length}</span>
          )}
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`cu-tab ${subTab === 'history' ? 'is-active' : ''}`}
        >
          결재 이력
        </button>
      </div>

      {/* 결재 대기 */}
      {subTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-lg font-semibold">결재 대기 목록</h3>
            <button
              onClick={handleBulkApprove}
              disabled={pendingApprovals.length === 0 || bulkApproving || processing !== null}
              className="cu-btn cu-btn-primary w-full sm:w-auto disabled:opacity-50"
            >
              {bulkApproving ? '일괄 승인 중...' : '일괄 승인'}
            </button>
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="cu-empty">대기 중인 결재가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((approval) => (
                <div key={approval.id} className="cu-card">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="cu-badge cu-badge-muted text-xs">{TEMPLATE_LABELS[approval.template]}</span>
                        <span className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>#{approval.id}</span>
                      </div>
                      <p className="font-medium truncate">{approval.title}</p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--dds-color-text-secondary)' }}>
                        {approval.user?.name} · {new Date(approval.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </p>
                      {approval.attachments?.length > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--dds-color-text-secondary)' }}>
                          첨부 파일 {approval.attachments.length}개
                        </p>
                      )}
                    </div>
                    <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        disabled={processing === approval.id || bulkApproving}
                        className="cu-btn cu-btn-success flex-1 sm:flex-none disabled:opacity-50"
                      >
                        {processing === approval.id ? '처리 중...' : '승인'}
                      </button>
                      <button
                        onClick={() => setRejectTarget(approval)}
                        disabled={processing === approval.id || bulkApproving}
                        className="cu-btn cu-btn-danger flex-1 sm:flex-none disabled:opacity-50"
                      >
                        반려
                      </button>
                      <button
                        onClick={() => setSelectedApproval(approval)}
                        className="cu-btn cu-btn-muted flex-1 sm:flex-none"
                      >
                        상세
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 결재 이력 */}
      {subTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">결재 이력</h3>
          {/* 검색 필터 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={historyQueryInput}
              onChange={(e) => setHistoryQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleHistorySearch()}
              placeholder="제목·기안자 검색..."
              className="cu-input flex-1"
            />
            <select
              value={historyStatus}
              onChange={(e) => { setHistoryStatus(e.target.value); setHistoryPage(1); }}
              className="cu-input sm:w-32"
            >
              <option value="">전체 상태</option>
              <option value="PENDING">대기중</option>
              <option value="APPROVED">승인됨</option>
              <option value="REJECTED">반려됨</option>
              <option value="CANCELLED">취소됨</option>
            </select>
            <select
              value={historyTemplate}
              onChange={(e) => { setHistoryTemplate(e.target.value); setHistoryPage(1); }}
              className="cu-input sm:w-36"
            >
              <option value="">전체 양식</option>
              <option value="EQUIPMENT">장비 대여</option>
              <option value="EVENT">행사 지원</option>
              <option value="BUDGET">예산 사용</option>
              <option value="GENERAL">일반 품의</option>
            </select>
            <button onClick={handleHistorySearch} className="cu-btn cu-btn-primary sm:w-auto">
              검색
            </button>
          </div>

          {historyApprovals.length === 0 ? (
            <p className="cu-empty">조회된 결재 이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {historyApprovals.map((approval) => (
                <div key={approval.id} className="cu-card">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="cu-badge cu-badge-muted text-xs">{TEMPLATE_LABELS[approval.template]}</span>
                        <span className={`cu-badge text-xs ${APPROVAL_STATUS_BADGE[approval.status]}`}>
                          {APPROVAL_STATUS_LABELS[approval.status]}
                        </span>
                      </div>
                      <p className="font-medium truncate">{approval.title}</p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--dds-color-text-secondary)' }}>
                        {approval.user?.name} · {new Date(approval.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedApproval(approval)}
                      className="cu-btn cu-btn-muted shrink-0"
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>총 {historyPagination.total}건</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="cu-btn cu-btn-muted disabled:opacity-50"
              >
                이전
              </button>
              <span className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>
                {historyPagination.page} / {historyPagination.totalPages}
              </span>
              <button
                onClick={() => setHistoryPage((p) => Math.min(historyPagination.totalPages, p + 1))}
                disabled={historyPage >= historyPagination.totalPages}
                className="cu-btn cu-btn-muted disabled:opacity-50"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedApproval && (
        <ApprovalDetail
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
        />
      )}

      {/* 반려 모달 */}
      {rejectTarget && (
        <RejectModal
          approval={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={processing === rejectTarget.id}
        />
      )}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const isLeader = user?.role === 'LEADER';
  const [leaderTab, setLeaderTab] = useState('wakeup');
  const activeTab = isLeader ? leaderTab : 'radio';

  const leaderTabs = [
    { id: 'wakeup', label: '기상송' },
    { id: 'radio', label: '점심방송' },
    { id: 'approval', label: '전자결재' },
    { id: 'users', label: '사용자 관리' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'applyNotice', label: '신청 안내' },
    { id: 'audit', label: '감사' },
  ];

  return (
    <div className="cu-page">
      <h2 className="cu-title mb-5">관리 페이지</h2>

      {isLeader && (
        <div className="mb-6 overflow-x-auto">
          <div className="cu-tabbar w-max">
            {leaderTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setLeaderTab(t.id)}
                className={`cu-tab ${activeTab === t.id ? 'is-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'wakeup' && isLeader && <WakeupQueue />}
      {activeTab === 'radio' && <RadioManagement />}
      {activeTab === 'approval' && isLeader && <ApprovalManagement />}
      {activeTab === 'audit' && isLeader && <AuditLogs />}
      {activeTab === 'users' && isLeader && <UserManagement />}
      {activeTab === 'youtube' && isLeader && <YoutubeSettings />}
      {activeTab === 'applyNotice' && isLeader && <ApplyNoticeSettings />}
    </div>
  );
}
