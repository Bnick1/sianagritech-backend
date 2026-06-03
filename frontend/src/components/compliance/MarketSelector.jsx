import React, { useState } from 'react';

const MarketSelector = ({ onSelect }) => {
  const [selectedMarket, setSelectedMarket] = useState('UK');

  const markets = [
    { id: 'UK', name: 'United Kingdom', flag: '🇬🇧', standards: 'Defra, FSA, Port Health' },
    { id: 'EU', name: 'European Union', flag: '🇪🇺', standards: 'EU General Food Law, RASFF' },
    { id: 'BOTH', name: 'UK & EU', flag: '🌍', standards: 'Combined requirements' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="font-semibold mb-3">Select Target Market</h3>
      <div className="flex gap-4">
        {markets.map(market => (
          <button
            key={market.id}
            onClick={() => {
              setSelectedMarket(market.id);
              onSelect(market.id);
            }}
            className={`flex-1 p-4 rounded-lg border-2 transition ${
              selectedMarket === market.id 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-1">{market.flag}</div>
            <div className="font-medium">{market.name}</div>
            <div className="text-xs text-gray-500 mt-1">{market.standards}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MarketSelector;