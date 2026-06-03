import React, { useState } from 'react';
import useWeather from '../hooks/useWeather';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Cloud,
  Sun,
  CloudRain,
  Thermometer,
  Droplets,
  Wind,
  AlertCircle,
  Calendar,
  Sprout,
  CloudSun
} from 'lucide-react';

const WeatherDashboard = ({ farmId }) => {
  const [viewMode, setViewMode] = useState('current'); // 'current', 'forecast', 'historical'
  
  const {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    getWeatherIcon,
    getWeatherDescription,
    formatTemperature,
    getIrrigationRecommendations,
    getPlantingRecommendations,
    getPestRisk,
    getAlerts,
    getConfidenceScore,
    getSourcesUsed,
    currentWeather,
    forecast,
    insights
  } = useWeather(farmId, {
    days: 7,
    autoRefresh: true,
    refreshInterval: 15 * 60 * 1000 // 15 minutes
  });

  if (loading && !data) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3">Loading weather data...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error loading weather data</span>
          </div>
          <p className="mt-2 text-sm text-red-500">{error}</p>
          <Button 
            onClick={refresh}
            variant="outline"
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const irrigationRec = getIrrigationRecommendations();
  const plantingRec = getPlantingRecommendations();
  const pestRisk = getPestRisk();
  const alerts = getAlerts();
  const confidenceScore = getConfidenceScore();
  const sourcesUsed = getSourcesUsed();

  return (
    <div className="space-y-6">
      {/* Header with refresh and view controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Weather Dashboard</h2>
          {lastUpdated && (
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex rounded-md shadow-sm">
            {['current', 'forecast', 'historical'].map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="capitalize"
              >
                {mode}
              </Button>
            ))}
          </div>
          <Button
            onClick={refresh}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Confidence Score & Sources */}
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center">
          <span className="text-gray-600">Confidence:</span>
          <Badge 
            className="ml-2"
            variant={
              confidenceScore >= 80 ? 'default' :
              confidenceScore >= 60 ? 'secondary' : 'outline'
            }
          >
            {confidenceScore}%
          </Badge>
        </div>
        {sourcesUsed.length > 0 && (
          <div className="flex items-center">
            <span className="text-gray-600">Sources:</span>
            <div className="ml-2 flex flex-wrap gap-1">
              {sourcesUsed.map((source) => (
                <Badge key={source} variant="secondary" className="text-xs">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {data?.cached && (
          <Badge variant="outline" className="text-amber-600 border-amber-200">
            Cached Data
          </Badge>
        )}
      </div>

      {/* Current Weather Card */}
      {viewMode === 'current' && currentWeather && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CloudSun className="h-5 w-5 mr-2" />
              Current Weather
            </CardTitle>
            <CardDescription>
              {getWeatherDescription(currentWeather.weathercode)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Thermometer className="h-8 w-8 mx-auto text-blue-600" />
                <div className="mt-2">
                  <div className="text-2xl font-bold">
                    {formatTemperature(currentWeather.temperature)}
                  </div>
                  <div className="text-sm text-gray-500">Temperature</div>
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Droplets className="h-8 w-8 mx-auto text-blue-400" />
                <div className="mt-2">
                  <div className="text-2xl font-bold">
                    {currentWeather.humidity || '--'}%
                  </div>
                  <div className="text-sm text-gray-500">Humidity</div>
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Wind className="h-8 w-8 mx-auto text-green-600" />
                <div className="mt-2">
                  <div className="text-2xl font-bold">
                    {currentWeather.wind_speed || '--'} km/h
                  </div>
                  <div className="text-sm text-gray-500">Wind Speed</div>
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <CloudRain className="h-8 w-8 mx-auto text-blue-800" />
                <div className="mt-2">
                  <div className="text-2xl font-bold">
                    {currentWeather.precipitation || '0'} mm
                  </div>
                  <div className="text-sm text-gray-500">Precipitation</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Card */}
      {viewMode === 'forecast' && forecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              7-Day Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              {forecast.slice(0, 7).map((day, index) => (
                <div 
                  key={index}
                  className="text-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="text-lg font-medium">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-3xl my-2">
                    {getWeatherIcon(day.weatherCode)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-center space-x-2">
                      <span className="text-red-600 font-bold">
                        {formatTemperature(day.temperature_max)}
                      </span>
                      <span className="text-blue-600">
                        {formatTemperature(day.temperature_min)}
                      </span>
                    </div>
                    {day.precipitation_sum > 0 && (
                      <div className="text-sm text-blue-800">
                        💧 {day.precipitation_sum}mm
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              Weather Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-md ${
                    alert.severity === 'high' 
                      ? 'bg-red-100 border border-red-200' 
                      : 'bg-amber-100 border border-amber-200'
                  }`}
                >
                  <div className="flex items-center">
                    <AlertCircle className={`h-4 w-4 mr-2 ${
                      alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'
                    }`} />
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  {alert.action && (
                    <p className="text-sm mt-1 ml-6">{alert.action}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agricultural Insights */}
      {(irrigationRec || plantingRec || pestRisk) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Sprout className="h-5 w-5 mr-2" />
              Agricultural Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Irrigation Recommendations */}
            {irrigationRec && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                  <Droplets className="h-4 w-4 mr-2" />
                  Irrigation Recommendations
                </h4>
                <p className="text-blue-700">{irrigationRec.action}</p>
                {irrigationRec.reason && (
                  <p className="text-sm text-blue-600 mt-1">{irrigationRec.reason}</p>
                )}
                {irrigationRec.nextIrrigation && (
                  <div className="mt-3 p-2 bg-white rounded border">
                    <p className="text-sm font-medium">Next Irrigation:</p>
                    <p className="text-sm">
                      {new Date(irrigationRec.nextIrrigation.date).toLocaleDateString()} at{' '}
                      {irrigationRec.nextIrrigation.optimalTime}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Planting Recommendations */}
            {plantingRec && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <h4 className="font-semibold text-green-800 mb-2">Planting Window</h4>
                <div className="flex items-center">
                  <Badge 
                    variant={plantingRec.optimal ? "default" : "outline"}
                    className={plantingRec.optimal ? "bg-green-600" : "border-amber-300"}
                  >
                    {plantingRec.optimal ? "Optimal" : "Not Optimal"}
                  </Badge>
                  <span className="ml-3">{plantingRec.reason}</span>
                </div>
                {plantingRec.recommendedCrops.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium">Recommended Crops:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plantingRec.recommendedCrops.map((crop, index) => (
                        <Badge key={index} variant="secondary" className="bg-green-100">
                          {crop}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pest Risk Assessment */}
            {pestRisk && (
              <div className={`p-4 rounded-lg border ${
                pestRisk.level === 'high' 
                  ? 'bg-red-50 border-red-100' 
                  : pestRisk.level === 'medium'
                  ? 'bg-amber-50 border-amber-100'
                  : 'bg-green-50 border-green-100'
              }`}>
                <h4 className="font-semibold mb-2">Pest & Disease Risk</h4>
                <div className="flex items-center">
                  <Badge 
                    variant={
                      pestRisk.level === 'high' ? 'destructive' :
                      pestRisk.level === 'medium' ? 'secondary' : 'outline'
                    }
                  >
                    {pestRisk.level.toUpperCase()}
                  </Badge>
                  {pestRisk.factors.length > 0 && (
                    <span className="ml-3 text-sm">
                      Factors: {pestRisk.factors.join(', ')}
                    </span>
                  )}
                </div>
                {pestRisk.recommendations.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium">Recommendations:</p>
                    <ul className="text-sm mt-1 space-y-1">
                      {pestRisk.recommendations.map((rec, index) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Additional Recommendations */}
            {insights?.recommendations?.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Additional Recommendations</h4>
                <ul className="space-y-2">
                  {insights.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start">
                      <div className="h-2 w-2 bg-green-500 rounded-full mt-2 mr-3"></div>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          {data?.farmInfo && (
            <CardFooter className="border-t pt-4 text-sm text-gray-500">
              <div>
                Farm: <span className="font-medium">{data.farmInfo.name}</span>
                {data.farmInfo.cropType && (
                  <span className="ml-4">
                    Current Crop: <span className="font-medium">{data.farmInfo.cropType}</span>
                  </span>
                )}
              </div>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
};

export default WeatherDashboard;