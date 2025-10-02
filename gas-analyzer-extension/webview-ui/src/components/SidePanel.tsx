// webview/src/SidePanel.tsx
import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface OptimizationSuggestion {
    type: string;
    severity: 'critical' | 'moderate' | 'info';
    message: string;
    gasImpact: number;
    position: any;
}

const SidePanel: React.FC = () => {
    const [optimizations, setOptimizations] = useState<OptimizationSuggestion[]>([]);
    const [totalGasSavings, setTotalGasSavings] = useState(0);

    useEffect(() => {
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'gasDataUpdate':
                    setOptimizations(message.data.optimizations);
                    setTotalGasSavings(message.data.totalSavings);
                    break;
            }
        });
    }, []);

    const applyOptimization = (optimization: OptimizationSuggestion) => {
        // Send message back to extension
        (window as any).vscode.postMessage({
            type: 'applyOptimization',
            optimization
        });
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#ef4444';
            case 'moderate': return '#f59e0b';
            case 'info': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const chartData = {
        labels: ['Critical', 'Moderate', 'Info'],
        datasets: [{
            data: [
                optimizations.filter(o => o.severity === 'critical').length,
                optimizations.filter(o => o.severity === 'moderate').length,
                optimizations.filter(o => o.severity === 'info').length,
            ],
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6']
        }]
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Gas Optimizer</h2>
            
            {/* Summary */}
            <div className="bg-blue-50 p-3 rounded mb-4">
                <h3 className="font-semibold">Potential Savings</h3>
                <p className="text-2xl font-bold text-blue-600">
                    {totalGasSavings.toLocaleString()} gas
                </p>
            </div>

            {/* Chart */}
            <div className="mb-4">
                <h3 className="font-semibold mb-2">Issues Breakdown</h3>
                <div className="w-32 h-32 mx-auto">
                    <Doughnut data={chartData} />
                </div>
            </div>

            {/* Optimization List */}
            <div>
                <h3 className="font-semibold mb-2">Optimizations</h3>
                {optimizations.map((opt, index) => (
                    <div key={index} className="border-l-4 pl-3 mb-3" 
                         style={{ borderColor: getSeverityColor(opt.severity) }}>
                        <p className="font-medium">{opt.message}</p>
                        <p className="text-sm text-gray-600">
                            Saves {opt.gasImpact} gas
                        </p>
                        <button 
                            onClick={() => applyOptimization(opt)}
                            className="mt-1 px-2 py-1 bg-blue-500 text-white text-xs rounded"
                        >
                            Apply Fix
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SidePanel;