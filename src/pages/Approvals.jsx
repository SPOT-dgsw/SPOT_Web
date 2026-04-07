import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import ApprovalDetail from '../components/approval/ApprovalDetail';
import RejectModal from '../components/approval/RejectModal';
import { Navigate, useNavigate } from 'react-router-dom';

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

// ─── LEADER: 결재 관리 ────────────────────────────────────────────────────────

function ApprovalManagement() {
  const { showToast } = useToast();
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

  const loadPending = useCallback(async () => {
    try {
      const res = await api.get('/api/approval/admin/pending', { params: { pageSize: 50 } });
      setPendingApprovals(res.data.approvals || []);
    } catch { /* silent */ }
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
    } catch { /* silent */ }
  }, [historyPage, historyQuery, historyStatus, historyTemplate]);

  useEffect(() => { loadPending(); }, [loadPending]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleApprove = async (id) => {
    if (!confirm('이 결재를 승인하시겠습니까?')) return;
    setProcessing(id);
    try {
      await api.patch(`/api/approval/admin/${id}/approve`);
      showToast('결재가 승인되었습니다.', 'success');
      await Promise.all([loadPending(), loadHistory()]);
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
      await Promise.all([loadPending(), loadHistory()]);
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
      await Promise.all([loadPending(), loadHistory()]);
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
                        <span className="cu-badge cu-badge-muted text-xs">{APPROVAL_TEMPLATE_LABELS[approval.template]}</span>
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
            <button onClick={handleHistorySearch} className="cu-btn cu-btn-primary sm:w-auto">검색</button>
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
                        <span className="cu-badge cu-badge-muted text-xs">{APPROVAL_TEMPLATE_LABELS[approval.template]}</span>
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

      {selectedApproval && (
        <ApprovalDetail approval={selectedApproval} onClose={() => setSelectedApproval(null)} />
      )}
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

// ─── MEMBER/LEADER: 내 결재 목록 ──────────────────────────────────────────────

export default function Approvals() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isLeader = user?.role === 'LEADER';
  const isMember = user?.role === 'MEMBER' || user?.role === 'LEADER';

  const [mainTab, setMainTab] = useState(isLeader ? 'manage' : 'my');
  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [cancellingApprovalId, setCancellingApprovalId] = useState(null);
  const approvalNavigate = useNavigate();

  useEffect(() => {
    if (isMember) {
      api.get('/api/approval/my', { params: { pageSize: 50 } })
        .then(r => setApprovals(r.data.approvals || []));
    }
  }, [isMember]);

  const filteredApprovals = useMemo(() => {
    if (approvalFilter === 'all') return approvals;
    return approvals.filter(a => a.status === approvalFilter);
  }, [approvals, approvalFilter]);

  if (!isMember) return <Navigate to="/" replace />;

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

  return (
    <div className="cu-page">
      <h2 className="cu-title mb-5">전자결재</h2>

      {/* 결재 상세 모달 (내 문서) */}
      {selectedApproval && (
        <ApprovalDetail
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
        />
      )}

      {/* LEADER: 탭 전환 */}
      {isLeader && (
        <div className="cu-tabbar mb-5">
          <button
            onClick={() => setMainTab('manage')}
            className={`cu-tab ${mainTab === 'manage' ? 'is-active' : ''}`}
          >
            결재 관리
          </button>
          <button
            onClick={() => setMainTab('my')}
            className={`cu-tab ${mainTab === 'my' ? 'is-active' : ''}`}
          >
            내 문서
          </button>
        </div>
      )}

      {/* LEADER: 결재 관리 */}
      {isLeader && mainTab === 'manage' && <ApprovalManagement />}

      {/* MEMBER/LEADER: 내 결재 목록 */}
      {mainTab === 'my' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm" style={{ color: 'var(--dds-color-text-secondary)' }}>
              나의 결재 문서 목록입니다.
            </p>
            <button
              onClick={() => approvalNavigate('/approvals/new')}
              className="cu-btn cu-btn-primary w-full sm:w-auto"
            >
              + 결재 신청
            </button>
          </div>

          <div className="cu-tabbar">
            {['all', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
              <button
                key={s}
                onClick={() => setApprovalFilter(s)}
                className={`cu-tab ${approvalFilter === s ? 'is-active' : ''}`}
              >
                {s === 'all' ? '전체' : APPROVAL_STATUS_LABELS[s]}
                {s === 'PENDING' && approvals.filter(a => a.status === 'PENDING').length > 0 && (
                  <span className="ml-1.5 cu-badge cu-badge-warning">
                    {approvals.filter(a => a.status === 'PENDING').length}
                  </span>
                )}
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
