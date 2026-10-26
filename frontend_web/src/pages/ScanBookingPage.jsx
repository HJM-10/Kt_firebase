import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { ScanLine, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Html5QrcodeScanner } from 'html5-qrcode';

const ScanBookingPage = () => {
  const [qrToken, setQrToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: {width: 250, height: 250} },
      false
    );
    scannerRef.current.render((decodedText) => {
      // Auto submit on scan
      let token = decodedText;
      try {
        const parsed = JSON.parse(decodedText);
        if (parsed.token) token = parsed.token;
      } catch(e) {}
      
      setQrToken(token);
      verifyToken(token);
      scannerRef.current.clear();
    }, (error) => {
      // ignore
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error(e));
      }
    };
  }, []);

  const verifyToken = async (token) => {
    if (!token) return;
    
    setLoading(true);
    setScanResult(null);
    try {
      const res = await api.post('/bookings/scan', { qrToken: token });
      setScanResult({ success: true, data: res.data.data });
      toast.success('Booking verified successfully!');
    } catch (err) {
      setScanResult({ success: false, message: err.response?.data?.message || 'Invalid QR Token' });
      toast.error('Scan failed');
    } finally {
      setLoading(false);
      setQrToken('');
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    verifyToken(qrToken);
  };

  return (
    <div>
      <div className="page-header text-center">
        <h1 className="page-title">Scan Booking QR</h1>
        <div className="page-subtitle">Verify customer bookings at the venue</div>
      </div>

      <div className="scan-box" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="card">
          <div id="qr-reader" style={{ width: '100%', marginBottom: 20 }}></div>
          
          <form onSubmit={handleScan} className="flex-col gap-16">
            <input
              type="text"
              className="form-input"
              style={{ textAlign: 'center', fontSize: 18, padding: 16 }}
              placeholder="Or enter QR Token manually..."
              value={qrToken}
              onChange={e => setQrToken(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || !qrToken}>
              {loading ? 'Verifying...' : 'Verify Token'}
            </button>
          </form>
        </div>

        {scanResult && (
          <div className={`scan-result ${scanResult.success ? 'success' : 'error'}`}>
            {scanResult.success ? (
              <>
                <CheckCircle size={48} className="text-success mx-auto mb-16" />
                <h3 className="text-success" style={{ fontSize: 24, marginBottom: 16 }}>Valid Booking!</h3>
                <div className="flex-col gap-8 text-left">
                  <div><strong>Customer:</strong> {scanResult.data.user?.name}</div>
                  <div><strong>Sport:</strong> {scanResult.data.slot?.venue?.sport?.name}</div>
                  <div><strong>Venue:</strong> {scanResult.data.slot?.venue?.name}</div>
                  <div><strong>Time:</strong> {scanResult.data.slot?.startTime} - {scanResult.data.slot?.endTime}</div>
                  <div><strong>Status is now:</strong> SCANNED</div>
                </div>
              </>
            ) : (
              <>
                <XCircle size={48} className="text-danger mx-auto mb-16" />
                <h3 className="text-danger" style={{ fontSize: 24, marginBottom: 8 }}>Invalid QR</h3>
                <p className="text-muted">{scanResult.message}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanBookingPage;
