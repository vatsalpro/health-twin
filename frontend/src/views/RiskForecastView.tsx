import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, RiskPrediction } from '../api/client';
import {
  AlertTriangle,
  Info,
  Clock,
  RefreshCw,
  AlertCircle,
  Activity,
  Award,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';

export const RiskForecastView: React.FC = () => {
  const { selectedPatientId } = useAuth();
  const [predictions, setPredictions] = useState<RiskPrediction[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<RiskPrediction | null>(null);
  const [evaluationMetrics, setEvaluationMetrics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'FORECAST' | 'SCIENCE'>('FORECAST');
  const [loading, setLoading] = useState<boolean>(true);
  const [recomputing, setRecomputing] = useState<boolean>(false);

  const loadPredictions = async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    try {
      const [preds, metrics] = await Promise.all([
        api.getPredictions(selectedPatientId),
        api.getModelEvaluation(),
      ]);
      setPredictions(preds);
      if (preds.length > 0) {
        setCurrentPrediction(preds[0]);
      }
      setEvaluationMetrics(metrics);
    } catch (err) {
      console.error('Failed to load predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, [selectedPatientId]);

  const handleRecompute = async () => {
    if (!selectedPatientId) return;
    setRecomputing(true);
    try {
      const newPred = await api.recomputePrediction(selectedPatientId);
      setCurrentPrediction(newPred);
      await loadPredictions();
    } catch (err: any) {
      alert(`Error recomputing prediction: ${err.message}`);
    } finally {
      setRecomputing(false);
    }
  };

  const getRiskBadge = (cat?: string) => {
    switch (cat) {
      case 'HIGH':
        return <Badge variant="danger" size="md">HIGH RISK</Badge>;
      case 'MODERATE':
        return <Badge variant="warning" size="md">MODERATE RISK</Badge>;
      case 'LOW':
        return <Badge variant="success" size="md">LOW RISK</Badge>;
      case 'INSUFFICIENT_DATA':
        return <Badge variant="neutral" size="md">INSUFFICIENT DATA</Badge>;
      default:
        return <Badge variant="neutral" size="md">EVALUATING</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        badge="RESEARCH PREDICTION ENGINE"
        title="14-Day Preeclampsia Risk Forecast"
        description="Calibrated multivariable longitudinal research model predicting onset of clinician-confirmed preeclampsia."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveTab('FORECAST')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                  activeTab === 'FORECAST'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Patient Forecast
              </button>
              <button
                onClick={() => setActiveTab('SCIENCE')}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                  activeTab === 'SCIENCE'
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Model Science & Provenance
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRecompute}
              disabled={recomputing}
              isLoading={recomputing}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Recompute
            </Button>
          </div>
        }
      />

      {loading && !predictions.length ? (
        <div className="p-12 text-center text-slate-400">Loading risk predictions...</div>
      ) : activeTab === 'FORECAST' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Risk Quantification Card */}
          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Target Clinical Outcome
                  </span>
                  <CardTitle className="text-lg">Clinician-Confirmed Preeclampsia within 14 Days</CardTitle>
                </div>
                <div>{getRiskBadge(currentPrediction?.risk_category)}</div>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentPrediction?.is_insufficient_data ? (
                  <Alert
                    variant="warning"
                    title="Model Inactive: Insufficient Clinical Data"
                    description={
                      <div>
                        <p>{currentPrediction.insufficient_data_reason}</p>
                        <p className="mt-1 text-slate-600">
                          Gestational age is under the 20.0-week clinical eligibility window or baseline blood pressure observations have not been recorded.
                        </p>
                      </div>
                    }
                  />
                ) : (
                  <div className="space-y-5">
                    {/* Primary score card */}
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-baseline justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-extrabold text-slate-900 font-mono tracking-tight">
                            {currentPrediction?.risk_score !== undefined
                              ? `${(currentPrediction.risk_score * 100).toFixed(1)}%`
                              : 'N/A'}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            calibrated risk
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 block mt-1">
                          Platt-scaled empirical probability
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-slate-500 block">95% Confidence Interval</span>
                        <span className="text-base font-bold text-sky-700 font-mono">
                          [
                          {currentPrediction?.confidence_interval_lower
                            ? (currentPrediction.confidence_interval_lower * 100).toFixed(1)
                            : 0}
                          % —{' '}
                          {currentPrediction?.confidence_interval_upper
                            ? (currentPrediction.confidence_interval_upper * 100).toFixed(1)
                            : 0}
                          %]
                        </span>
                      </div>
                    </div>

                    {/* Contributing Features Waterfall */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Biomarker Contributions (Log-Odds Impact)
                        </h4>
                        <span className="text-xs text-slate-500 font-mono">Additive Shapley Log-Odds</span>
                      </div>
                      
                      <div className="space-y-2">
                        {currentPrediction?.feature_contributions && currentPrediction.feature_contributions.length > 0 ? (
                          currentPrediction.feature_contributions.map((feat, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors"
                            >
                              <div>
                                <span className="font-semibold text-sm text-slate-900">{feat.feature_label}</span>
                                <span className="text-xs text-slate-500 block font-mono">
                                  Variable: {feat.feature_name}
                                </span>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`font-mono font-bold text-sm ${
                                    feat.direction === 'increases_risk'
                                      ? 'text-rose-600'
                                      : feat.direction === 'decreases_risk'
                                      ? 'text-emerald-600'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {feat.contribution > 0 ? `+${feat.contribution}` : feat.contribution}
                                </span>
                                <span className="text-[11px] text-slate-500 block capitalize">
                                  {feat.direction.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                            No individual feature contribution breakdown available for this score.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Model Limitations Notice */}
                <Alert
                  variant="info"
                  title="Clinical Interpretation Notice"
                  description={
                    currentPrediction?.model_limitations ||
                    'Research model intended strictly to support clinical review. Not an autonomous diagnostic device.'
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* Historical Prediction Trajectory */}
          <div className="lg:col-span-5 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <CardTitle className="text-base">Historical Replay Trajectory ({predictions.length})</CardTitle>
                </div>
                <CardDescription>
                  Previous forecasts reconstructing evidence available at that timestamp (zero temporal leakage).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {predictions.map((p) => {
                    const isSelected = currentPrediction?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setCurrentPrediction(p)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/60 shadow-sm'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-medium text-slate-500">
                            {new Date(p.prediction_timestamp).toLocaleDateString()}
                          </span>
                          {getRiskBadge(p.risk_category)}
                        </div>

                        <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-700">
                            Gestational Age: <strong className="text-slate-900">{p.gestational_age_weeks}w</strong>
                          </span>
                          <span className="text-sm font-bold font-mono text-sky-700">
                            {p.risk_score !== undefined ? `${(p.risk_score * 100).toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Tab 2: Model Evaluation & Provenance */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Model Registry & Evaluation Provenance ({evaluationMetrics?.model_version || 'v1.4.2'})
                </CardTitle>
                <CardDescription>
                  Research preeclampsia risk engine parameterized from clinical obstetric risk factors.
                </CardDescription>
              </div>
              <Badge variant="neutral">Horizon: 14 Days</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!evaluationMetrics?.metrics_available ? (
              <Alert
                variant="warning"
                title="Model Performance Validation Pending External Clinical Cohort"
                description={
                  <div className="space-y-4">
                    <p>
                      {evaluationMetrics?.message ||
                        'Model performance has not yet been evaluated on an external longitudinal clinical validation cohort.'}
                    </p>

                    {evaluationMetrics?.validation_requirements && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <div className="p-3 bg-white rounded-lg border border-amber-200">
                          <span className="text-[10px] font-mono uppercase text-amber-800 font-bold block">Cohort Criteria</span>
                          <span className="text-xs text-slate-800 mt-1 block">
                            {evaluationMetrics.validation_requirements.cohort_criteria}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-amber-200">
                          <span className="text-[10px] font-mono uppercase text-amber-800 font-bold block">Sample Threshold</span>
                          <span className="text-xs text-slate-800 mt-1 block">
                            {evaluationMetrics.validation_requirements.minimum_sample_size}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-lg border border-amber-200">
                          <span className="text-[10px] font-mono uppercase text-amber-800 font-bold block">Validation Protocol</span>
                          <span className="text-xs text-slate-800 mt-1 block">
                            {evaluationMetrics.validation_requirements.protocol}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                }
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 uppercase font-mono font-medium">AUROC</span>
                  <p className="text-3xl font-bold font-mono text-slate-900 mt-1">
                    {evaluationMetrics.metrics?.auroc?.toFixed(3)}
                  </p>
                  <span className="text-xs text-emerald-600 font-medium mt-0.5 block">Discrimination</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 uppercase font-mono font-medium">AUPRC</span>
                  <p className="text-3xl font-bold font-mono text-slate-900 mt-1">
                    {evaluationMetrics.metrics?.auprc?.toFixed(3)}
                  </p>
                  <span className="text-xs text-emerald-600 font-medium mt-0.5 block">Precision-Recall</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 uppercase font-mono font-medium">Sensitivity</span>
                  <p className="text-3xl font-bold font-mono text-slate-900 mt-1">
                    {evaluationMetrics.metrics?.sensitivity_at_operating_point
                      ? `${(evaluationMetrics.metrics.sensitivity_at_operating_point * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                  <span className="text-xs text-slate-500 font-medium mt-0.5 block">At operating threshold</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 uppercase font-mono font-medium">Specificity</span>
                  <p className="text-3xl font-bold font-mono text-slate-900 mt-1">
                    {evaluationMetrics.metrics?.specificity_at_operating_point
                      ? `${(evaluationMetrics.metrics.specificity_at_operating_point * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                  <span className="text-xs text-slate-500 font-medium mt-0.5 block">At operating threshold</span>
                </div>
              </div>
            )}

            {/* Provenance Statement */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="font-bold text-slate-900 block font-mono text-xs">DATASET PROVENANCE & LEAKAGE CONTROL</span>
              <p className="text-slate-600 leading-relaxed text-xs">
                {evaluationMetrics?.provenance_statement ||
                  'Features are strictly bounded at the index prediction timestamp to eliminate hindsight bias and temporal leakage.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
