import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import SongCard from '../components/SongCard';
import ApprovalForm from '../components/approval/ApprovalForm';
import ApprovalDetail from '../components/approval/ApprovalDetail';

function formatLastLogin(value) {
  if (!value) return '기록 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '기록 없음';
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');

  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}`;
}

const roleLabels = {
  USER: '학생',
  MEMBER: '방송부원',
  LEADER: '방송부장',
};

const statusLabels = {
  PENDING: '대기중',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  PLAYED: '재생됨',
};

const typeLabels = {
  WAKEUP: '기상송',
  RADIO: '점심방송',
};

const APPROVAL_TEMPLATE_LABELS = {
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

export default function MyPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [songs, setSongs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [cancellingSongId, setCancellingSongId] = useState(null);

  // 결재 관련 상태
  const [mainTab, setMainTab] = useState('songs');
  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [cancellingApprovalId, setCancellingApprovalId] = useState(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const isMember = user?.role === 'MEMBER' || user?.role === 'LEADER';

  useEffect(() => {
    api.get('/api/songs/my').then(r => setSongs(r.data.songs));
  }, []);

  useEffect(() => {
    if (isMember) {
      api.get('/api/approval/my', { params: { pageSize: 50 } }).then(r => setApprovals(r.data.approvals || []));
    }
  }, [isMember]);

  const filteredSongs = useMemo(() => {
    if (filter === 'all') return songs;
    if (filter === 'wakeup') return songs.filter((song) => song.type === 'WAKEUP');
    if (filter === 'radio') return songs.filter((song) => song.type === 'RADIO');
    return songs;
  }, [filter, songs]);

  const cancelSong = async (songId) => {
    if (!confirm('대기중인 신청을 취소하시겠습니까?')) return;

    setCancellingSongId(songId);
    try {
      await api.delete(`/api/songs/my/${songId}`);
      setSongs(prev => prev.filter(song => song.id !== songId));
      showToast('신청이 취소되었습니다.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || '신청 취소에 실패했습니다.', 'error');
    } finally {
      setCancellingSongId(null);
    }
  };

  const submitApproval = async (formData) => {
    setSubmittingApproval(true);
    try {
      await api.post('/api/approval', formData);
      showToast('결재 문서가 제출되었습니다.', 'success');
      setShowApprovalForm(false);
      const res = await api.get('/api/approval/my', { params: { pageSize: 50 } });
      setApprovals(res.data.approvals || []);
    } catch (err) {
      showToast(err.response?.data?.error || '결재 제출에 실패했습니다.', 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const cancelApproval = async (approvalId) => {
    if (!confirm('대기중인 결재 문서를 취소하시겠습니까?')) return;
    setCancellingApprovalId(approvalId);
    try {
      await api.patch(`/api/approval/my/${approvalId}/cancel`);
      setApprovals(prev => prev.map(a =>
        a.id === approvalId ? { ...a, status: 'CANCELLED' } : a
      ));
      showToast('결재 문서가 취소되었습니다.', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || '취소에 실패했습니다.', 'error');
    } finally {
      setCancellingApprovalId(null);
    }
  };

  const filteredApprovals = useMemo(() => {
    if (approvalFilter === 'all') return approvals;
    return approvals.filter(a => a.status === approvalFilter);
  }, [approvals, approvalFilter]);

  return (
    <div className="cu-page">
      <h2 className="cu-title mb-5">마이페이지</h2>

      {/* 결재 신청 폼 모달 */}
      {showApprovalForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <div
            className="w-full max-w-lg rounded-2xl shadow-xl overflow-y-auto max-h-[90vh]"
            style={{ background: 'var(--dds-color-bg-normal)' }}
          >
            <div className="p-5 border-b" style={{ borderColor: 'var(--dds-color-border-normal)' }}>
              <h3 className="text-base font-semibold">결재 신청</h3>
            </div>
            <div className="p-5">
              <ApprovalForm
                onSubmit={submitApproval}
                onCancel={() => setShowApprovalForm(false)}
                loading={submittingApproval}
              />
            </div>
          </div>
        </div>
      )}

      {/* 결재 상세 모달 */}
      {selectedApproval && (
        <ApprovalDetail
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
        />
      )}

      {/* 차단 경고 */}
      {user?.is_blacklisted && (
        <div
          className="p-4 rounded-xl border mb-6"
          style={{
            borderColor: 'color-mix(in srgb, var(--dds-color-status-error) 35%, var(--dds-color-border-normal))',
            background: 'var(--dds-color-status-error-soft)',
          }}
        >
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: 'var(--dds-color-status-error)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--dds-color-status-error)' }}>계정이 차단되었습니다</h3>
              <p className="text-sm" style={{ color: 'var(--dds-color-status-error)' }}>
                현재 노래 신청 및 기타 기능을 사용할 수 없습니다. 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 정보 */}
      <div className="cu-card mb-6">
        <h3 className="text-lg font-semibold mb-4">사용자 정보</h3>
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--dds-color-text-secondary)' }}>이름</span>
            <span className="text-sm font-medium">{user?.name}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--dds-color-text-secondary)' }}>이메일</span>
            <span className="text-sm font-medium break-all">{user?.email}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--dds-color-text-secondary)' }}>역할</span>
            <span className="text-sm font-medium">
              {roleLabels[user?.role] || user?.role}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="text-sm sm:w-20" style={{ color: 'var(--dds-color-text-secondary)' }}>상태</span>
            <span className="text-sm font-medium">
              {`${user?.is_blacklisted ? '차단됨' : '정상'} (최근로그인 : ${formatLastLogin(user?.last_login_at)})`}
            </span>
          </div>
        </div>
      </div>

      {/* 메인 탭 */}
      <div className="cu-tabbar mb-5">
        <button
          onClick={() => setMainTab('songs')}
          className={`cu-tab ${mainTab === 'songs' ? 'is-active' : ''}`}
        >
          신청 기록
        </button>
        {isMember && (
          <button
            onClick={() => setMainTab('approvals')}
            className={`cu-tab ${mainTab === 'approvals' ? 'is-active' : ''}`}
          >
            전자결재
            {approvals.filter(a => a.status === 'PENDING').length > 0 && (
              <span className="ml-1.5 cu-badge cu-badge-warning">
                {approvals.filter(a => a.status === 'PENDING').length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── 신청 기록 탭 ── */}
      {mainTab === 'songs' && (
        <>
          {/* 필터 */}
          <div className="cu-tabbar mb-4">
            <button onClick={() => setFilter('all')} className={`cu-tab ${filter === 'all' ? 'is-active' : ''}`}>전체</button>
            <button onClick={() => setFilter('wakeup')} className={`cu-tab ${filter === 'wakeup' ? 'is-active' : ''}`}>기상송</button>
            <button onClick={() => setFilter('radio')} className={`cu-tab ${filter === 'radio' ? 'is-active' : ''}`}>점심방송</button>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3">나의 신청 기록</h3>
            {filteredSongs.length === 0 ? (
              <p className="cu-empty text-center py-8">신청 기록이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {filteredSongs.map(song => (
                  <SongCard
                    key={song.id}
                    song={song}
                    actions={
                      <div className="flex flex-wrap justify-end gap-1 sm:flex-col sm:items-end">
                        <span className="cu-badge cu-badge-muted">{typeLabels[song.type]}</span>
                        <span className={`cu-badge ${
                          song.status === 'APPROVED' || song.status === 'PLAYED'
                            ? 'cu-badge-success'
                            : song.status === 'REJECTED'
                            ? 'cu-badge-danger'
                            : 'cu-badge-warning'
                        }`}>
                          {statusLabels[song.status]}
                        </span>
                        {song.status === 'PENDING' && (
                          <button
                            onClick={() => cancelSong(song.id)}
                            disabled={cancellingSongId === song.id}
                            className="cu-btn cu-btn-danger"
                          >
                            {cancellingSongId === song.id ? '취소 중...' : '신청 취소'}
                          </button>
                        )}
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 전자결재 탭 ── */}
      {mainTab === 'approvals' && isMember && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-lg font-semibold">나의 결재 문서</h3>
            <button
              onClick={() => setShowApprovalForm(true)}
              className="cu-btn cu-btn-primary w-full sm:w-auto"
            >
              + 결재 신청
            </button>
          </div>

          {/* 상태 필터 */}
          <div className="cu-tabbar">
            {['all', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
              <button
                key={s}
                onClick={() => setApprovalFilter(s)}
                className={`cu-tab ${approvalFilter === s ? 'is-active' : ''}`}
              >
                {s === 'all' ? '전체' : APPROVAL_STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {filteredApprovals.length === 0 ? (
            <p className="cu-empty text-center py-8">결재 문서가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {filteredApprovals.map((approval) => (
                <div key={approval.id} className="cu-card">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="cu-badge cu-badge-muted text-xs">
                          {APPROVAL_TEMPLATE_LABELS[approval.template]}
                        </span>
                        <span className={`cu-badge text-xs ${APPROVAL_STATUS_BADGE[approval.status]}`}>
                          {APPROVAL_STATUS_LABELS[approval.status]}
                        </span>
                      </div>
                      <p className="font-medium truncate">{approval.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--dds-color-text-secondary)' }}>
                        {new Date(approval.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedApproval(approval)}
                        className="cu-btn cu-btn-muted"
                      >
                        상세
                      </button>
                      {approval.status === 'PENDING' && (
                        <button
                          onClick={() => cancelApproval(approval.id)}
                          disabled={cancellingApprovalId === approval.id}
                          className="cu-btn cu-btn-danger disabled:opacity-50"
                        >
                          {cancellingApprovalId === approval.id ? '취소 중...' : '취소'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
