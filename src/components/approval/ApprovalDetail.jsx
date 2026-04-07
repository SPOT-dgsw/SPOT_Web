import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

const TEMPLATE_LABELS = {
  EQUIPMENT: '장비 대여 신청',
  EVENT: '행사 지원 요청',
  BUDGET: '예산 사용 신청',
  GENERAL: '일반 품의',
};

const STATUS_LABELS = {
  PENDING: '대기중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
  CANCELLED: '취소됨',
};

const STATUS_BADGE_CLASS = {
  PENDING: 'cu-badge-warning',
  APPROVED: 'cu-badge-success',
  REJECTED: 'cu-badge-danger',
  CANCELLED: 'cu-badge-muted',
};

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function applyInlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderMarkdown(raw) {
  // Escape HTML to prevent XSS, then selectively re-add safe tags
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const lines = escaped.split('\n');
  const html = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3 class="md-h3">${applyInlineMarkdown(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2 class="md-h2">${applyInlineMarkdown(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1 class="md-h1">${applyInlineMarkdown(trimmed.slice(2))}</h1>`);
    } else if (trimmed === '---') {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push('<hr class="md-hr" />');
    } else if (trimmed.startsWith('- ')) {
      if (!inList) { html.push('<ul class="md-ul">'); inList = true; }
      html.push(`<li>${applyInlineMarkdown(trimmed.slice(2))}</li>`);
    } else if (trimmed === '') {
      if (inList) { html.push('</ul>'); inList = false; }
    } else {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<p class="md-p">${applyInlineMarkdown(trimmed)}</p>`);
    }
  }

  if (inList) html.push('</ul>');
  return html.join('');
}

export default function ApprovalDetail({ approval, onClose }) {
  const { showToast } = useToast();

  if (!approval) return null;

  const handleDownload = async (attachmentId, fileName) => {
    const res = await api.get(`/api/approval/attachment/${attachmentId}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-xl overflow-y-auto max-h-[90vh]"
        style={{ background: 'var(--dds-color-bg-normal)' }}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 p-5 border-b" style={{ borderColor: 'var(--dds-color-border-normal)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="cu-badge cu-badge-muted text-xs">{TEMPLATE_LABELS[approval.template] || approval.template}</span>
              <span className={`cu-badge text-xs ${STATUS_BADGE_CLASS[approval.status] || 'cu-badge-muted'}`}>
                {STATUS_LABELS[approval.status] || approval.status}
              </span>
            </div>
            <h3 className="text-base font-semibold truncate">{approval.title}</h3>
          </div>
          <button onClick={onClose} className="cu-btn cu-btn-muted shrink-0">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* 메타 정보 */}
          <div className="cu-subcard p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="w-16 shrink-0" style={{ color: 'var(--dds-color-text-secondary)' }}>기안자</span>
              <span className="font-medium">{approval.user?.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="w-16 shrink-0" style={{ color: 'var(--dds-color-text-secondary)' }}>기안일시</span>
              <span>{formatDateTime(approval.created_at)}</span>
            </div>
            {approval.resolved_at && (
              <div className="flex gap-2">
                <span className="w-16 shrink-0" style={{ color: 'var(--dds-color-text-secondary)' }}>처리일시</span>
                <span>{formatDateTime(approval.resolved_at)}</span>
              </div>
            )}
            {approval.approver && (
              <div className="flex gap-2">
                <span className="w-16 shrink-0" style={{ color: 'var(--dds-color-text-secondary)' }}>결재자</span>
                <span>{approval.approver.name}</span>
              </div>
            )}
          </div>

          {/* 마크다운 내용 */}
          {approval.content && (
            <div>
              <h4 className="text-sm font-semibold mb-2">결재 내용</h4>
              <div
                className="approval-md-body text-sm leading-relaxed p-3 rounded-xl"
                style={{ background: 'var(--dds-color-bg-alternative)' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(approval.content) }}
              />
            </div>
          )}

          {/* 결재자 코멘트 */}
          {approval.approver_comment && (
            <div>
              <h4 className="text-sm font-semibold mb-2">
                {approval.status === 'REJECTED' ? '반려 사유' : '결재자 코멘트'}
              </h4>
              <div
                className="p-3 rounded-xl text-sm whitespace-pre-wrap"
                style={{
                  background: approval.status === 'REJECTED'
                    ? 'var(--dds-color-status-error-soft)'
                    : 'var(--dds-color-bg-alternative)',
                  color: approval.status === 'REJECTED' ? 'var(--dds-color-status-error)' : undefined,
                }}
              >
                {approval.approver_comment}
              </div>
            </div>
          )}

          {/* 첨부 파일 */}
          {approval.attachments?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">첨부 파일</h4>
              <ul className="space-y-1">
                {approval.attachments.map((att) => (
                  <li key={att.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate" style={{ color: 'var(--dds-color-text-secondary)' }}>{att.file_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs" style={{ color: 'var(--dds-color-text-secondary)' }}>
                        {formatBytes(att.file_size)}
                      </span>
                      <button
                        onClick={() => handleDownload(att.id, att.file_name).catch(() => showToast('다운로드에 실패했습니다.', 'error'))}
                        className="cu-btn cu-btn-muted !py-0.5 !px-2 text-xs"
                      >
                        다운로드
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="cu-btn cu-btn-muted w-full">닫기</button>
        </div>
      </div>
    </div>
  );
}
