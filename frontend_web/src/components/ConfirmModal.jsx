import React from 'react';
import useDialogFocus from '../services/useDialogFocus';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false, busy = false }) => {
  const dialogRef = useDialogFocus(isOpen, onCancel, busy);
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" disabled={busy} aria-label="Close confirmation" onClick={onCancel}>&times;</button>
        </div>
        <div style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>
          {message}
        </div>
        <div className="modal-actions" style={{ marginTop: '0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>{cancelText}</button>
          <button className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
