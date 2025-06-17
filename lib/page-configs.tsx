import { 
  BarChart3, TrendingUp, Activity, Shield, Receipt, 
  DollarSign, Building2, PieChart, Database, 
  AlertTriangle, Zap, FileText, BookOpen, Target
} from 'lucide-react'

export const pageConfigs = {
  finance: {
    title: "Financial Overview Dashboard",
    description: "Get real-time insights into your business's financial health with comprehensive metrics and analytics",
    features: [
      {
        icon: <Shield className="h-6 w-6 text-brand-emerald" />,
        title: "Live Financial Data",
        description: "Real-time sync with your Xero account every 30 minutes"
      },
      {
        icon: <Activity className="h-6 w-6 text-brand-blue" />,
        title: "Health Score Analysis",
        description: "AI-powered financial health scoring and recommendations"
      },
      {
        icon: <BarChart3 className="h-6 w-6 text-purple-400" />,
        title: "Visual Analytics",
        description: "Interactive charts and graphs for better decision making"
      }
    ]
  },
  bookkeeping: {
    title: "Automated Bookkeeping",
    description: "Streamline transaction management, reconciliation, and categorization with AI-powered automation",
    features: [
      {
        icon: <Receipt className="h-6 w-6 text-brand-emerald" />,
        title: "Smart Categorization",
        description: "AI automatically categorizes transactions based on patterns"
      },
      {
        icon: <BookOpen className="h-6 w-6 text-brand-blue" />,
        title: "One-Click Reconciliation",
        description: "Match bank transactions with invoices instantly"
      },
      {
        icon: <Zap className="h-6 w-6 text-yellow-500" />,
        title: "Bulk Operations",
        description: "Process multiple transactions at once to save time"
      }
    ]
  },
  cashflow: {
    title: "Cash Flow Forecasting",
    description: "Get AI-powered 90-day cash flow predictions based on your historical data and payment patterns",
    features: [
      {
        icon: <TrendingUp className="h-6 w-6 text-brand-emerald" />,
        title: "90-Day Predictions",
        description: "AI analyzes payment patterns to forecast your cash position"
      },
      {
        icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
        title: "Early Warning System",
        description: "Get alerts before potential cash shortfalls"
      },
      {
        icon: <Activity className="h-6 w-6 text-brand-blue" />,
        title: "Scenario Planning",
        description: "Model best and worst case scenarios for better planning"
      }
    ]
  },
  analytics: {
    title: "Business Intelligence",
    description: "Deep dive into vendor analytics, spending patterns, and cost optimization opportunities",
    features: [
      {
        icon: <PieChart className="h-6 w-6 text-brand-emerald" />,
        title: "Vendor Analytics",
        description: "Identify your top vendors and spending patterns"
      },
      {
        icon: <Target className="h-6 w-6 text-brand-blue" />,
        title: "Cost Optimization",
        description: "Find opportunities to reduce expenses and improve margins"
      },
      {
        icon: <TrendingUp className="h-6 w-6 text-purple-400" />,
        title: "Trend Analysis",
        description: "Track spending trends and seasonal patterns"
      }
    ]
  },
  database: {
    title: "Database Management",
    description: "Direct access to your financial data with powerful query and export capabilities",
    features: [
      {
        icon: <Database className="h-6 w-6 text-brand-emerald" />,
        title: "Full Data Access",
        description: "Query and explore all your synced financial data"
      },
      {
        icon: <FileText className="h-6 w-6 text-brand-blue" />,
        title: "Custom Reports",
        description: "Build custom reports with SQL queries"
      },
      {
        icon: <DollarSign className="h-6 w-6 text-purple-400" />,
        title: "Data Export",
        description: "Export data in CSV, JSON, or Excel formats"
      }
    ]
  }
}