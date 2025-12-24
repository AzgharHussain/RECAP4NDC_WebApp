import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Modal,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip as MuiTooltip,
  Badge,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Visibility,
  Image as ImageIcon,
  Note,
  Close,
  ZoomIn,
  Download,
  CalendarMonth,
  Forest,
  Warning,
  CheckCircle,
  Info,
  BarChart,
  PieChart,
  ShowChart,
  Map,
  Calculate,
  PictureAsPdf,
  InsertDriveFile,
  Sort
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { API_BASE_URL } from '../config';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const NDVIChangeDashboard = () => {
  // State management
  const [selectedCoupe, setSelectedCoupe] = useState('Bhavnagar_coupes');
  const [selectedMonth, setSelectedMonth] = useState('2025-02');
  const [monthlyData, setMonthlyData] = useState({});
  const [currentTableData, setCurrentTableData] = useState([]);
  const [sortedData, setSortedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingArea, setLoadingArea] = useState(false);
  const [loadingNDVIArea, setLoadingNDVIArea] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [totalArea, setTotalArea] = useState(0);
  const [degradedArea, setDegradedArea] = useState(0);
  const [summaryStats, setSummaryStats] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [chartType, setChartType] = useState('bar');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithNotes, setShowOnlyWithNotes] = useState(false);
  const [showOnlyWithImages, setShowOnlyWithImages] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'pixle_id', direction: 'asc' });

  // Configuration
  const coupeOptions = [
    { value: 'Banaskantha_RWD_WC_final', label: 'Banaskantha RWD WC' },
    { value: 'Banaskantha_Wild Life_WC', label: 'Banaskantha Wildlife WC' },
    { value: 'Banaskantha_Con_Cum_Imp_WC_OVLP', label: 'Banaskantha Con Cum Imp' },
    { value: 'Bhavnagar_coupes', label: 'Bhavnagar Coupes' },
    { value: 'Sabarkantha_North_Aravalli', label: 'Sabarkantha North Aravalli' }
  ];

  const monthOptions = [
    { value: '2025-01', label: 'January 2025' },
    { value: '2025-02', label: 'February 2025' },
    { value: '2025-03', label: 'March 2025' },
    { value: '2025-04', label: 'April 2025' },
    { value: '2025-05', label: 'May 2025' },
    { value: '2025-06', label: 'June 2025' },
    { value: '2025-07', label: 'July 2025' },
    { value: '2025-08', label: 'August 2025' },
    { value: '2025-09', label: 'September 2025' },
    { value: '2025-10', label: 'October 2025' }
  ];

  // Fetch total area for selected coupe
  const fetchTotalArea = async (coupeName) => {
    setLoadingArea(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/get-coupe-area`, {
        tableName: coupeName
      });
      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km || 0;
        setTotalArea(parseFloat(area));
      }
    } catch (err) {
      console.error('Error fetching area:', err);
      setError('Failed to fetch area data');
    } finally {
      setLoadingArea(false);
    }
  };

  // Fetch NDVI degraded area for specific month
  const fetchNDVIDegradedArea = async (coupeName, month) => {
    setLoadingNDVIArea(true);
    try {
      const tableName = `${month}-01_${coupeName}_NDVI_Change`;
      const response = await axios.post(`${API_BASE_URL}/api/ndvi-change-area`, {
        tableName
      });
      
      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km || 0;
        setDegradedArea(parseFloat(area));
        return parseFloat(area);
      }
      return 0;
    } catch (err) {
      console.error('Error fetching NDVI degraded area:', err);
      setError('Failed to fetch degraded area data');
      return 0;
    } finally {
      setLoadingNDVIArea(false);
    }
  };

  // Fetch NDVI change data for specific month
  const fetchNDVIData = async (coupeName, month) => {
    setLoading(true);
    setError(null);
    
    try {
      const tableName = `${month}-01_${coupeName}_NDVI_Change`;
      
      // Fetch both data and degraded area in parallel
      const [dataResponse, degradedAreaValue] = await Promise.all([
        axios.post(`${API_BASE_URL}/api/ndvi-change-get`, { tableName }),
        fetchNDVIDegradedArea(coupeName, month)
      ]);

      if (dataResponse.data.success) {
        const data = dataResponse.data.data;
        const degradedPolygons = data.length;
        
        // Calculate afforested area = total area - degraded area
        const afforestedArea = totalArea - degradedAreaValue;
        
        // Calculate area per polygon for degraded area
        const degradedAreaPerPolygon = degradedPolygons > 0 ? degradedAreaValue / degradedPolygons : 0;
        
        // Enhance data with area information
        const enhancedData = data.map(item => ({
          ...item,
          area_sq_km: degradedAreaPerPolygon,
          month: month,
          status: item.status || true, // Use actual status from database
          change_category: item.change_category || 'Degradation',
          has_note: !!(item.note && item.note.trim() !== ''),
          has_image: !!(item.image_data),
          pixle_id: item.pixle_id || item.Pixle_id // Handle both naming conventions
        }));
        
        setCurrentTableData(enhancedData);
        sortData(enhancedData, sortConfig.key, sortConfig.direction);
        
        // Calculate statistics with actual area calculations
        const stats = calculateStatistics(enhancedData, totalArea, degradedAreaValue, afforestedArea);
        setSummaryStats(stats);
        
        // Update monthly data tracking
        setMonthlyData(prev => ({
          ...prev,
          [month]: {
            data: enhancedData,
            stats,
            month: month,
            degradedArea: degradedAreaValue,
            afforestedArea: afforestedArea
          }
        }));
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to fetch NDVI data';
      setError(errorMsg);
      console.error('Error fetching NDVI data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics from data
  const calculateStatistics = (data, totalCoupeArea, degradedAreaValue, afforestedAreaValue) => {
    if (!data || data.length === 0) return null;

    const degraded = data.filter(item => item.status === true).length;
    const afforested = data.filter(item => item.status === false).length;
    const withNotes = data.filter(item => item.has_note).length;
    const withImages = data.filter(item => item.has_image).length;
    
    const totalCoupeAreaKm = totalCoupeArea;
    const degradedAreaKm = degradedAreaValue;
    const afforestedAreaKm = afforestedAreaValue;
    
    return {
      degraded,
      afforested,
      withNotes,
      withImages,
      degradedArea: degradedAreaKm,
      afforestedArea: afforestedAreaKm,
      totalArea: totalCoupeAreaKm,
      totalPolygons: degraded + afforested,
      degradedPercentage: (degradedAreaKm / totalCoupeAreaKm) * 100,
      afforestedPercentage: (afforestedAreaKm / totalCoupeAreaKm) * 100,
      degradedAreaPercentage: (degradedAreaKm / totalCoupeAreaKm) * 100,
      afforestedAreaPercentage: (afforestedAreaKm / totalCoupeAreaKm) * 100
    };
  };

  // Fetch record details by ID
  const fetchRecordDetails = async (id) => {
    try {
      const tableName = `${selectedMonth}-01_${selectedCoupe}_NDVI_Change`;
      const response = await axios.get(`${API_BASE_URL}/api/ndvi-change/${id}?tableName=${tableName}`);
      
      if (response.data.success) {
        setSelectedRecord(response.data.data[0]); // Access first element of array
        setModalOpen(true);
      }
      
    } catch (err) {
      console.error('Error fetching record details:', err);
      setError('Failed to fetch record details');
    }
  };

  // Sort data
  const sortData = (data, key, direction) => {
    const sorted = [...data].sort((a, b) => {
      // Special sorting for has_note and has_image (show true first)
      if (key === 'has_note' || key === 'has_image') {
        if (a[key] === b[key]) return 0;
        if (direction === 'desc') {
          return a[key] ? -1 : 1;
        } else {
          return a[key] ? 1 : -1;
        }
      }
      
      // Regular sorting for other fields
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setSortedData(sorted);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    sortData(filteredData, key, direction);
  };

  // Handle coupe selection
  const handleCoupeChange = (event) => {
    const newCoupe = event.target.value;
    setSelectedCoupe(newCoupe);
    setMonthlyData({});
    fetchTotalArea(newCoupe);
    setTimeout(() => fetchNDVIData(newCoupe, selectedMonth), 100);
  };

  // Handle month selection
  const handleMonthChange = (event) => {
    const newMonth = event.target.value;
    setSelectedMonth(newMonth);
    
    if (monthlyData[newMonth]) {
      setCurrentTableData(monthlyData[newMonth].data);
      sortData(monthlyData[newMonth].data, sortConfig.key, sortConfig.direction);
      setSummaryStats(monthlyData[newMonth].stats);
    } else {
      fetchNDVIData(selectedCoupe, newMonth);
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Filter and sort data
  const filteredData = React.useMemo(() => {
    let filtered = currentTableData.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (item.pixle_id?.toString().includes(searchLower)) ||
        (item.status?.toString().toLowerCase().includes(searchLower)) ||
        (item.note?.toLowerCase().includes(searchLower)) ||
        (item.latitude?.toString().includes(searchLower)) ||
        (item.longitude?.toString().includes(searchLower)) ||
        (item.change_category?.toLowerCase().includes(searchLower));

      const matchesNotes = !showOnlyWithNotes || item.has_note;
      const matchesImages = !showOnlyWithImages || item.has_image;

      return matchesSearch && matchesNotes && matchesImages;
    });

    // Apply sorting
    return [...filtered].sort((a, b) => {
      if (sortConfig.key === 'has_note' || sortConfig.key === 'has_image') {
        if (a[sortConfig.key] === b[sortConfig.key]) return 0;
        if (sortConfig.direction === 'desc') {
          return a[sortConfig.key] ? -1 : 1;
        } else {
          return a[sortConfig.key] ? 1 : -1;
        }
      }
      
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [currentTableData, searchTerm, showOnlyWithNotes, showOnlyWithImages, sortConfig]);

  // Initialize on component mount
  useEffect(() => {
    fetchTotalArea(selectedCoupe);
  }, []);

  useEffect(() => {
    if (totalArea > 0) {
      fetchNDVIData(selectedCoupe, selectedMonth);
    }
  }, [totalArea]);

  // Prepare chart data
 const prepareMonthlyChartData = () => {
  const months = monthOptions.map(m => m.value);
  const monthLabels = monthOptions.map(m => m.label.split(' ')[0]);
  
  // Use AREA data instead of polygon count
  const degradedAreaData = months.map(month => 
    monthlyData[month]?.stats?.degradedArea || 0
  );
  const afforestedAreaData = months.map(month => 
    monthlyData[month]?.stats?.afforestedArea || 0
  );

  return {
    labels: monthLabels,
    datasets: [
      {
        label: 'Degraded Area (sq km)',
        data: degradedAreaData,
        backgroundColor: 'rgba(239, 68, 68, 0.7)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 2
      },
      {
        label: 'Afforested Area (sq km)',
        data: afforestedAreaData,
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 2
      }
    ]
  };
};

  const prepareAreaChartData = () => {
    const months = monthOptions.map(m => m.value);
    const monthLabels = monthOptions.map(m => m.label.split(' ')[0]);
    
    const degradedAreaData = months.map(month => 
      monthlyData[month]?.stats?.degradedArea || 0
    );
    const afforestedAreaData = months.map(month => 
      monthlyData[month]?.stats?.afforestedArea || 0
    );

    return {
      labels: monthLabels,
      datasets: [
        {
          label: 'Degraded Area (sq km)',
          data: degradedAreaData,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Afforested Area (sq km)',
          data: afforestedAreaData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  };

  const preparePieChartData = () => {
    if (!summaryStats) return null;
    
    return {
      labels: ['Degraded Area', 'Afforested Area'],
      datasets: [{
        data: [summaryStats.degradedAreaPercentage, summaryStats.afforestedAreaPercentage],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(34, 197, 94, 0.8)'
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(34, 197, 94, 1)'
        ],
        borderWidth: 2,
        hoverOffset: 15
      }]
    };
  };

  const preparePolygonPieChartData = () => {
    if (!summaryStats) return null;
    
    return {
      labels: ['Degraded Polygons', 'Afforested Polygons'],
      datasets: [{
        data: [summaryStats.degraded, summaryStats.afforested],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(34, 197, 94, 0.8)'
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(34, 197, 94, 1)'
        ],
        borderWidth: 2,
        hoverOffset: 15
      }]
    };
  };

  // Chart options
 const barChartOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'Monthly NDVI Change - Area Analysis'
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          label += context.parsed.y.toFixed(2) + ' sq km';
          return label;
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Area (Square Kilometers)'
      }
    }
  }
};

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly Area Change Trend'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += context.parsed.y.toFixed(2) + ' sq km';
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Area (Square Kilometers)'
        }
      }
    }
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Area Distribution'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${value.toFixed(1)}%`;
          }
        }
      }
    }
  };

  // Render different charts based on selection
  const renderChart = () => {
    switch(chartType) {
      case 'bar':
        return <Bar data={prepareMonthlyChartData()} options={barChartOptions} />;
      case 'line':
        return <Line data={prepareAreaChartData()} options={lineChartOptions} />;
      case 'pie':
        return <Pie data={preparePieChartData()} options={pieChartOptions} />;
      case 'polygon-pie':
        return <Pie data={preparePolygonPieChartData()} options={pieChartOptions} />;
      default:
        return <Bar data={prepareMonthlyChartData()} options={barChartOptions} />;
    }
  };

  // Export to Excel
  const handleExportToExcel = () => {
    const exportData = filteredData.map(item => ({
      'Pixel ID': item.pixle_id || 'N/A',
      'Status': item.status ? 'Degraded' : 'Afforested',
      'Change Category': item.change_category || 'N/A',
      'NDVI Change': item.ndvi_change || 0,
      'January NDVI': item.january_ndvi || 'N/A',
      'February NDVI': item.february_ndvi || 'N/A',
      'Latitude': item.latitude || 'N/A',
      'Longitude': item.longitude || 'N/A',
      'Area (sq km)': item.area_sq_km?.toFixed(6) || 'N/A',
      'Has Note': item.has_note ? 'Yes' : 'No',
      'Note': item.note || '',
      'Has Image': item.has_image ? 'Yes' : 'No',
      'Notification Sent': item.notification_sent ? 'Yes' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NDVI Data');
    
    // Auto-size columns
    const wscols = [
      { wch: 10 }, // Pixel ID
      { wch: 12 }, // Status
      { wch: 15 }, // Change Category
      { wch: 12 }, // NDVI Change
      { wch: 12 }, // January NDVI
      { wch: 12 }, // February NDVI
      { wch: 15 }, // Latitude
      { wch: 15 }, // Longitude
      { wch: 12 }, // Area
      { wch: 10 }, // Has Note
      { wch: 30 }, // Note
      { wch: 10 }, // Has Image
      { wch: 15 }, // Notification Sent
    ];
    ws['!cols'] = wscols;

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `${selectedCoupe}_${selectedMonth}_NDVI_Data.xlsx`);
  };

  // Export to PDF (simplified version)
  const handleExportToPDF = () => {
    const docDefinition = {
      content: [
        { text: 'NDVI Change Analysis Report', style: 'header' },
        { text: `Coupe: ${selectedCoupe}`, style: 'subheader' },
        { text: `Month: ${selectedMonth}`, style: 'subheader' },
        { text: `Generated: ${new Date().toLocaleString()}`, style: 'subheader' },
        { text: '\nSummary Statistics:', style: 'section' },
        ...(summaryStats ? [
          `Total Area: ${totalArea.toFixed(2)} sq km`,
          `Degraded Area: ${summaryStats.degradedArea.toFixed(2)} sq km (${summaryStats.degradedAreaPercentage.toFixed(1)}%)`,
          `Afforested Area: ${summaryStats.afforestedArea.toFixed(2)} sq km (${summaryStats.afforestedAreaPercentage.toFixed(1)}%)`,
         
      
          `Records with Notes: ${summaryStats.withNotes}`,
          `Records with Images: ${summaryStats.withImages}`
        ].map(text => ({ text, margin: [0, 2, 0, 2] })) : []),
        { text: '\nData Sample (first 10 records):', style: 'section' }
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 12, margin: [0, 0, 0, 5] },
        section: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
      }
    };

    // Create a simple HTML version for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>NDVI Report - ${selectedCoupe} - ${selectedMonth}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #2c3e50; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>NDVI Change Analysis Report</h1>
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Coupe:</strong> ${selectedCoupe}</p>
            <p><strong>Month:</strong> ${selectedMonth}</p>
            <p><strong>Total Area:</strong> ${totalArea.toFixed(2)} sq km</p>
            ${summaryStats ? `
              <p><strong>Degraded Area:</strong> ${summaryStats.degradedArea.toFixed(2)} sq km (${summaryStats.degradedAreaPercentage.toFixed(1)}%)</p>
              <p><strong>Afforested Area:</strong> ${summaryStats.afforestedArea.toFixed(2)} sq km (${summaryStats.afforestedAreaPercentage.toFixed(1)}%)</p>
             
            ` : ''}
          </div>
          <h3>Data Sample</h3>
          <table>
            <thead>
              <tr>
                <th>Pixel ID</th>
                <th>Status</th>
                <th>NDVI Change</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Has Note</th>
                <th>Has Image</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.slice(0, 10).map(item => `
                <tr>
                  <td>${item.pixle_id || 'N/A'}</td>
                  <td>${item.status ? 'Degraded' : 'Afforested'}</td>
                  <td>${item.ndvi_change?.toFixed(3) || 'N/A'}</td>
                  <td>${item.latitude?.toFixed(6) || 'N/A'}</td>
                  <td>${item.longitude?.toFixed(6) || 'N/A'}</td>
                  <td>${item.has_note ? 'Yes' : 'No'}</td>
                  <td>${item.has_image ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            Generated on ${new Date().toLocaleString()}
          </p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Card sx={{ mb: 3, bgcolor: 'primary.main', color: 'white' }}>
        <CardContent>
          <Grid container alignItems="center" spacing={2}>
            <Grid item>
              <Forest sx={{ fontSize: 40 }} />
            </Grid>
            <Grid item xs>
              <Typography variant="h4" gutterBottom>
                Forest Cover Change Monitoring System
              </Typography>
              <Typography variant="subtitle1">
                NDVI Change Analysis Dashboard
              </Typography>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<InsertDriveFile />}
                onClick={handleExportToExcel}
                sx={{ mr: 1 }}
              >
                Export Excel
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<PictureAsPdf />}
                onClick={handleExportToPDF}
              >
                Export PDF
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Controls Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Select Forest Coupe</InputLabel>
                <Select
                  value={selectedCoupe}
                  label="Select Forest Coupe"
                  onChange={handleCoupeChange}
                  startAdornment={<Forest sx={{ mr: 1 }} />}
                >
                  {coupeOptions.map(coupe => (
                    <MenuItem key={coupe.value} value={coupe.value}>
                      {coupe.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Select Month</InputLabel>
                <Select
                  value={selectedMonth}
                  label="Select Month"
                  onChange={handleMonthChange}
                  startAdornment={<CalendarMonth sx={{ mr: 1 }} />}
                >
                  {monthOptions.map(month => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={chartType === 'bar' ? 'contained' : 'outlined'}
                  onClick={() => setChartType('bar')}
                  startIcon={<BarChart />}
                  fullWidth
                >
                  Bar
                </Button>
                <Button
                  variant={chartType === 'line' ? 'contained' : 'outlined'}
                  onClick={() => setChartType('line')}
                  startIcon={<ShowChart />}
                  fullWidth
                >
                  Line
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'contained' : 'outlined'}
                  onClick={() => setChartType('pie')}
                  startIcon={<PieChart />}
                  fullWidth
                >
                  Area %
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setError(null)}
            >
              <Close fontSize="inherit" />
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}

      {/* Loading States */}
      {(loading || loadingArea || loadingNDVIArea) && (
        <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>
            Loading {loadingArea ? 'coupe area' : loadingNDVIArea ? 'degraded area' : 'NDVI data'}...
          </Typography>
        </Box>
      )}

      {/* Area Information Card */}
      {totalArea > 0 && (
        <Card sx={{ mb: 3, bgcolor: '#e8f4fd' }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Calculate sx={{ fontSize: 40, color: '#1976d2' }} />
              </Grid>
              <Grid item xs>
                <Typography variant="h6" gutterBottom>
                  Coupe Area Analysis - {coupeOptions.find(c => c.value === selectedCoupe)?.label}
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body1">
                      <strong>Total Coupe Area:</strong> {totalArea.toFixed(2)} sq km
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body1">
                      <strong>Afforested Area:</strong> {summaryStats ? summaryStats.afforestedArea.toFixed(2) : 'Calculating...'} sq km
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      (Total Area - Degraded Area)
                    </Typography>
                  </Grid>
                  {/* <Grid item xs={12} md={4}>
                    <Typography variant="body1">
                      <strong>Data Source:</strong> {selectedMonth}-01_{selectedCoupe}_NDVI_Change
                    </Typography>
                  </Grid> */}
                </Grid>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summaryStats && !loading && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '4px solid #ef4444' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Degraded Area
                    </Typography>
                    <Typography variant="h4">
                      {summaryStats.degradedArea.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {summaryStats.degraded.toLocaleString()} polygons
                    </Typography>
                  </Box>
                  <Warning color="error" sx={{ fontSize: 40 }} />
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {summaryStats.degradedAreaPercentage.toFixed(1)}% of total area
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '4px solid #22c55e' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Afforested Area
                    </Typography>
                    <Typography variant="h4">
                      {summaryStats.afforestedArea.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {summaryStats.afforested.toLocaleString()} polygons
                    </Typography>
                  </Box>
                  <CheckCircle color="success" sx={{ fontSize: 40 }} />
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {summaryStats.afforestedAreaPercentage.toFixed(1)}% of total area
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: '4px solid #3b82f6' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Records with Notes
                    </Typography>
                    <Typography variant="h4">
                      {summaryStats.withNotes}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {((summaryStats.withNotes / summaryStats.totalPolygons) * 100).toFixed(1)}% of total
                    </Typography>
                  </Box>
                  <Note color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: "4px solid #f59e0b" }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Records with Images
                    </Typography>
                    <Typography variant="h4">
                      {summaryStats.withImages}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {((summaryStats.withImages / summaryStats.totalPolygons) * 100).toFixed(1)}% of total
                    </Typography>
                  </Box>
                  <ImageIcon sx={{ color: '#f59e0b', fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content Tabs */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
            <Tab label="Charts & Analysis" icon={<BarChart />} />
            <Tab label="Data Table" icon={<Visibility />} />
            <Tab label="Monthly Overview" icon={<CalendarMonth />} />
          </Tabs>

          {activeTab === 0 && (
            <Box>
              {/* Chart Type Selection */}
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label="Polygon Count"
                  onClick={() => setChartType('bar')}
                  color={chartType === 'bar' ? 'primary' : 'default'}
                  icon={<BarChart />}
                />
                <Chip
                  label="Area Trend"
                  onClick={() => setChartType('line')}
                  color={chartType === 'line' ? 'primary' : 'default'}
                  icon={<ShowChart />}
                />
                <Chip
                  label="Area Distribution %"
                  onClick={() => setChartType('pie')}
                  color={chartType === 'pie' ? 'primary' : 'default'}
                  icon={<PieChart />}
                />
                <Chip
                  label="Polygon Distribution"
                  onClick={() => setChartType('polygon-pie')}
                  color={chartType === 'polygon-pie' ? 'primary' : 'default'}
                  icon={<PieChart />}
                />
              </Box>

              {/* Chart Display */}
              <Box sx={{ height: 400, position: 'relative' }}>
                {renderChart()}
              </Box>

              {/* Analysis Notes */}
              {summaryStats && (
                <Box sx={{ mt: 3, p: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Analysis Notes - {monthOptions.find(m => m.value === selectedMonth)?.label}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2">
                        <strong>Key Findings:</strong>
                      </Typography>
                      <Typography variant="body2">
                        • <strong style={{ color: '#ef4444' }}>Degraded Area:</strong> {summaryStats.degradedArea.toFixed(2)} sq km ({summaryStats.degradedAreaPercentage.toFixed(1)}% of total)
                      </Typography>
                      <Typography variant="body2">
                        • <strong style={{ color: '#22c55e' }}>Afforested Area:</strong> {summaryStats.afforestedArea.toFixed(2)} sq km ({summaryStats.afforestedAreaPercentage.toFixed(1)}% of total)
                      </Typography>
                      <Typography variant="body2">
                        • <strong>Net Change:</strong> {summaryStats.afforestedArea > summaryStats.degradedArea ? 'Positive' : 'Negative'} forest cover
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2">
                        <strong>Data Quality:</strong>
                      </Typography>
                      <Typography variant="body2">
                        • Records with notes: {summaryStats.withNotes} ({((summaryStats.withNotes / summaryStats.totalPolygons) * 100).toFixed(1)}%)
                      </Typography>
                      <Typography variant="body2">
                        • Records with images: {summaryStats.withImages} ({((summaryStats.withImages / summaryStats.totalPolygons) * 100).toFixed(1)}%)
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              {/* Search and Filter Controls */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    placeholder="Search by ID, status, coordinates, or note..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    variant="outlined"
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showOnlyWithNotes}
                          onChange={(e) => setShowOnlyWithNotes(e.target.checked)}
                          color="primary"
                          size="small"
                        />
                      }
                      label="Only with Notes"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showOnlyWithImages}
                          onChange={(e) => setShowOnlyWithImages(e.target.checked)}
                          color="primary"
                          size="small"
                        />
                      }
                      label="Only with Images"
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setSearchTerm('');
                        setShowOnlyWithNotes(false);
                        setShowOnlyWithImages(false);
                      }}
                    >
                      Clear Filters
                    </Button>
                  </Box>
                </Grid>
              </Grid>

              {/* Data Table */}
              <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort('pixle_id')}>
                          <strong>Pixel ID</strong>
                          <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort('status')}>
                          <strong>Status</strong>
                          <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                        </Box>
                      </TableCell>
                      <TableCell><strong>NDVI Change</strong></TableCell>
                      <TableCell><strong>Category</strong></TableCell>
                      <TableCell><strong>Location</strong></TableCell>
                      <TableCell><strong>Area (sq km)</strong></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort('has_note')}>
                          <strong>Has Note</strong>
                          <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort('has_image')}>
                          <strong>Has Image</strong>
                          <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                        </Box>
                      </TableCell>
                       <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort('has_image')}>
                          <strong>Negative Vegetation Flag Status</strong>
                          <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                        </Box>
                      </TableCell>
                      <TableCell><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">
                            {searchTerm || showOnlyWithNotes || showOnlyWithImages 
                              ? 'No records match your filters' 
                              : 'No data available'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.slice(0, 100).map((row) => (
                        <TableRow 
                          key={row.pixle_id}
                          hover
                          sx={{ 
                            bgcolor: row.status ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)',
                            borderLeft: row.has_note || row.has_image ? '4px solid #ff9800' : 'none'
                          }}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              #{row.pixle_id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={'Degraded' }
                              color={'error' }
                              size="small"
                              icon={<Warning /> }
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.ndvi_change ? row.ndvi_change.toFixed(3) : 'N/A'}
                              color={row.ndvi_change < 0 ? 'error' : 'success'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {row.change_category || 'Degradation'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" display="block">
                              Lat: {row.latitude?.toFixed(6) || 'N/A'}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Lon: {row.longitude?.toFixed(6) || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {row.area_sq_km?.toFixed(6) || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {row.has_note ? (
                              <MuiTooltip title={row.note}>
                                <Chip
                                  label="Yes"
                                  color="primary"
                                  size="small"
                                  icon={<Note />}
                                />
                              </MuiTooltip>
                            ) : (
                              <Chip
                                label="No"
                                color="default"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {row.has_image ? (
                              <Chip
                                label="Yes"
                                color="warning"
                                size="small"
                                icon={<ImageIcon />}
                                onClick={() => {
                                  setSelectedRecord(row);
                                  setImageModalOpen(true);
                                }}
                                clickable
                              />
                            ) : (
                              <Chip
                                label="No"
                                color="default"
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell>
  {row.status ? 
    <Chip
      label="No"
      color="success"
      size="small"
      icon={<CheckCircle />}
    />
  : 
    <Chip
      label="Yes"
      color="error"
      size="small"
      icon={<Warning />}
    />
  }
</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Visibility />}
                              onClick={() => fetchRecordDetails(row.pixle_id)}
                              disabled={!row.pixle_id}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {filteredData.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {Math.min(100, filteredData.length)} of {filteredData.length.toLocaleString()} records
                    {showOnlyWithNotes && ' (with notes)'}
                    {showOnlyWithImages && ' (with images)'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sorted by: {sortConfig.key} ({sortConfig.direction})
                  </Typography>
                  {searchTerm && (
                    <Typography variant="body2">
                      Filtered by: "{searchTerm}"
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}

          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Monthly Comparison Overview
              </Typography>
              <Grid container spacing={3}>
                {monthOptions.map((month) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={month.value}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        border: selectedMonth === month.value ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 3
                        }
                      }}
                      onClick={() => {
                        setSelectedMonth(month.value);
                        setActiveTab(0);
                      }}
                    >
                      <CardContent>
                        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                          {month.label}
                        </Typography>
                        {monthlyData[month.value]?.stats ? (
                          <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" color="error">
                                Degraded: {monthlyData[month.value].stats.degradedArea?.toFixed(2)} sq km
                              </Typography>
                              <Typography variant="caption" color="success">
                                Afforested: {monthlyData[month.value].stats.afforestedArea?.toFixed(2)} sq km
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Δ: {((monthlyData[month.value].stats.afforestedArea - monthlyData[month.value].stats.degradedArea) || 0).toFixed(2)} sq km
                              </Typography>
                            </Box>
                          </>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Click to load data
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Record Detail Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Pixel Details - ID: {selectedRecord?.pixle_id || selectedRecord?.Pixle_id}
            </Typography>
            <IconButton onClick={() => setModalOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRecord && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      NDVI Change Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Status:</strong> {selectedRecord.status ? 'Degraded' : 'Afforested'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Category:</strong> {selectedRecord.change_category || 'Degradation'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>NDVI Change:</strong> {selectedRecord.ndvi_change ? selectedRecord.ndvi_change.toFixed(3) : 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Last Month NDVI:</strong> {selectedRecord.january_ndvi || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Current Month NDVI:</strong> {selectedRecord.february_ndvi || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Notification Sent:</strong> {selectedRecord.notification_sent ? 'Yes' : 'No'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Geographic Information
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.light' }}>
                            <Map />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Coordinates"
                          secondary={
                            <>
                              <Typography component="span" display="block">
                                Latitude: {selectedRecord.latitude?.toFixed(6) || 'N/A'}
                              </Typography>
                              <Typography component="span" display="block">
                                Longitude: {selectedRecord.longitude?.toFixed(6) || 'N/A'}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Additional Information
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'warning.light' }}>
                            <Note />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Notes"
                          secondary={selectedRecord.note || 'No additional notes'}
                          secondaryTypographyProps={{
                            sx: { fontStyle: selectedRecord.note ? 'normal' : 'italic' }
                          }}
                        />
                      </ListItem>
                      {selectedRecord.image_data && (
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'info.light' }}>
                              <ImageIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary="Image Available"
                            secondary="Click to view image"
                            secondaryTypographyProps={{
                              sx: { 
                                color: 'primary.main',
                                cursor: 'pointer',
                                '&:hover': { textDecoration: 'underline' }
                              }
                            }}
                            onClick={() => setImageModalOpen(true)}
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {selectedRecord.created_at && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Created: {new Date(selectedRecord.created_at).toLocaleString()} | 
                    Updated: {new Date(selectedRecord.updated_at).toLocaleString()}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Close</Button>
          {selectedRecord?.image_data && (
            <Button 
              variant="contained" 
              startIcon={<ZoomIn />}
              onClick={() => setImageModalOpen(true)}
            >
              View Image
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Image Preview - Pixel ID: {selectedRecord?.pixle_id || selectedRecord?.Pixle_id}
            </Typography>
            <IconButton onClick={() => setImageModalOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRecord?.image_data ? (
            <Box display="flex" justifyContent="center">
              <Box
                component="img"
                src={`data:image/jpeg;base64,${selectedRecord.image_data}`}
                alt={`NDVI Image - Pixel ${selectedRecord.pixle_id || selectedRecord.Pixle_id}`}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: 1,
                  objectFit: 'contain'
                }}
              />
            </Box>
          ) : (
            <Typography align="center" color="text.secondary">
              No image available for this record
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          Forest Cover Change Monitoring System © {new Date().getFullYear()} | 
          Data Source: NDVI Analysis | 
          Last Updated: {new Date().toLocaleDateString()}
        </Typography>
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          Note: Afforested area is calculated as (Total Coupe Area - Degraded Area from NDVI analysis)
        </Typography>
      </Box>
    </Box>
  );
};

export default NDVIChangeDashboard;