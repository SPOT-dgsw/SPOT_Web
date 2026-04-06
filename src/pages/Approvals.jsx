import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import ApprovalForm from '../components/approval/ApprovalForm';
import ApprovalDetail from '../components/approval/ApprovalDetail';
import { Navigate } from 'react-router-dom';

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

export default function Approvals() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [cancellingApprovalId, setCancellingApprovalId] = useState(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const isMember = user?.role === 'MEMBER' || user?.role === 'LEADER';

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

  return (
    <div className="cu-page">
      <h2 className="cu-title mb-5">전자결재</h2>

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

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm" style={{ color: 'var(--dds-color-text-secondary)' }}>
            나의 결재 문서 목록입니다.
          </p>
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
    </div>
  );
}
