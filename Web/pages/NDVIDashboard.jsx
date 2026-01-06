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
import ForestHierarchyDropdowns from "./dropdown"
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
  FormControlLabel,
  Container,
  Stack,
  CardHeader,
  CardActions,
  LinearProgress as MuiLinearProgress
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
  Sort,
  ExpandMore,
  ExpandLess,
  FilterList,
  Search,
  Refresh
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
  const [selectedCoupe, setSelectedCoupe] = useState('');
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
  const [expandedChart, setExpandedChart] = useState(false);
  
  // Hierarchy states
  const [hierarchyData, setHierarchyData] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedBeat, setSelectedBeat] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [beats, setBeats] = useState([]);

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
useEffect(() => {
  if (selectedCoupe) {
    // When selectedCoupe changes, fetch the area and data
    fetchTotalArea(selectedCoupe);
    // Note: fetchNDVIData will be called after totalArea is set (from another useEffect)
  }
}, [selectedCoupe]);
  // ============================================
  // FIXED: Fetch hierarchy and areas
  // ============================================
  const fetchHierarchyAndAreas = async () => {
    try {
      // Fetch hierarchy data
      const hierarchyResponse = await axios.get(`${API_BASE_URL}/api/get-hierarchy`);
      if (hierarchyResponse.data.success) {
        const data = hierarchyResponse.data.data;
        setHierarchyData(data);
        
        // Extract unique divisions
        const uniqueDivisions = [...new Set(data.map(item => item.DIVISION))];
        setDivisions(uniqueDivisions.map(div => ({
          value: div,
          label: div
        })));
      }
      
      // Fetch area for default coupe
      fetchTotalArea(selectedCoupe);
      
    } catch (err) {
      console.error('Error fetching hierarchy:', err);
      setError('Failed to fetch hierarchy data');
    }
  };

  // ============================================
  // FIXED: Handle division selection
  // ============================================
  const handleDivisionChange = async (event) => {
    const divisionName = event.target.value;
    setSelectedDivision(divisionName);
    setSelectedRange(null);
    setSelectedBeat(null);
    setRanges([]);
    setBeats([]);
    
    if (!divisionName) return;
    
    // Filter ranges for selected division
    const divisionRanges = hierarchyData
      .filter(item => item.DIVISION === divisionName)
      .map(item => item.RANGE);
    
    const uniqueRanges = [...new Set(divisionRanges)];
    setRanges(uniqueRanges.map(range => ({
      value: range,
      label: range
    })));
  };

  const handleRangeChange = (event) => {
    const rangeName = event.target.value;
    setSelectedRange(rangeName);
    setSelectedBeat(null);
    setBeats([]);
    
    if (!rangeName || !selectedDivision) return;
    
    // Filter beats for selected division and range
    const divisionBeats = hierarchyData
      .filter(item => 
        item.DIVISION === selectedDivision && 
        item.RANGE === rangeName
      )
      .map(item => item.BEAT);
    
    const uniqueBeats = [...new Set(divisionBeats)];
    setBeats(uniqueBeats.map(beat => ({
      value: beat,
      label: beat
    })));
  };

  const handleBeatChange = (event) => {
    const beatName = event.target.value;
    setSelectedBeat(beatName);
    
    // Find corresponding coupe for the beat
    const beatData = hierarchyData.find(item => 
      item.DIVISION === selectedDivision && 
      item.RANGE === selectedRange && 
      item.BEAT === beatName
    );
    
    if (beatData && beatData.coupe_name) {
      // Set the coupe and fetch its data
      setSelectedCoupe(beatData.coupe_name);
      fetchTotalArea(beatData.coupe_name);
    }
  };

  // ============================================
  // FIXED: Fetch total area for selected coupe
  // ============================================
  const fetchTotalArea = async (coupeName) => {
    setLoadingArea(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/get-coupe-area`, {
        tableName: coupeName
      });
      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km || 0;
        const areaValue = parseFloat(area);
        console.log("coupe area 222222222",response.data)
        
        // FIX: Ensure area is positive and reasonable
        if (areaValue <= 0) {
          console.warn('Total area is zero or negative, using default');
          setTotalArea(100); // Default reasonable value
        } else {
          setTotalArea(areaValue);
        }
      } else {
        setTotalArea(100); // Default fallback
      }
    } catch (err) {
      console.error('Error fetching area:', err);
      setTotalArea(100); // Default fallback
    } finally {
      setLoadingArea(false);
    }
  };

  // ============================================
  // FIXED: Fetch NDVI degraded area (CORRECTED)
  // ============================================
  const fetchNDVIDegradedArea = async (coupeName, month) => {
    setLoadingNDVIArea(true);
    try {
      const tableName = `${month}-01_${coupeName}_NDVI_Change`;
      const response = await axios.post(`${API_BASE_URL}/api/ndvi-change-degraded-area`, {
        tableName
      });
      
      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km ;
        const areaValue = parseFloat(area);
        console.log(response.data,"area1234")
        // FIX: Ensure degraded area is not larger than total area
        const safeDegradedArea = Math.min(areaValue, totalArea);
        setDegradedArea(safeDegradedArea);
        return safeDegradedArea;
      }
      return 0;
    } catch (err) {
      console.error('Error fetching NDVI degraded area:', err);
      return 0;
    } finally {
      setLoadingNDVIArea(false);
    }
  };

  // ============================================
  // FIXED: Fetch NDVI change data (WITH CORRECTED CALCULATIONS)
  // ============================================
  const fetchNDVIData = async (coupeName, month) => {
    setLoading(true);
    setError(null);
    
    try {
      const tableName = `${month}-01_${coupeName}_NDVI_Change`;
      
      // Fetch data
      const dataResponse = await axios.post(`${API_BASE_URL}/api/ndvi-change-get`, { tableName });
      
      if (dataResponse.data.success) {
        const data = dataResponse.data.data;
        
        // Fetch degraded area
        const degradedAreaValue = await fetchNDVIDegradedArea(coupeName, month);
        
        // FIXED: Calculate afforested area correctly
        // Afforested area = Total area - Degraded area (minimum 0)
        const afforestedAreaValue = Math.max(0, totalArea - degradedAreaValue);
        
        const degradedPolygons = data.filter(item => item.status === true).length;
        const afforestedPolygons = data.filter(item => item.status === false).length;
        
        // Calculate area per polygon
        const degradedAreaPerPolygon = degradedPolygons > 0 ? degradedAreaValue / degradedPolygons : 0;
        const afforestedAreaPerPolygon = afforestedPolygons > 0 ? afforestedAreaValue / afforestedPolygons : 0;
        
        // Enhance data with area information
        const enhancedData = data.map(item => {
          const isDegraded = item.status === true;
          return {
            ...item,
            // Use appropriate area per polygon based on status
            area_sq_km: isDegraded ? degradedAreaPerPolygon : afforestedAreaPerPolygon,
            month: month,
            status: isDegraded,
            change_category: item.change_category || (isDegraded ? 'Degradation' : 'Afforestation'),
            has_note: !!(item.note && item.note.trim() !== ''),
            has_image: !!(item.image_data),
            pixle_id: item.pixle_id || item.Pixle_id || 'N/A'
          };
        });
        
        setCurrentTableData(enhancedData);
        sortData(enhancedData, sortConfig.key, sortConfig.direction);
        
        // Calculate statistics with CORRECTED area calculations
        const stats = calculateStatistics(enhancedData, totalArea, degradedAreaValue, afforestedAreaValue);
        setSummaryStats(stats);
        
        // Update monthly data tracking
        setMonthlyData(prev => ({
          ...prev,
          [month]: {
            data: enhancedData,
            stats,
            month: month,
            degradedArea: degradedAreaValue,
            afforestedArea: afforestedAreaValue
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

  // ============================================
  // FIXED: Calculate statistics
  // ============================================
  const calculateStatistics = (data, totalCoupeArea, degradedAreaValue, afforestedAreaValue) => {
    if (!data || data.length === 0) return null;

    const degradedPolygons = data.filter(item => item.status === true).length;
    const afforestedPolygons = data.filter(item => item.status === false).length;
    const withNotes = data.filter(item => item.has_note).length;
    const withImages = data.filter(item => item.has_image).length;
    
    // FIXED: Ensure values are reasonable
    const totalCoupeAreaKm = Math.max(0.1, totalCoupeArea); // Minimum 0.1 sq km
    const degradedAreaKm = Math.min(degradedAreaValue, totalCoupeAreaKm); // Can't exceed total
    const afforestedAreaKm = Math.max(0, totalCoupeAreaKm - degradedAreaKm); // Minimum 0
    
    const degradedPercentage = (degradedAreaKm / totalCoupeAreaKm) * 100;
    const afforestedPercentage = (afforestedAreaKm / totalCoupeAreaKm) * 100;
    
    return {
      degradedPolygons,
      afforestedPolygons,
      withNotes,
      withImages,
      degradedArea: degradedAreaKm,
      afforestedArea: afforestedAreaKm,
      totalArea: totalCoupeAreaKm,
      totalPolygons: degradedPolygons + afforestedPolygons,
      degradedPercentage,
      afforestedPercentage,
      degradedAreaPercentage: degradedPercentage,
      afforestedAreaPercentage: afforestedPercentage
    };
  };

  // Fetch record details by ID
  const fetchRecordDetails = async (id) => {
    try {
      const tableName = `${selectedMonth}-01_${selectedCoupe}_NDVI_Change`;
      const response = await axios.get(`${API_BASE_URL}/api/ndvi-change/${id}?tableName=${tableName}`);
      
      if (response.data.success) {
        setSelectedRecord(response.data.data[0]);
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
      if (key === 'has_note' || key === 'has_image') {
        if (a[key] === b[key]) return 0;
        return direction === 'desc' ? (a[key] ? -1 : 1) : (a[key] ? 1 : -1);
      }
      
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
    setSelectedDivision(null);
    setSelectedRange(null);
    setSelectedBeat(null);
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
        (item.pixle_id?.toString().toLowerCase().includes(searchLower)) ||
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
        return sortConfig.direction === 'desc' ? (a[sortConfig.key] ? -1 : 1) : (a[sortConfig.key] ? 1 : -1);
      }
      
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [currentTableData, searchTerm, showOnlyWithNotes, showOnlyWithImages, sortConfig]);

  // Initialize on component mount
  useEffect(() => {
    fetchHierarchyAndAreas();
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
        data: [summaryStats.degradedArea, summaryStats.afforestedArea],
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
        data: [summaryStats.degradedPolygons, summaryStats.afforestedPolygons],
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
    maintainAspectRatio: !expandedChart,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly NDVI Change - Area Analysis',
        font: {
          size: 16,
          weight: 'bold'
        }
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
          text: 'Area (Square Kilometers)',
          font: {
            weight: 'bold'
          }
        },
        ticks: {
          callback: function(value) {
            return value.toFixed(1) + ' km²';
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Month',
          font: {
            weight: 'bold'
          }
        }
      }
    }
  };

  const lineChartOptions = {
    ...barChartOptions,
    plugins: {
      ...barChartOptions.plugins,
      title: {
        display: true,
        text: 'Monthly Area Change Trend',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    }
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: !expandedChart,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Area Distribution (Square Kilometers)',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${value.toFixed(2)} km²`;
          }
        }
      }
    }
  };

  // Render different charts based on selection
  const renderChart = () => {
    const chartData = {
      'bar': <Bar data={prepareMonthlyChartData()} options={barChartOptions} />,
      'line': <Line data={prepareAreaChartData()} options={lineChartOptions} />,
      'pie': <Pie data={preparePieChartData()} options={pieChartOptions} />,
      'polygon-pie': <Pie data={preparePolygonPieChartData()} options={pieChartOptions} />
    }[chartType];

    return (
      <Box sx={{ 
        height: expandedChart ? '70vh' : 400, 
        position: 'relative',
        transition: 'height 0.3s ease-in-out'
      }}>
        {chartData}
        <IconButton
          onClick={() => setExpandedChart(!expandedChart)}
          sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8,
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'background.paper' }
          }}
        >
          {expandedChart ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
    );
  };



  // Export to PDF
  const handleExportToPDF = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NDVI Report - ${selectedCoupe} - ${selectedMonth}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 30px; 
              color: #333;
              line-height: 1.6;
            }
            .header { 
              text-align: center; 
              border-bottom: 3px solid #2c3e50;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            h1 { 
              color: #2c3e50; 
              margin-bottom: 10px;
              font-size: 28px;
            }
            .subtitle {
              color: #7f8c8d;
              font-size: 14px;
            }
            .summary-card {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 25px;
              border-radius: 12px;
              margin: 25px 0;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin: 25px 0;
            }
            .stat-card {
              background: white;
              border: 1px solid #e1e8ed;
              border-radius: 10px;
              padding: 20px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            .stat-card.degraded {
              border-left: 5px solid #ef4444;
            }
            .stat-card.afforested {
              border-left: 5px solid #22c55e;
            }
            .stat-value {
              font-size: 32px;
              font-weight: bold;
              margin: 10px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 30px;
              font-size: 13px;
            }
            th {
              background-color: #2c3e50;
              color: white;
              padding: 12px 15px;
              text-align: left;
              font-weight: 600;
            }
            td {
              padding: 10px 15px;
              border-bottom: 1px solid #e1e8ed;
            }
            tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            .badge {
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
            }
            .badge-degraded {
              background-color: #fee2e2;
              color: #dc2626;
            }
            .badge-afforested {
              background-color: #dcfce7;
              color: #16a34a;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e1e8ed;
              font-size: 12px;
              color: #7f8c8d;
              text-align: center;
            }
            @media print {
              body { padding: 15px; }
              .summary-card { break-inside: avoid; }
              table { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Forest Cover Change Monitoring System</h1>
            <div class="subtitle">NDVI Change Analysis Report</div>
          </div>
          
          <div class="summary-card">
            <h2 style="margin-top: 0; color: white;">Summary Report</h2>
            <p><strong>Coupe:</strong> ${coupeOptions.find(c => c.value === selectedCoupe)?.label || selectedCoupe}</p>
            <p><strong>Month:</strong> ${monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString('en-IN', { 
              timeZone: 'Asia/Kolkata',
              dateStyle: 'full',
              timeStyle: 'medium'
            })}</p>
          </div>
          
          ${summaryStats ? `
            <div class="stats-grid">
              <div class="stat-card degraded">
                <h3>Degraded Area</h3>
                <div class="stat-value">${summaryStats.degradedArea.toFixed(2)} km²</div>
                <p>${summaryStats.degradedPolygons.toLocaleString()} polygons (${summaryStats.degradedPercentage.toFixed(1)}% of total)</p>
              </div>
              
              <div class="stat-card afforested">
                <h3>Afforested Area</h3>
                <div class="stat-value">${summaryStats.afforestedArea.toFixed(2)} km²</div>
                <p>${summaryStats.afforestedPolygons.toLocaleString()} polygons (${summaryStats.afforestedPercentage.toFixed(1)}% of total)</p>
              </div>
              
              <div class="stat-card">
                <h3>Total Area</h3>
                <div class="stat-value">${totalArea.toFixed(2)} km²</div>
                <p>Complete coupe coverage</p>
              </div>
              
              <div class="stat-card">
                <h3>Net Change</h3>
                <div class="stat-value" style="color: ${summaryStats.afforestedArea > summaryStats.degradedArea ? '#16a34a' : '#dc2626'}">
                  ${(summaryStats.afforestedArea - summaryStats.degradedArea).toFixed(2)} km²
                </div>
                <p>${summaryStats.afforestedArea > summaryStats.degradedArea ? 'Positive' : 'Negative'} change</p>
              </div>
            </div>
          ` : ''}
          
          <h2>Data Sample (First 20 Records)</h2>
          <table>
            <thead>
              <tr>
                <th>Pixel ID</th>
                <th>Status</th>
                <th>NDVI Change</th>
                <th>Area (km²)</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Has Note</th>
                <th>Has Image</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.slice(0, 20).map(item => `
                <tr>
                  <td>${item.pixle_id || 'N/A'}</td>
                  <td>
                    <span class="badge  'badge-degraded' >
                      'Degraded' 
                    </span>
                  </td>
                  <td>${item.ndvi_change?.toFixed(4) || 'N/A'}</td>
                  <td>${item.area_sq_km?.toFixed(6) || 'N/A'}</td>
                  <td>${item.latitude?.toFixed(6) || 'N/A'}</td>
                  <td>${item.longitude?.toFixed(6) || 'N/A'}</td>
                  <td>${item.has_note ? 'Yes' : 'No'}</td>
                  <td>${item.has_image ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>Forest Cover Change Monitoring System © ${new Date().getFullYear()}</p>
            <p>Data Source: NDVI Satellite Analysis | Report ID: ${Date.now()}</p>
            <p><em>Note: All area measurements are in square kilometers (km²). Afforested area is calculated as (Total Coupe Area - Degraded Area).</em></p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Refresh data
  const handleRefresh = () => {
    fetchTotalArea(selectedCoupe);
    fetchNDVIData(selectedCoupe, selectedMonth);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }}>
      {/* Header */}
      <Card sx={{ 
        mb: 4, 
        bgcolor: 'transparent', 
        color: 'black',
        borderRadius: 3,
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        <CardContent>
          <Grid container alignItems="center" spacing={3}>
            <Grid item>
              <Box sx={{
                p: 2,
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Forest sx={{ fontSize: 48 }} />
              </Box>
            </Grid>
            <Grid item xs>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                Forest Cover Change Monitoring System
              </Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                Real-time NDVI Change Analysis Dashboard
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Chip 
                  label="Satellite Data" 
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'black' }} 
                  size="small"
                />
                <Chip 
                  label="GIS Analysis" 
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'black' }} 
                  size="small"
                />
                <Chip 
                  label="Real-time Updates" 
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'black' }} 
                  size="small"
                />
              </Stack>
            </Grid>
            <Grid item>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                  sx={{ 
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    bgcolor:'#00a651'
                  }}
                >
                  Refresh
                </Button>
               
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<PictureAsPdf />}
                  onClick={handleExportToPDF}
                  sx={{ 
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  PDF
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Hierarchy Navigation */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.05)', bgcolor : "transparent" }}>
        <CardHeader 
          title="Forest Hierarchy Navigation"
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          avatar={<Forest />}
        />
        <CardContent>
         
<Grid >
  <ForestHierarchyDropdowns setSelectedCoupe={setSelectedCoupe} />
</Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Or Select Coupe Directly</InputLabel>
                <Select
                  value={selectedCoupe}
                  label="Or Select Coupe Directly"
                  onChange={handleCoupeChange}
                >
                  {coupeOptions.map(coupe => (
                    <MenuItem key={coupe.value} value={coupe.value}>
                      {coupe.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          
          
          {(selectedDivision || selectedRange || selectedBeat) && (
            <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 2 }}>
              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                Selected Hierarchy: 
                {selectedDivision && ` Division: ${selectedDivision}`}
                {selectedRange && ` → Range: ${selectedRange}`}
                {selectedBeat && ` → Beat: ${selectedBeat}`}
                {selectedCoupe && ` → Coupe: ${coupeOptions.find(c => c.value === selectedCoupe)?.label}`}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Main Filters */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.05)', bgcolor: "transparent" }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Month for Analysis</InputLabel>
                <Select
                  value={selectedMonth}
                  label="Select Month for Analysis"
                  onChange={handleMonthChange}
                  startAdornment={<CalendarMonth sx={{ mr: 1, color: 'primary.main' }} />}
                >
                  {monthOptions.map(month => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  variant={chartType === 'bar' ? 'contained' : 'outlined'}
                  onClick={() => setChartType('bar')}
                  startIcon={<BarChart />}
                  size="small"
                  sx={{
                    color: chartType === 'bar' ? 'black' : 'black',
                    borderColor: 'black',
                    '&:hover': {
                      backgroundColor: chartType === 'bar' ? '#333' : 'rgba(0, 0, 0, 0.04)',
                    }
                  }}
                >
                  Bar Chart
                </Button>
                <Button
                  variant={chartType === 'line' ? 'contained' : 'outlined'}
                  onClick={() => setChartType('line')}
                  startIcon={<ShowChart />}
                  size="small"
                  sx={{
                    color: chartType === 'bar' ? 'black' : 'black',
                    borderColor: 'black',
                    '&:hover': {
                      backgroundColor: chartType === 'bar' ? '#333' : 'rgba(0, 0, 0, 0.04)',
                    }
                  }}
                >
                  Trend Line
                </Button>
                <Button
                  variant={chartType === 'pie' ? 'contained' : 'outlined'}
                  onClick={() => setChartType('pie')}
                  startIcon={<PieChart />}
                  size="small"
                  sx={{
                    color: chartType === 'bar' ? 'black' : 'black',
                    borderColor: 'black',
                    '&:hover': {
                      backgroundColor: chartType === 'bar' ? '#333' : 'rgba(0, 0, 0, 0.04)',
                    }
                  }}
                >
                  Area Pie
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 4, borderRadius: 2 }}
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
          <Typography fontWeight={600}>{error}</Typography>
        </Alert>
      )}

      {/* Loading States */}
      {(loading || loadingArea || loadingNDVIArea) && (
        <Card sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="center" sx={{ py: 4 }}>
              <CircularProgress sx={{ mr: 2 }} />
              <Box>
                <Typography variant="body1" fontWeight={600}>
                  Loading Data...
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {loadingArea ? 'Fetching coupe area...' : 
                   loadingNDVIArea ? 'Calculating degraded area...' : 
                   'Loading NDVI change data...'}
                </Typography>
                <MuiLinearProgress sx={{ mt: 1 }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Area Information */}
      {totalArea > 0 && (
        <Card sx={{ 
          mb: 4, 
          borderRadius: 3,
          background: 'transparent',
          color: 'black',
          boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)'
        }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Box sx={{
                  p: 2,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Calculate sx={{ fontSize: 36 }} />
                </Box>
              </Grid>
              <Grid item xs >
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                  Coupe Area Analysis - {coupeOptions.find(c => c.value === selectedCoupe)?.label}
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Total Coupe Area
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {totalArea.toFixed(2)} km²
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Afforested Area
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#22c55e' }}>
                        {summaryStats ? summaryStats.afforestedArea.toFixed(2) : '0.00'} km²
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Degraded Area
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#ef4444' }}>
                        {summaryStats ? summaryStats.degradedArea.toFixed(2) : '0.00'} km²
                      </Typography>
                    </Box>
                  </Grid>
                  {/* <Grid item xs={12} md={3}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Net Change
                      </Typography>
                      <Typography variant="h5" sx={{ 
                        fontWeight: 800, 
                        color: summaryStats && summaryStats.afforestedArea > summaryStats.degradedArea ? '#22c55e' : '#ef4444'
                      }}>
                        {summaryStats ? (summaryStats.afforestedArea - summaryStats.degradedArea).toFixed(2) : '0.00'} km²
                      </Typography>
                    </Box>
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
            <Card sx={{ 
              borderRadius: 3, 
              borderLeft: '6px solid #ef4444',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.1)',
              height: '100%'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 600 }}>
                      Degraded Area
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#ef4444' }}>
                      {summaryStats.degradedArea.toFixed(2)}
                      <Typography component="span" variant="body1" sx={{ ml: 0.5, color: 'text.secondary' }}>
                        km²
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {summaryStats.degradedPolygons.toLocaleString()} polygons
                    </Typography>
                  </Box>
                  <Warning sx={{ fontSize: 40, color: '#ef4444', opacity: 0.8 }} />
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {summaryStats.degradedPercentage.toFixed(1)}% of total area
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 3, 
              borderLeft: '6px solid #22c55e',
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.1)',
              height: '100%'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 600 }}>
                      Afforested Area
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#22c55e' }}>
                      {summaryStats.afforestedArea.toFixed(2)}
                      <Typography component="span" variant="body1" sx={{ ml: 0.5, color: 'text.secondary' }}>
                        km²
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {summaryStats.afforestedPolygons.toLocaleString()} polygons
                    </Typography>
                  </Box>
                  <CheckCircle sx={{ fontSize: 40, color: '#22c55e', opacity: 0.8 }} />
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {summaryStats.afforestedPercentage.toFixed(1)}% of total area
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 3, 
              borderLeft: '6px solid #3b82f6',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.1)',
              height: '100%'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 600 }}>
                      Records with Notes
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#3b82f6' }}>
                      {summaryStats.withNotes}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {((summaryStats.withNotes / summaryStats.totalPolygons) * 100).toFixed(1)}% of total
                    </Typography>
                  </Box>
                  <Note sx={{ fontSize: 40, color: '#3b82f6', opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 3, 
              borderLeft: '6px solid #f59e0b',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.1)',
              height: '100%'
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 600 }}>
                      Records with Images
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                      {summaryStats.withImages}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {((summaryStats.withImages / summaryStats.totalPolygons) * 100).toFixed(1)}% of total
                    </Typography>
                  </Box>
                  <ImageIcon sx={{ fontSize: 40, color: '#f59e0b', opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Content Tabs */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', bgcolor: "transparent"}}>
        <CardContent sx={{ p: 0 }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            sx={{ 
              px: 3, 
              pt: 2,
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.95rem'
              }
            }}
          >
            <Tab label="Charts & Analysis" icon={<BarChart />} />
            <Tab label="Data Table" icon={<Visibility />} />
            <Tab label="Monthly Overview" icon={<CalendarMonth />} />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {activeTab === 0 && (
              <Box>
                {/* Chart Type Selection */}
                <Box sx={{ 
                  mb: 4, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 2, 
                  flexWrap: 'wrap',
                  '& .MuiChip-root': {
                    borderRadius: 2,
                    fontWeight: 600
                  }
                }}>
                  <Chip
                    label="Area Bar Chart"
                    onClick={() => setChartType('bar')}
                    color={chartType === 'bar' ? 'primary' : 'default'}
                    icon={<BarChart />}
                  />
                  <Chip
                    label="Area Trend Line"
                    onClick={() => setChartType('line')}
                    color={chartType === 'line' ? 'primary' : 'default'}
                    icon={<ShowChart />}
                  />
                  <Chip
                    label="Area Distribution"
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
                <Box sx={{ 
                  position: 'relative',
                  borderRadius: 2,
                  overflow: 'hidden'
                }}>
                  {renderChart()}
                </Box>

                {/* Analysis Notes */}
                {summaryStats && (
                  <Card sx={{ mt: 4, borderRadius: 2 ,bgcolor:'transparent'}}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Info color="primary" />
                        Analysis Summary - {monthOptions.find(m => m.value === selectedMonth)?.label}
                      </Typography>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ 
                            p: 2, 
                            bgcolor: 'transparent', 
                            borderRadius: 2,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: '#64748b' }}>
                              Key Findings
                            </Typography>
                            <Stack spacing={1.5}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  bgcolor: '#ef4444', 
                                  borderRadius: '50%', 
                                  mr: 1.5 
                                }} />
                                <Typography variant="body2">
                                  <strong>Degraded Area:</strong> {summaryStats.degradedArea.toFixed(2)} km² ({summaryStats.degradedPercentage.toFixed(1)}% of total)
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  bgcolor: '#22c55e', 
                                  borderRadius: '50%', 
                                  mr: 1.5 
                                }} />
                                <Typography variant="body2">
                                  <strong>Afforested Area:</strong> {summaryStats.afforestedArea.toFixed(2)} km² ({summaryStats.afforestedPercentage.toFixed(1)}% of total)
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  bgcolor: '#3b82f6', 
                                  borderRadius: '50%', 
                                  mr: 1.5 
                                }} />
                                <Typography variant="body2">
                                  <strong>Net Change:</strong> 
                                  <span style={{ 
                                    color: summaryStats.afforestedArea > summaryStats.degradedArea ? '#22c55e' : '#ef4444',
                                    fontWeight: 600,
                                    marginLeft: 4
                                  }}>
                                    {(summaryStats.afforestedArea - summaryStats.degradedArea).toFixed(2)} km²
                                  </span>
                                  ({summaryStats.afforestedArea > summaryStats.degradedArea ? 'Positive' : 'Negative'} change)
                                </Typography>
                              </Box>
                            </Stack>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ 
                            p: 2, 
                            bgcolor: 'transparent', 
                            borderRadius: 2,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: '#64748b' }}>
                              Data Quality
                            </Typography>
                            <Stack spacing={1.5}>
                              <Typography variant="body2">
                                <strong>Records with notes:</strong> {summaryStats.withNotes} ({((summaryStats.withNotes / summaryStats.totalPolygons) * 100).toFixed(1)}%)
                              </Typography>
                              <Typography variant="body2">
                                <strong>Records with images:</strong> {summaryStats.withImages} ({((summaryStats.withImages / summaryStats.totalPolygons) * 100).toFixed(1)}%)
                              </Typography>
                              <Typography variant="body2">
                                <strong>Total polygons analyzed:</strong> {summaryStats.totalPolygons.toLocaleString()}
                              </Typography>
                            </Stack>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                {/* Search and Filter Controls */}
                <Card sx={{ mb: 3, borderRadius: 2 ,bgcolor: 'transparent'}}>
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          placeholder="Search by ID, status, coordinates, notes..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          variant="outlined"
                          size="small"
                          InputProps={{
                            startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} />,
                            sx: { borderRadius: 2 }
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                            startIcon={<FilterList />}
                            onClick={() => {
                              setSearchTerm('');
                              setShowOnlyWithNotes(false);
                              setShowOnlyWithImages(false);
                            }}
                            sx={{ borderRadius: 2 }}
                          >
                            Clear Filters
                          </Button>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Data Table */}
                <Paper sx={{ 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  bgcolor:'transparent'
                }}>
                  <TableContainer sx={{ maxHeight: 500 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow sx={{ '& th': { bgcolor: 'transparent', fontWeight: 600 } }}>
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
                          <TableCell><strong>Area (km²)</strong></TableCell>
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
                          <TableCell><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Search sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                <Typography variant="h6" color="text.secondary" gutterBottom>
                                  No records found
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {searchTerm || showOnlyWithNotes || showOnlyWithImages 
                                    ? 'Try adjusting your filters' 
                                    : 'No data available for the selected criteria'}
                                </Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredData.slice(0, 100).map((row) => (
                            <TableRow 
                              key={row.pixle_id}
                              hover
                              sx={{ 
                                '&:hover': { bgcolor: '#f8fafc' },
                                borderLeft: row.has_note || row.has_image ? '4px solid #f59e0b' : 'none',
                                transition: 'background-color 0.2s'
                              }}
                            >
                              <TableCell>
                                <Typography variant="body2" fontWeight={600} color="primary">
                                  #{row.pixle_id}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label= 'Degraded'
                                  color='error' 
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={row.ndvi_change ? row.ndvi_change.toFixed(4) : 'N/A'}
                                  color={row.ndvi_change < 0 ? 'error' : 'success'}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ 
                                  color: row.change_category === 'Degradation' ? '#ef4444' : '#22c55e',
                                  fontWeight: 600
                                }}>
                                  {row.change_category || 'Degradation'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box>
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    Lat: {row.latitude?.toFixed(6) || 'N/A'}
                                  </Typography>
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    Lon: {row.longitude?.toFixed(6) || 'N/A'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  {row.area_sq_km?.toFixed(6) || '0.000000'} km²
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {row.has_note ? (
                                  <MuiTooltip title={row.note || 'Note available'}>
                                    <Chip
                                      label="Yes"
                                      color="primary"
                                      size="small"
                                      icon={<Note />}
                                      sx={{ fontWeight: 600 }}
                                    />
                                  </MuiTooltip>
                                ) : (
                                  <Chip
                                    label="No"
                                    color="default"
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 600 }}
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
                                    sx={{ fontWeight: 600 }}
                                  />
                                ) : (
                                  <Chip
                                    label="No"
                                    color="default"
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontWeight: 600 }}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<Visibility />}
                                  onClick={() => fetchRecordDetails(row.pixle_id)}
                                  disabled={!row.pixle_id}
                                  sx={{ 
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontWeight: 600
                                  }}
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
                    <Box sx={{ 
                      p: 2, 
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      flexWrap: 'wrap',
                     
                    }}>
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <strong>Showing:</strong> {Math.min(100, filteredData.length)} of {filteredData.length.toLocaleString()} records
                        {showOnlyWithNotes && ' (with notes)'}
                        {showOnlyWithImages && ' (with images)'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <strong>Sorted by:</strong> {sortConfig.key} ({sortConfig.direction})
                      </Typography>
                      {searchTerm && (
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <strong>Filtered by:</strong> "{searchTerm}"
                        </Typography>
                      )}
                    </Box>
                  )}
                </Paper>
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarMonth color="primary" />
                  Monthly Comparison Overview
                </Typography>
                <Grid container spacing={3}>
                  {monthOptions.map((month) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={month.value}>
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          borderRadius: 3,
                          border: selectedMonth === month.value ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 12px 24px rgba(0,0,0,0.1)'
                          },
                          bgcolor: 'transparent',
                        }}
                        onClick={() => {
                          setSelectedMonth(month.value);
                          setActiveTab(0);
                        }}
                      >
                        <CardContent sx={{ p: 2.5 }}>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: 'black' }}>
                            {month.label}
                          </Typography>
                          {monthlyData[month.value]?.stats ? (
                            <>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600 }}>
                                  Degraded: {monthlyData[month.value].stats.degradedArea?.toFixed(2)} km²
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 }}>
                                  Afforested: {monthlyData[month.value].stats.afforestedArea?.toFixed(2)} km²
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                                  Δ: {(monthlyData[month.value].stats.afforestedArea - monthlyData[month.value].stats.degradedArea).toFixed(2)} km²
                                </Typography>
                                <Typography variant="caption" sx={{ 
                                  color: monthlyData[month.value].stats.afforestedArea > monthlyData[month.value].stats.degradedArea ? '#22c55e' : '#ef4444',
                                  fontWeight: 600
                                }}>
                                  {monthlyData[month.value].stats.afforestedArea > monthlyData[month.value].stats.degradedArea ? '↑ Positive' : '↓ Negative'}
                                </Typography>
                              </Box>
                            </>
                          ) : (
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                Click to load data
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Record Detail Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <Visibility sx={{ mr: 1, verticalAlign: 'middle' }} />
              Pixel Details - ID: {selectedRecord?.pixle_id || selectedRecord?.Pixle_id}
            </Typography>
            <IconButton onClick={() => setModalOpen(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {selectedRecord && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Info color="primary" />
                      NDVI Change Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Status:</strong> 
                          <Chip 
                            label={selectedRecord.status ? 'Degraded' : 'Afforested'} 
                            color={selectedRecord.status ? 'error' : 'success'} 
                            size="small" 
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Category:</strong> {selectedRecord.change_category || 'Degradation'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>NDVI Change:</strong> {selectedRecord.ndvi_change ? selectedRecord.ndvi_change.toFixed(4) : 'N/A'}
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
                          <strong>Area:</strong> {selectedRecord.area_sq_km?.toFixed(6) || '0.000000'} km²
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Map color="primary" />
                      Geographic Information
                    </Typography>
                    <List dense disablePadding>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.light', width: 40, height: 40 }}>
                            <Map />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Coordinates"
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                                Latitude: {selectedRecord.latitude?.toFixed(6) || 'N/A'}
                              </Typography>
                              <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                                Longitude: {selectedRecord.longitude?.toFixed(6) || 'N/A'}
                              </Typography>
                            </Box>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Note color="primary" />
                      Additional Information
                    </Typography>
                    <List dense disablePadding>
                      <ListItem disableGutters>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'warning.light', width: 40, height: 40 }}>
                            <Note />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Notes"
                          secondary={
                            <Typography variant="body2" sx={{ 
                              fontStyle: selectedRecord.note ? 'normal' : 'italic',
                              color: selectedRecord.note ? 'text.primary' : 'text.secondary'
                            }}>
                              {selectedRecord.note || 'No additional notes'}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {selectedRecord.image_data && (
                        <ListItem disableGutters sx={{ mt: 2 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'info.light', width: 40, height: 40 }}>
                              <ImageIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary="Image Available"
                            secondary={
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: 'primary.main',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  '&:hover': { textDecoration: 'underline' }
                                }}
                                onClick={() => setImageModalOpen(true)}
                              >
                                Click to view image
                              </Typography>
                            }
                          />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {selectedRecord.created_at && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span>
                      <strong>Created:</strong> {new Date(selectedRecord.created_at).toLocaleString()}
                    </span>
                    <span>|</span>
                    <span>
                      <strong>Updated:</strong> {new Date(selectedRecord.updated_at).toLocaleString()}
                    </span>
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button 
            onClick={() => setModalOpen(false)} 
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
          {selectedRecord?.image_data && (
            <Button 
              variant="contained" 
              startIcon={<ZoomIn />}
              onClick={() => setImageModalOpen(true)}
              sx={{ borderRadius: 2 }}
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
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              <ImageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Image Preview - Pixel ID: {selectedRecord?.pixle_id || selectedRecord?.Pixle_id}
            </Typography>
            <IconButton onClick={() => setImageModalOpen(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {selectedRecord?.image_data ? (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '60vh' }}>
              <Box
                component="img"
                src={`data:image/jpeg;base64,${selectedRecord.image_data}`}
                alt={`NDVI Image - Pixel ${selectedRecord.pixle_id || selectedRecord.Pixle_id}`}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: 2,
                  objectFit: 'contain',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                }}
              />
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Image Available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No satellite image is available for this record
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button 
            onClick={() => setImageModalOpen(false)} 
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Box sx={{ 
        mt: 6, 
        pt: 4, 
        borderTop: '1px solid #e2e8f0',
        textAlign: 'center'
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <strong>Forest Cover Change Monitoring System</strong> © {new Date().getFullYear()} | 
          Data Source: Sentinel-2 Satellite NDVI Analysis
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          <strong>Note:</strong> All area measurements are in square kilometers (km²). 
          Afforested area is calculated as (Total Coupe Area - Degraded Area from NDVI analysis). 
          Last Updated: {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </Typography>
      </Box>
    </Container>
  );
};

export default NDVIChangeDashboard;