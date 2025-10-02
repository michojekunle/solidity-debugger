export type GasPattern = {
    name: string;
    pattern: RegExp;
    gasImpact: number;
    severity: 'critical' | 'moderate' | 'low';
    description: string;
};

export type QuickFix = {
    title: string;
    edit: string;
};

export type OptimizationSuggestion = {
    type: string;
    severity: 'critical' | 'moderate' | 'low';
    message: string;
    gasImpact: number;
    position: any; // Can be improved if AST node location type is known
    quickFix?: QuickFix;
};