import { useRef, useState } from 'react';

const TEMPLATES = [
  { value: 'EQUIPMENT', label: '장비 대여 신청' },
  { value: 'EVENT', label: '행사 지원 요청' },
  { value: 'BUDGET', label: '예산 사용 신청' },
  { value: 'GENERAL', label: '일반 품의' },
];

const TEMPLATE_FIELDS = {
  EQUIPMENT: [
    { key: 'equipmentName', label: '장비명', type: 'text', required: true, placeholder: '예) 캠코더, 마이크 세트' },
    { key: 'startDate', label: '대여 시작일', type: 'date', required: true },
    { key: 'endDate', label: '대여 종료일', type: 'date', required: true },
    { key: 'purpose', label: '사용 목적', type: 'textarea', required: true, placeholder: '장비 사용 목적을 입력해주세요.' },
  ],
  EVENT: [
    { key: 'eventName', label: '행사명', type: 'text', required: true, placeholder: '예) 2026 학교 축제' },
    { key: 'eventDate', label: '행사 일시', type: 'datetime-local', required: true },
    { key: 'location', label: '장소', type: 'text', required: true, placeholder: '예) 본관 강당' },
    { key: 'equipment', label: '필요 장비', type: 'text', required: false, placeholder: '예) 마이크 2개, 앰프 1대' },
    { key: 'personnel', label: '투입 인원', type: 'text', required: false, placeholder: '예) 방송부원 3명' },
    { key: 'detail', label: '상세 내용', type: 'textarea', required: false, placeholder: '추가 요청사항을 입력해주세요.' },
  ],
  BUDGET: [
    { key: 'itemName', label: '항목명', type: 'text', required: true, placeholder: '예) 마이크 구매' },
    { key: 'amount', label: '금액 (원)', type: 'number', required: true, placeholder: '예) 50000' },
    { key: 'purpose', label: '사용 목적', type: 'textarea', required: true, placeholder: '예산 사용 목적을 입력해주세요.' },
    { key: 'vendor', label: '구매처', type: 'text', required: false, placeholder: '예) 쿠팡, 네이버 스토어' },
  ],
  GENERAL: [
    { key: 'detail', label: '내용', type: 'textarea', required: true, placeholder: '요청 내용을 자유롭게 입력해주세요.' },
  ],
};

export default function ApprovalForm({ onSubmit, onCancel, loading }) {
  const [template, setTemplate] = useState('');
  const [title, setTitle] = useState('');
  const [fields, setFields] = useState({});
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  const templateFields = TEMPLATE_FIELDS[template] || [];

  const handleTemplateChange = (value) => {
    setTemplate(value);
    setFields({});
  };

  const handleFieldChange = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length + files.length > 3) {
      alert('첨부 파일은 최대 3개까지 가능합니다.');
      e.target.value = '';
      return;
    }
    const oversized = selected.filter((f) => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      e.target.value = '';
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 필수 항목 검증
    for (const field of templateFields) {
      if (field.required && !fields[field.key]?.toString().trim()) {
        alert(`"${field.label}"을(를) 입력해주세요.`);
        return;
      }
    }

    const formData = new FormData();
    formData.append('template', template);
    formData.append('title', title.trim());
    formData.append('content', JSON.stringify(fields));
    for (const file of files) {
      formData.append('attachments', file);
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 양식 선택 */}
      <div>
        <label className="block text-sm font-medium mb-1">결재 양식 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span></label>
        <select
          value={template}
          onChange={(e) => handleTemplateChange(e.target.value)}
          required
          className="cu-input"
        >
          <option value="">양식을 선택해주세요</option>
          {TEMPLATES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium mb-1">제목 <span style={{ color: 'var(--dds-color-status-error)' }}>*</span></label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={100}
          placeholder="결재 문서 제목을 입력해주세요"
          className="cu-input"
        />
      </div>

      {/* 양식별 동적 필드 */}
      {template && templateFields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium mb-1">
            {field.label}
            {field.required && <span style={{ color: 'var(--dds-color-status-error)' }}> *</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              value={fields[field.key] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
              rows={4}
              className="cu-input resize-y"
            />
          ) : (
            <input
              type={field.type}
              value={fields[field.key] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              required={field.required}
              placeholder={field.placeholder}
              min={field.type === 'number' ? 0 : undefined}
              className="cu-input"
            />
          )}
        </div>
      ))}

      {/* 첨부 파일 */}
      {template && (
        <div>
          <label className="block text-sm font-medium mb-1">
            첨부 파일 <span className="text-xs font-normal" style={{ color: 'var(--dds-color-text-secondary)' }}>(최대 3개, 각 5MB 이하 / JPEG·PNG·GIF·WEBP·PDF)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= 3}
            className="cu-btn cu-btn-muted disabled:opacity-50"
          >
            파일 선택
          </button>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate" style={{ color: 'var(--dds-color-text-secondary)' }}>{f.name}</span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--dds-color-text-secondary)' }}>
                    {(f.size / 1024).toFixed(0)}KB
                  </span>
                  <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-xs cu-btn cu-btn-danger !py-0.5 !px-2">
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          type="submit"
          disabled={!template || !title.trim() || loading}
          className="cu-btn cu-btn-primary flex-1 disabled:opacity-50"
        >
          {loading ? '제출 중...' : '결재 제출'}
        </button>
        <button type="button" onClick={onCancel} className="cu-btn cu-btn-muted flex-1">
          취소
        </button>
      </div>
    </form>
  );
}
