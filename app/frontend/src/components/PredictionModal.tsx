import { useState } from 'react';
import { BarChart3, CalendarClock, Database, LoaderCircle, ShieldCheck } from 'lucide-react';
import { api, type Prediction } from '../api';
import { toLocalInput } from '../lib';
import type { Station } from '../types';
import { Modal } from './Modal';

export function PredictionModal({ station, onClose }: { station: Station; onClose: () => void }) {
  const [arrival, setArrival] = useState(toLocalInput());
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const predict = async () => {
    setLoading(true); setError('');
    try { setPrediction(await api.getPrediction(station.id, new Date(arrival).toISOString())); }
    catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Predict availability" subtitle={station.name} onClose={onClose}>
      <div className="prediction-form">
        <label>When do you plan to arrive?<input type="datetime-local" value={arrival} min={toLocalInput(new Date())} onChange={(event) => setArrival(event.target.value)} /></label>
        <button className="button primary" onClick={predict} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <BarChart3 size={17} />} Generate prediction</button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {prediction && prediction.status === 'prediction_available' && (
        <div className="prediction-result">
          <div className="probability-visual" style={{ '--probability': `${prediction.probability}%` } as React.CSSProperties}>
            <div><b>{prediction.probability}%</b><span>likely available</span></div>
          </div>
          <div className="prediction-copy"><span className="confidence"><ShieldCheck size={16} /> {prediction.confidence} confidence</span><h3>{prediction.message}</h3><p>This is an estimate, not a guarantee. Live conditions may change before arrival.</p></div>
          <div className="evidence-grid"><span><Database size={17} /><b>{prediction.sampleSize}</b><small>similar observations</small></span><span><CalendarClock size={17} /><b>± 1 hour</b><small>comparison window</small></span></div>
          <p className="method-note">Method: {prediction.methodology}</p>
        </div>
      )}
      {prediction && prediction.status !== 'prediction_available' && <div className="empty-state compact"><Database size={28} /><h3>Not enough data</h3><p>{prediction.message} ({prediction.sampleSize} matching samples)</p></div>}
    </Modal>
  );
}
