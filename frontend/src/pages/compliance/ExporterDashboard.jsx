import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ExporterDashboard = () => {
  const [exporters, setExporters] = useState([]);
  const [selectedExporter, setSelectedExporter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [complianceSummary, setComplianceSummary] = useState(null);
  const navigate = useNavigate();

  // Mock data for demonstration
  const mockExporters = [
    {
      id: 'exp-001',
      companyName: 'Great Lakes Exports Ltd',
      contactPerson: 'James Ochieng',
      country: 'Uganda',
      farmerCount: 24,
      pendingBatches: 3,
      complianceScore: 82,
      ukAgent: 'FreshLink UK',
      lastShipment: '2026-02-15'
    },
    {
      id: 'exp-002',
      companyName: 'East African Growers',
      contactPerson: 'Sarah Akello',
      country: 'Kenya',
      farmerCount: 18,
      pendingBatches: 5,
      complianceScore: 91,
      ukAgent: 'Tropical Imports Ltd',
      lastShipment: '2026-02-20'
    },
    {
      id: 'exp-003',
      companyName: 'Uganda Coffee Cooperative',
      contactPerson: 'Michael Byaruhanga',
      country: 'Uganda',
      farmerCount: 56,
      pendingBatches: 8,
      complianceScore: 67,
      ukAgent: 'London Coffee Roasters',
      lastShipment: '2026-02-10'
    }
  ];

  useEffect(() => {
    // In production, fetch from API
    setExporters(mockExporters);
  }, []);

  const generateBatchReport = async (exporterId, batchId) => {
    setLoading(true);
    try {
      const response = await axios.post(
        `http://localhost:3003/api/compliance/batch-report/${exporterId}/${batchId}`,
        { 
          includeGeoData: true,
          market: 'UK' 
        }
      );
      
      // Trigger download
      window.open(`http://localhost:3003/api/compliance/download-batch/${response.data.reportId}`, '_blank');
      
    } catch (error) {
      console.error('Failed to generate batch report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const viewExporterDetails = (exporter) => {
    setSelectedExporter(exporter);
    // Calculate compliance summary
    const summary = {
      totalFarmers: exporter.farmerCount,
      compliantFarmers: Math.floor(exporter.farmerCount * (exporter.complianceScore / 100)),
      pendingActions: exporter.pendingBatches,
      ukAgent: exporter.ukAgent,
      readiness: exporter.complianceScore > 80 ? 'High' : exporter.complianceScore > 60 ? 'Medium' : 'Low'
    };
    setComplianceSummary(summary);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with UK/EU Focus */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-lg mb-8">
        <h1 className="text-3xl font-bold">🌍 Sian Export-Ready</h1>
        <p className="text-xl mt-2">UK & EU Compliance Platform for African Exporters</p>
        <div className="flex gap-4 mt-4">
          <span className="bg-white text-blue-600 px-3 py-1 rounded-full text-sm">🇬🇧 UK Ready</span>
          <span className="bg-white text-green-600 px-3 py-1 rounded-full text-sm">🇪🇺 EU Compliant</span>
        </div>
      </div>

      {/* Exporter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {exporters.map(exporter => (
          <div 
            key={exporter.id}
            onClick={() => viewExporterDetails(exporter)}
            className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedExporter?.id === exporter.id ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg">{exporter.companyName}</h3>
              <span className={`px-2 py-1 rounded-full text-xs ${
                exporter.complianceScore > 80 ? 'bg-green-100 text-green-800' :
                exporter.complianceScore > 60 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {exporter.complianceScore}% Compliant
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-2">Contact: {exporter.contactPerson}</p>
            <p className="text-gray-600 text-sm mb-3">Country: {exporter.country}</p>
            
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="bg-gray-50 p-2 rounded text-center">
                <span className="font-bold block">{exporter.farmerCount}</span>
                <span className="text-xs text-gray-500">Farmers</span>
              </div>
              <div className="bg-gray-50 p-2 rounded text-center">
                <span className="font-bold block">{exporter.pendingBatches}</span>
                <span className="text-xs text-gray-500">Pending</span>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 border-t pt-2">
              🇬🇧 UK Agent: {exporter.ukAgent}<br/>
              Last Shipment: {exporter.lastShipment}
            </div>
          </div>
        ))}
      </div>

      {/* Exporter Details Panel */}
      {selectedExporter && complianceSummary && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">{selectedExporter.companyName} - Compliance Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{complianceSummary.compliantFarmers}</div>
              <div className="text-sm text-gray-600">Compliant Farmers</div>
              <div className="text-xs text-gray-500">out of {complianceSummary.totalFarmers} total</div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{complianceSummary.pendingActions}</div>
              <div className="text-sm text-gray-600">Pending Batches</div>
              <div className="text-xs text-gray-500">Ready for UK export</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{complianceSummary.readiness}</div>
              <div className="text-sm text-gray-600">Export Readiness</div>
              <div className="text-xs text-gray-500">Based on compliance score</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => generateBatchReport(selectedExporter.id, 'batch-001')}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex-1"
            >
              {loading ? 'Generating...' : '📄 Generate UK Export Report'}
            </button>
            
            <button
              onClick={() => navigate(`/compliance/farmers/${selectedExporter.id}`)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex-1"
            >
              🌱 Manage Farmers
            </button>
          </div>

          {/* UK/EU Market Info */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">🇬🇧 UK/EU Export Requirements</h3>
            <p className="text-sm text-blue-700">
              Your compliance score is based on UK import standards (Defra, FSA) and EU general food law.
              Download a batch report to share with your UK agent or importer.
            </p>
          </div>
        </div>
      )}

      {/* Call to Action - New Exporter */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6 text-center">
        <h3 className="text-xl font-bold mb-2">Are you an exporter?</h3>
        <p className="text-gray-600 mb-4">Get your farms UK-ready in minutes, not weeks</p>
        <button className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700">
          Register Your Export Business
        </button>
      </div>
    </div>
  );
};

export default ExporterDashboard;