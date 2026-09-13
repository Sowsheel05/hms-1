import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, ShieldCheck, Maximize2, X, Info, UtensilsCrossed } from 'lucide-react';

export const STATIC_MESS_QR_PAYLOAD = 'HMS_MESS_ENTRY';
export const STATIC_MESS_ENTRY_POINT = '/mess/verify';

interface StaticMessQrProps {
  payload?: string;
  entryPoint?: string;
  className?: string;
  onOpenModal?: () => void;
}

/**
 * Component to render the permanent static QR entry point for HMS Mess verification.
 * Deterministic and shared across all students, meals, and dates.
 */
export const StaticMessQrCard: React.FC<StaticMessQrProps> = ({
  payload = STATIC_MESS_QR_PAYLOAD,
  entryPoint = STATIC_MESS_ENTRY_POINT,
  className = '',
  onOpenModal,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(payload, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate static Mess QR:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [payload]);

  const handleOpen = () => {
    if (onOpenModal) {
      onOpenModal();
    } else {
      setModalOpen(true);
    }
  };

  return (
    <>
      <div className={`static-mess-qr-card ${className}`}>
        <div className="static-qr-header">
          <div className="static-qr-title-box">
            <div className="static-qr-icon-circle">
              <UtensilsCrossed size={18} />
            </div>
            <div>
              <h3 className="static-qr-title">HMS MESS QR</h3>
              <p className="static-qr-subtitle">Mess Verification Entry Point</p>
            </div>
          </div>
          <span className="static-qr-permanent-badge">
            <ShieldCheck size={13} />
            <span>Permanent QR</span>
          </span>
        </div>

        <div className="static-qr-body">
          <p className="static-qr-instruction">
            Present this QR to authorized hostel staff for mess verification.
          </p>

          <div
            className="static-qr-visual-box"
            onClick={handleOpen}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
            aria-label="Enlarge Mess Verification QR"
            title="Click to enlarge QR"
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Permanent HMS Mess Verification QR Code"
                className="static-qr-image"
                width={160}
                height={160}
              />
            ) : (
              <div className="static-qr-placeholder">
                <QrCode size={48} className="qr-spin-placeholder" />
              </div>
            )}
            <div className="static-qr-overlay-hint">
              <Maximize2 size={14} />
              <span>Tap to Enlarge</span>
            </div>
          </div>

          <div className="static-qr-info-box">
            <Info size={14} className="static-qr-info-icon" />
            <p className="static-qr-info-text">
              Your meal eligibility is verified from your current Mess indent.
            </p>
          </div>
        </div>

        <div className="static-qr-footer">
          <button
            type="button"
            onClick={handleOpen}
            className="btn-view-qr"
            aria-label="View QR in modal"
          >
            <Maximize2 size={15} />
            <span>VIEW QR</span>
          </button>
          <div className="static-qr-entry-tag">
            <span>Entry Point: </span>
            <code>{entryPoint}</code>
          </div>
        </div>
      </div>

      {modalOpen && (
        <StaticMessQrModal
          payload={payload}
          entryPoint={entryPoint}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
};

interface StaticMessQrModalProps {
  payload?: string;
  entryPoint?: string;
  onClose: () => void;
}

/**
 * Mobile-friendly modal displaying the large static QR code
 */
export const StaticMessQrModal: React.FC<StaticMessQrModalProps> = ({
  payload = STATIC_MESS_QR_PAYLOAD,
  onClose,
}) => {
  const [modalQrUrl, setModalQrUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) setModalQrUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate modal QR:', err);
      });

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll when modal is active
    document.body.style.overflow = 'hidden';

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [payload, onClose]);

  return (
    <div className="mess-qr-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
      <div className="mess-qr-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="mess-qr-modal-header">
          <div className="modal-title-group">
            <div className="modal-brand-badge">
              <UtensilsCrossed size={16} />
              <span>HMS MESS</span>
            </div>
            <h3 id="qr-modal-title" className="mess-qr-modal-title">
              Mess Verification QR
            </h3>
          </div>
          <button
            type="button"
            className="mess-qr-close-btn"
            onClick={onClose}
            aria-label="Close QR modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mess-qr-modal-body">
          <p className="mess-qr-modal-lead">
            Present this QR to authorized hostel staff for mess verification.
          </p>

          <div className="mess-qr-stage">
            <div className="mess-qr-frame">
              {modalQrUrl ? (
                <img
                  src={modalQrUrl}
                  alt="HMS Mess Verification QR Code"
                  className="modal-qr-img"
                  width={240}
                  height={240}
                />
              ) : (
                <div className="modal-qr-loading">
                  <QrCode size={64} className="qr-spin-placeholder" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mess-qr-modal-footer">
          <button
            type="button"
            className="btn-qr-modal-close"
            onClick={onClose}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
