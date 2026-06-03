import React, { useState } from 'react';
import axios from 'axios';

const ExportDashboard = () => {
  const [farmId, setFarmId] = useState('demo-farm-001');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [checklist, setChecklist] = useState([]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:3003/api/compliance/generate-report/${farmId}`,
        { includeGeoData: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setReport(response.data);
      setChecklist(response.data.checklist);
      
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    // In production, this would download the PDF
    window.open(`http://localhost:3003/api/compliance/download/${farmId}`, '_blank');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-green-800 mb-2">🌍 Sian Export-Ready</h1>
      <p className="text-gray-600 mb-6">Generate UK-compliant export readiness reports for your farms</p>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">1. Select Farm</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={farmId}
            onChange={(e) => setFarmId(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Enter Farm ID"
          />
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {report && (
        <>
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">2. Compliance Summary</h2>
              <button
                onClick={downloadReport}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                📥 Download Full Report
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded text-center">
                <div className="text-2xl font-bold text-green-700">{report.complianceScore}%</div>
                <div className="text-sm text-gray-600">Compliance Score</div>
              </div>
              <div className="bg-blue-50 p-4 rounded text-center">
                <div className="text-2xl font-bold text-blue-700">{report.passedItems}/{report.totalItems}</div>
                <div className="text-sm text-gray-600">Requirements Met</div>
              </div>
              <div className="bg-purple-50 p-4 rounded text-center">
                <div className="text-2xl font-bold text-purple-700">{new Date(report.reportGenerated).toLocaleDateString()}</div>
                <div className="text-sm text-gray-600">Report Date</div>
              </div>
            </div>

            <h3 className="font-semibold mb-2">UK Compliance Checklist</h3>
            <div className="space-y-2">
              {checklist.map((item, idx) => (
                <div key={idx} className={`p-3 rounded ${item.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex justify-between">
                    <div>
                      <span className="font-medium">{item.requirement}</span>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm ${item.passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {item.passed ? '✅ PASS' : '❌ FAIL'}
                    </span>
                  </div>
                  {item.notes && <p className="text-sm text-gray-500 mt-1">{item.notes}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Note</h3>
            <p className="text-sm text-yellow-700">
              This is a preliminary assessment based on self-reported data. Final UK import approval requires 
              verification by authorized bodies. Use this report as a preparation tool for export readiness.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportDashboard;