import { useState } from 'react';

export default function RejectModal({ approval, onConfirm, onCancel, loading }) {
  const [comment, setComment] = useState('');

  if (!approval) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    onConfirm(approval.id, comment.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl"
        style={{ background: 'var(--dds-color-bg-normal)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--dds-color-border-normal)' }}>
          <h3 className="text-base font-semibold">결재 반려</h3>
          <p className="text-sm mt-1 truncate" style={{ color: 'var(--dds-color-text-secondary)' }}>
            {approval.title}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              반려 사유 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              maxLength={500}
              rows={4}
              placeholder="반려 사유를 입력해주세요. (필수)"
              className="cu-input resize-none"
              autoFocus
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--dds-color-text-secondary)' }}>
              {comment.length} / 500
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={!comment.trim() || loading}
              className="cu-btn cu-btn-danger flex-1 disabled:opacity-50"
            >
              {loading ? '반려 중...' : '반려 확인'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="cu-btn cu-btn-muted flex-1"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
