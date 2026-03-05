import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip as MuiTooltip,
  FormControlLabel,
  Container,
  Stack,
  CardHeader,
  LinearProgress as MuiLinearProgress,
  Divider
} from '@mui/material';
import { Switch } from '@mui/material';

import Checkbox from '@mui/material/Checkbox';
import FormGroup from '@mui/material/FormGroup';
import {
  Visibility,
  Image as ImageIcon,
  Note,
  Close,
  ZoomIn,
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
  Sort,
  FilterList,
  Search,
  OpenInFull,
  CloseFullscreen,
  Send,
  KeyboardArrowDown,
  KeyboardArrowUp
} from '@mui/icons-material';
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

// ============================================
// NDVIMyCoups_dropdown Component
// ============================================
const NDVIMyCoups_dropdown = ({ onHierarchyChange }) => {
  const [divisions, setDivisions] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [beats, setBeats] = useState([]);
  const [division, setDivision] = useState("");
  const [range, setRange] = useState("");
  const [round, setRound] = useState("");
  const [beat, setBeat] = useState("");

  /* ------------------ Load Divisions from coupe_dropdown_master ------------------ */
  useEffect(() => {
    const fetchDivisions = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${API_BASE_URL}/api/coupe-divisions`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log("api/coupe-divisions", res.data);
        setDivisions(res.data[0] || []);
      } catch (error) {
        console.error("Error fetching divisions:", error);
      }
    };

    fetchDivisions();
  }, []);

  /* ------------------ Load Ranges based on selected Division ------------------ */
  const handleDivisionChange = async (e) => {
    const selectedDivision = e.target.value;
    setDivision(selectedDivision);
    setRange("");
    setRound("");
    setBeat("");
    setRanges([]);
    setRounds([]);
    setBeats([]);

    if (!selectedDivision) {
      onHierarchyChange({ division: null, range: null, round: null, beat: null });
      return;
    }

    // If "all" is selected, don't fetch ranges/rounds/beats
    if (selectedDivision === 'all') {
      onHierarchyChange({ division: 'all', range: null, round: null, beat: null, isAllDivisions: true });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/coupe-ranges`,
        { division: selectedDivision },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("api/coupe-ranges", res.data);
      setRanges(res.data);
      onHierarchyChange({ division: selectedDivision, range: null, round: null, beat: null, isAllDivisions: false });
    } catch (error) {
      console.error("Error fetching ranges:", error);
    }
  };

  /* ------------------ Load Rounds based on selected Division and Range ------------------ */
  const handleRangeChange = async (e) => {
    const selectedRange = e.target.value;
    setRange(selectedRange);
    setRound("");
    setBeat("");
    setRounds([]);
    setBeats([]);

    if (!selectedRange || !division || division === 'all') {
      onHierarchyChange({ division, range: null, round: null, beat: null, isAllDivisions: division === 'all' });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/coupe-rounds`,
        {
          division: division,
          range: selectedRange
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("api/coupe-rounds", res.data);
      setRounds(res.data);
      onHierarchyChange({ division, range: selectedRange, round: null, beat: null, isAllDivisions: false });
    } catch (error) {
      console.error("Error fetching rounds:", error);
    }
  };

  /* ------------------ Load Beats based on selected Division, Range, and Round ------------------ */
  const handleRoundChange = async (e) => {
    const selectedRound = e.target.value;
    setRound(selectedRound);
    setBeat("");
    setBeats([]);

    if (!selectedRound || !range || !division || division === 'all') {
      onHierarchyChange({ division, range, round: null, beat: null, isAllDivisions: division === 'all' });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE_URL}/api/coupe-beats`,
        {
          division: division,
          range: range,
          round: selectedRound
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("api/coupe-beats", res.data);
      setBeats(res.data);
      onHierarchyChange({ division, range, round: selectedRound, beat: null, isAllDivisions: false });
    } catch (error) {
      console.error("Error fetching beats:", error);
    }
  };

  /* ------------------ Handle Beat Selection ------------------ */
  const handleBeatChange = async (e) => {
    const selectedBeat = e.target.value;
    setBeat(selectedBeat);
    
    if (selectedBeat && division && range && round && division !== 'all') {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.post(
          `${API_BASE_URL}/api/get-coupe-by-beat`,
          {
            division: division,
            range: range,
            round: round,
            beat: selectedBeat
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (res.data.success && res.data.coupe_name) {
          onHierarchyChange({ 
            division, 
            range, 
            round,
            beat: selectedBeat,
            coupe_name: res.data.coupe_name,
            isAllDivisions: false
          });
        } else {
          onHierarchyChange({ division, range, round, beat: selectedBeat, isAllDivisions: false });
        }
      } catch (error) {
        console.error("Error fetching coupe for beat:", error);
        onHierarchyChange({ division, range, round, beat: selectedBeat, isAllDivisions: false });
      }
    } else {
      onHierarchyChange({ division, range, round, beat: selectedBeat, isAllDivisions: division === 'all' });
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 2, 
      flexWrap: 'wrap',
      p: 2
    }}>
      {/* Division Dropdown */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Division</InputLabel>
        <Select
          value={division}
          onChange={handleDivisionChange}
          label="Division"
        >
          <MenuItem value="">Select Division</MenuItem>
          <MenuItem value="all" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            <em>All Divisions</em>
          </MenuItem>
          {divisions.map((d, index) => (
            <MenuItem key={index} value={d.division}>
              {d.division}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Range Dropdown - Disabled when "All Divisions" is selected */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Range</InputLabel>
        <Select
          value={range}
          onChange={handleRangeChange}
          label="Range"
          disabled={!division || division === 'all'}
        >
          <MenuItem value="">Select Range</MenuItem>
          {ranges.map((r, index) => (
            <MenuItem key={index} value={r.range}>
              {r.range}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Round Dropdown - Disabled when "All Divisions" is selected */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Round</InputLabel>
        <Select
          value={round}
          onChange={handleRoundChange}
          label="Round"
          disabled={!range || division === 'all'}
        >
          <MenuItem value="">Select Round</MenuItem>
          {rounds.map((r, index) => (
            <MenuItem key={index} value={r.round}>
              {r.round}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Beat Dropdown - Disabled when "All Divisions" is selected */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Beat</InputLabel>
        <Select
          value={beat}
          onChange={handleBeatChange}
          label="Beat"
          disabled={!round || division === 'all'}
        >
          <MenuItem value="">Select Beat</MenuItem>
          {beats.map((b, index) => (
            <MenuItem key={index} value={b.beat}>
              {b.beat}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

// ============================================
// Main NDVIChangeDashboard Component
// ============================================
const NDVIChangeDashboard = () => {
  // State management
  const [selectedCoupe, setSelectedCoupe] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2025-02');
  const [monthlyData, setMonthlyData] = useState({});
  const [currentTableData, setCurrentTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingArea, setLoadingArea] = useState(false);
  const [loadingNDVIArea, setLoadingNDVIArea] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [totalArea, setTotalArea] = useState(0);
  const [summaryStats, setSummaryStats] = useState(null);
  const [chartType, setChartType] = useState('bar');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyWithNotes, setShowOnlyWithNotes] = useState(false);
  const [showOnlyWithImages, setShowOnlyWithImages] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'pixle_id', direction: 'asc' });
  const [expandedChart, setExpandedChart] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date(2025, 1, 1));
  const [showDivisionColumn, setShowDivisionColumn] = useState(true);
  
  // New state for date range
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [tableNames, setTableNames] = useState([]);
  
  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [rowsPerPageOptions] = useState([10, 25, 50, 100]);
  
  // Hierarchy states
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [selectedBeat, setSelectedBeat] = useState(null);
  const [hierarchyCoupeName, setHierarchyCoupeName] = useState(null);

  // Add state for coupeOptions
  const [coupeOptions, setCoupeOptions] = useState([
    { value: 'Banaskantha_RWD_WC_final', label: 'Banaskantha RWD WC' },
    { value: 'Banaskantha_Wild Life_WC', label: 'Banaskantha Wildlife WC' },
    { value: 'Banaskantha_Con_Cum_Imp_WC_OVLP', label: 'Banaskantha Con Cum Imp' },
    { value: 'Bhavnagar_coupes', label: 'Bhavnagar Coupes' },
    { value: 'Sabarkantha_North_Aravalli', label: 'Sabarkantha North Aravalli' }
  ]);

  // Add state for section expansion
  const [expandedSections, setExpandedSections] = useState({
    charts: true,
    dataTable: true,
    monthlyOverview: true
  });

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Function to transform division name to coupe name
  const transformDivisionToCoupe = (divisionName) => {
    if (!divisionName || divisionName === 'all') return null;
    
    // Remove " Forest Division" and replace with "_coupe"
    // Also convert to lowercase and replace spaces with underscores
    let coupeName = divisionName
      .replace(/ Forest Division$/i, '') // Remove " Forest Division" at the end
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase(); // Convert to lowercase
    
    // Add "_coupe" at the end
    coupeName = `${coupeName}_coupe`;
    
    console.log(`Transformed "${divisionName}" to "${coupeName}"`);
    return coupeName;
  };

  // Handle hierarchy change from dropdown
  const handleHierarchyChange = (hierarchy) => {
    console.log("Hierarchy changed:", hierarchy);
    
    setSelectedDivision(hierarchy.division);
    setSelectedRange(hierarchy.range);
    setSelectedRound(hierarchy.round);
    setSelectedBeat(hierarchy.beat);
    setHierarchyCoupeName(hierarchy.coupe_name || null);
    
    // If division is selected and we have the division name, transform it to coupe name
    if (hierarchy.division && !hierarchy.coupe_name && hierarchy.division !== 'all') {
      const transformedCoupe = transformDivisionToCoupe(hierarchy.division);
      setHierarchyCoupeName(transformedCoupe);
      console.log("Set hierarchy coupe name to:", transformedCoupe);
    } else if (hierarchy.division === 'all') {
      console.log("All divisions selected");
      setHierarchyCoupeName('all_divisions');
    }
  };

  // Generate table names based on date range
  const generateTableNames = (start, end) => {
    if (!start || !end) return [];
    
    const tableNames = [];
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    
    // Loop through months from start to end
    let currentDate = new Date(startYear, startMonth, 1);
    while (currentDate <= end) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      
      // We'll fetch data for each month based on hierarchy, not by table name
      // This will be handled in the fetch function
      tableNames.push(`${year}-${month}`);
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return tableNames;
  };

  // Handle submit button click
  const handleSubmit = async () => {
    // Check if we have hierarchy selection
    if (!selectedDivision) {
      setError('Please select at least a division');
      return;
    }
    
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }
    
    if (startDate > endDate) {
      setError('Start date must be before end date');
      return;
    }
    
    // Clear all previous data
    setMonthlyData({});
    setCurrentTableData([]);
    setSummaryStats(null);
    setTotalArea(0); // Reset total area
    setError(null);
    
    // Generate month list
    const months = generateTableNames(startDate, endDate);
    setTableNames(months);
    
    if (months.length === 0) {
      setError('No months selected in the date range');
      return;
    }
    
    // Fetch data for all months with hierarchy filters
    await fetchFilteredData(months);
  };

  // New function to fetch total area and return it
  const fetchTotalAreaAndReturn = async (coupeName) => {
    setLoadingArea(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/api/get-coupe-area`,
        { tableName: coupeName },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km || 0;
        const areaValue = parseFloat(area);
        const finalArea = areaValue > 0 ? areaValue : 100;
        setTotalArea(finalArea);
        return finalArea;
      } else {
        setTotalArea(100);
        return 100;
      }
    } catch (err) {
      console.error('Error fetching area:', err);
      setTotalArea(100);
      return 100;
    } finally {
      setLoadingArea(false);
    }
  };

  // Helper function to fetch filtered degraded area
  const fetchFilteredDegradedArea = async (tableName) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/api/ndvi-change-degraded-area`,
        {
          tableName,
          division: selectedDivision,
          range: selectedRange,
          round: selectedRound,
          beat: selectedBeat
        },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km || 0;
        return parseFloat(area);
      }
      return 0;
    } catch (err) {
      console.error('Error fetching filtered degraded area:', err);
      return 0;
    }
  };

  // Helper function to fetch total area for a division
  const fetchDivisionTotalArea = async (coupeName) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/api/get-coupe-area`,
        { tableName: coupeName },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km || 0;
        return parseFloat(area) > 0 ? parseFloat(area) : 0;
      }
      return 0;
    } catch (err) {
      console.error('Error fetching division area:', err);
      return 0;
    }
  };

  // Simplified function to fetch data for all divisions separately
  const fetchAllDivisionsData = async (months) => {
    try {
      const token = localStorage.getItem("token");
      
      // First, get all divisions
      const divisionsRes = await axios.get(
        `${API_BASE_URL}/api/coupe-divisions`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const allDivisions = divisionsRes.data[0] || [];
      
      if (allDivisions.length === 0) {
        setError('No divisions found');
        return;
      }
      
      console.log(`Fetching data for ${allDivisions.length} divisions`);
      
      // Create a temporary object to store data per division per month
      const tempMonthlyData = {};
      
      // For each month, fetch data for each division separately
      for (const month of months) {
        let monthAllData = [];
        
        for (const division of allDivisions) {
          try {
            const divisionName = division.division;
            const coupeToUse = transformDivisionToCoupe(divisionName);
            
            if (!coupeToUse) continue;
            
            // Fetch total area for this division's coupe
            const divisionTotalArea = await fetchDivisionTotalArea(coupeToUse);
            
            if (divisionTotalArea <= 0) continue;
            
            // Construct table name for this month
            const tableName = `${month}-01_${coupeToUse}_NDVI_Change`;
            
            console.log(`Fetching data for division: ${divisionName}, month: ${month}`);
            
            // Fetch data with hierarchy filters (range/round/beat may be null)
            const dataResponse = await axios.post(
              `${API_BASE_URL}/api/ndvi-change-get-filtered`,
              {
                tableName,
                division: divisionName,
                range: selectedRange,
                round: selectedRound,
                beat: selectedBeat
              },
              { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
            );
            
            if (dataResponse.data.success) {
              const data = dataResponse.data.data;
              
              if (data.length > 0) {
                // Fetch degraded area for this division
                const degradedAreaResponse = await axios.post(
                  `${API_BASE_URL}/api/ndvi-change-degraded-area`,
                  {
                    tableName,
                    division: divisionName,
                    range: selectedRange,
                    round: selectedRound,
                    beat: selectedBeat
                  },
                  { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
                );
                
                const degradedAreaValue = degradedAreaResponse.data.success 
                  ? parseFloat(degradedAreaResponse.data.data[0]?.total_area_sq_km || 0)
                  : 0;
                
                const afforestedAreaValue = Math.max(0, divisionTotalArea - degradedAreaValue);
                
                // Count polygons by status
                const degradedPolygons = data.filter(item => item.status === true).length;
                const afforestedPolygons = data.filter(item => item.status === false).length;
                
                // Calculate area per polygon
                const degradedAreaPerPolygon = degradedPolygons > 0 ? degradedAreaValue / degradedPolygons : 0;
                const afforestedAreaPerPolygon = afforestedPolygons > 0 ? afforestedAreaValue / afforestedPolygons : 0;
                
                // Enhance data with area calculations and division info
                const enhancedData = data.map(item => {
                  const isDegraded = item.status === true;
                  const polygonArea = isDegraded ? degradedAreaPerPolygon : afforestedAreaPerPolygon;
                  
                  return {
                    ...item,
                    area_sq_km: polygonArea,
                    month: month,
                    division: divisionName,
                    status: isDegraded,
                    change_category: item.change_category || (isDegraded ? 'Degradation' : 'Afforestation'),
                    has_note: !!(item.note && item.note.trim() !== ''),
                    has_image: !!(item.image_data),
                    pixle_id: `${divisionName}_${item.pixle_id || 'N/A'}`
                  };
                });
                
                monthAllData = [...monthAllData, ...enhancedData];
              }
            }
          } catch (err) {
            console.error(`Error fetching data for division`);
          }
        }
        
        // If we have data for this month, store it with division information preserved
        if (monthAllData.length > 0) {
          // Group data by division for statistics
          const divisionsInMonth = [...new Set(monthAllData.map(item => item.division))];
          
          // Calculate statistics for each division separately
          const divisionStats = {};
          divisionsInMonth.forEach(div => {
            const divData = monthAllData.filter(item => item.division === div);
            const divDegradedArea = divData
              .filter(item => item.status === true)
              .reduce((sum, item) => sum + (item.area_sq_km || 0), 0);
            const divAfforestedArea = divData
              .filter(item => item.status === false)
              .reduce((sum, item) => sum + (item.area_sq_km || 0), 0);
            
            divisionStats[div] = {
              withNotes: divData.filter(item => item.has_note).length,
              withImages: divData.filter(item => item.has_image).length,
              degradedArea: divDegradedArea,
              afforestedArea: divAfforestedArea,
              totalArea: divDegradedArea + divAfforestedArea,
              totalPolygons: divData.length,
              degradedPercentage: (divDegradedArea + divAfforestedArea) > 0 
                ? (divDegradedArea / (divDegradedArea + divAfforestedArea)) * 100 
                : 0,
              afforestedPercentage: (divDegradedArea + divAfforestedArea) > 0 
                ? (divAfforestedArea / (divDegradedArea + divAfforestedArea)) * 100 
                : 0
            };
          });
          
          // Overall statistics (sum of all divisions)
          const totalDegradedArea = monthAllData
            .filter(item => item.status === true)
            .reduce((sum, item) => sum + (item.area_sq_km || 0), 0);
          const totalAfforestedArea = monthAllData
            .filter(item => item.status === false)
            .reduce((sum, item) => sum + (item.area_sq_km || 0), 0);
          const totalArea = totalDegradedArea + totalAfforestedArea;
          
          tempMonthlyData[month] = {
            data: monthAllData,
            divisionStats, // Store stats per division
            stats: {
              withNotes: monthAllData.filter(item => item.has_note).length,
              withImages: monthAllData.filter(item => item.has_image).length,
              degradedArea: totalDegradedArea,
              afforestedArea: totalAfforestedArea,
              totalArea: totalArea,
              totalPolygons: monthAllData.length,
              degradedPercentage: totalArea > 0 ? (totalDegradedArea / totalArea) * 100 : 0,
              afforestedPercentage: totalArea > 0 ? (totalAfforestedArea / totalArea) * 100 : 0
            },
            month: month
          };
        }
      }
      
      // Update state with all data (preserving division information)
      if (Object.keys(tempMonthlyData).length > 0) {
        setMonthlyData(tempMonthlyData);
        
        // Set total area as sum of all divisions' areas for the first month
        const firstMonth = Object.keys(tempMonthlyData).sort()[0];
        if (tempMonthlyData[firstMonth]) {
          setTotalArea(tempMonthlyData[firstMonth].stats.totalArea);
          setCurrentTableData(tempMonthlyData[firstMonth].data);
          setSummaryStats(tempMonthlyData[firstMonth].stats);
          setSelectedMonth(firstMonth);
        }
      } else {
        setError('No data found for any division with the selected criteria');
      }
      
    } catch (error) {
      console.error('Error fetching all divisions data:', error);
      setError('Failed to fetch data for all divisions');
    }
  };

  // Fetch filtered data based on hierarchy and date
  const fetchFilteredData = async (months) => {
    setLoading(true);
    setError(null);
    setMonthlyData({});
    setCurrentTableData([]);
    setSummaryStats(null);
    
    try {
      // Check if "All Divisions" is selected
      if (selectedDivision === 'all') {
        await fetchAllDivisionsData(months);
        setLoading(false);
        return;
      }
      
      const token = localStorage.getItem("token");
      
      // First, get the coupe name from division if not already set
      let coupeToUse = hierarchyCoupeName;
      if (!coupeToUse && selectedDivision) {
        coupeToUse = transformDivisionToCoupe(selectedDivision);
      }
      
      if (!coupeToUse) {
        setError('Could not determine coupe name');
        setLoading(false);
        return;
      }
      
      // Fetch total area for the coupe and wait for it
      const totalCoupeArea = await fetchTotalAreaAndReturn(coupeToUse);
      
      if (totalCoupeArea <= 0) {
        console.warn('Total area is zero or negative, using default value');
      }
      
      console.log('Total Coupe Area:', totalCoupeArea);
      
      // Create a temporary object to store all month data
      const tempMonthlyData = {};
      
      // For each month, fetch data filtered by hierarchy
      for (const month of months) {
        try {
          // Construct table name for this month
          const tableName = `${month}-01_${coupeToUse}_NDVI_Change`;
          
          console.log(`Fetching data for month: ${month}, table: ${tableName}`);
          
          // Fetch data with hierarchy filters
          const dataResponse = await axios.post(
            `${API_BASE_URL}/api/ndvi-change-get-filtered`,
            {
              tableName,
              division: selectedDivision,
              range: selectedRange,
              round: selectedRound,
              beat: selectedBeat
            },
            { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
          );
          
          if (dataResponse.data.success) {
            const data = dataResponse.data.data;
            
            if (data.length > 0) {
              // Fetch degraded area for this month with filters
              const degradedAreaValue = await fetchFilteredDegradedArea(tableName);
              
              // Calculate afforested area as total area minus degraded area
              const afforestedAreaValue = Math.max(0, totalCoupeArea - degradedAreaValue);
              
              console.log(`Month ${month}:`, {
                totalArea: totalCoupeArea,
                degradedArea: degradedAreaValue,
                afforestedArea: afforestedAreaValue
              });
              
              // Count polygons by status
              const degradedPolygons = data.filter(item => item.status === true).length;
              const afforestedPolygons = data.filter(item => item.status === false).length;
              
              // Calculate area per polygon (if there are polygons of that type)
              const degradedAreaPerPolygon = degradedPolygons > 0 ? degradedAreaValue / degradedPolygons : 0;
              const afforestedAreaPerPolygon = afforestedPolygons > 0 ? afforestedAreaValue / afforestedPolygons : 0;
              
              // Enhance data with area calculations
              const enhancedData = data.map(item => {
                const isDegraded = item.status === true;
                // Assign area based on status
                const polygonArea = isDegraded ? degradedAreaPerPolygon : afforestedAreaPerPolygon;
                
                return {
                  ...item,
                  area_sq_km: polygonArea,
                  month: month,
                  status: isDegraded,
                  change_category: item.change_category || (isDegraded ? 'Degradation' : 'Afforestation'),
                  has_note: !!(item.note && item.note.trim() !== ''),
                  has_image: !!(item.image_data),
                  pixle_id: item.pixle_id || 'N/A'
                };
              });
              
              // Calculate statistics using the actual values
              const stats = calculateStatistics(
                enhancedData, 
                totalCoupeArea, 
                degradedAreaValue, 
                afforestedAreaValue
              );
              
              // Store in temporary object
              tempMonthlyData[month] = {
                data: enhancedData,
                stats,
                month: month,
                degradedArea: degradedAreaValue,
                afforestedArea: afforestedAreaValue,
                totalArea: totalCoupeArea
              };
            }
          }
        } catch (err) {
          console.error(`Error fetching data for month`);
        }
      }
      
      // After all fetches are complete, update the state once with all data
      if (Object.keys(tempMonthlyData).length > 0) {
        setMonthlyData(tempMonthlyData);
        
        // Sort months chronologically
        const sortedMonths = Object.keys(tempMonthlyData).sort();
        const firstMonth = sortedMonths[0];
        
        // Set current month data to the first month in range
        if (tempMonthlyData[firstMonth]) {
          setCurrentTableData(tempMonthlyData[firstMonth].data);
          setSummaryStats(tempMonthlyData[firstMonth].stats);
          setSelectedMonth(firstMonth);
        }
      } else {
        setError('No data found for the selected criteria');
      }
      
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to fetch NDVI data';
      setError(errorMsg);
      console.error('Error fetching NDVI data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (newDate) => {
    if (newDate) {
      setSelectedDate(newDate);
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const formattedMonth = `${year}-${month}`;
      setSelectedMonth(formattedMonth);
      
      // Single month selection - only if we have data for that month
      if (monthlyData[formattedMonth]) {
        setCurrentTableData(monthlyData[formattedMonth].data);
        sortData(monthlyData[formattedMonth].data, sortConfig.key, sortConfig.direction);
        setSummaryStats(monthlyData[formattedMonth].stats);
      }
    }
  };

  // Handle start date change
  const handleStartDateChange = (newDate) => {
    setStartDate(newDate);
    setError(null);
  };

  // Handle end date change
  const handleEndDateChange = (newDate) => {
    setEndDate(newDate);
    setError(null);
  };

  // Fetch coupes
  useEffect(() => {
    const fetchCoupes = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${API_BASE_URL}/api/admincoupes`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        let apiCoupes = [];
        
        if (Array.isArray(res.data)) {
          apiCoupes = res.data.map(coupe => ({
            value: coupe.coupe_name || coupe.coupe_id || coupe.id,
            label: coupe.coupe_name || coupe.label || `Coupe ${coupe.coupe_id || ''}`
          }));
        } else if (res.data?.success && Array.isArray(res.data.data)) {
          apiCoupes = res.data.data.map(coupe => ({
            value: coupe.coupe_name || coupe.coupe_id || coupe.id,
            label: coupe.coupe_name || coupe.label || `Coupe ${coupe.coupe_id || ''}`
          }));
        }

        if (apiCoupes.length > 0) {
          setCoupeOptions(apiCoupes);
        }
      } catch (error) {
        console.error("Failed to fetch coupes from API:", error);
      }
    };

    fetchCoupes();
  }, []);

  // Fetch total area for selected coupe
  const fetchTotalArea = async (coupeName) => {
    setLoadingArea(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_BASE_URL}/api/get-coupe-area`,
        { tableName: coupeName },
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const area = response.data.data[0]?.total_area_sq_km || 0;
        const areaValue = parseFloat(area);
        setTotalArea(areaValue > 0 ? areaValue : 100);
      } else {
        setTotalArea(100);
      }
    } catch (err) {
      console.error('Error fetching area:', err);
      setTotalArea(100);
    } finally {
      setLoadingArea(false);
    }
  };

  // Calculate statistics - UPDATED with proper validation
  const calculateStatistics = (data, totalCoupeArea, degradedAreaValue, afforestedAreaValue) => {
    if (!data || data.length === 0) return null;

    const withNotes = data.filter(item => item.has_note).length;
    const withImages = data.filter(item => item.has_image).length;
    
    // Ensure total area is positive
    const totalCoupeAreaKm = Math.max(0.1, totalCoupeArea);
    
    // Ensure degraded area doesn't exceed total area
    const degradedAreaKm = Math.min(degradedAreaValue, totalCoupeAreaKm);
    
    // Calculate afforested area as total minus degraded
    const afforestedAreaKm = Math.max(0, totalCoupeAreaKm - degradedAreaKm);
    
    // Calculate percentages
    const degradedPercentage = totalCoupeAreaKm > 0 ? (degradedAreaKm / totalCoupeAreaKm) * 100 : 0;
    const afforestedPercentage = totalCoupeAreaKm > 0 ? (afforestedAreaKm / totalCoupeAreaKm) * 100 : 0;
    
    console.log('Statistics calculation:', {
      totalCoupeAreaKm,
      degradedAreaKm,
      afforestedAreaKm,
      degradedPercentage,
      afforestedPercentage,
      totalPolygons: data.length
    });
    
    return {
      withNotes,
      withImages,
      degradedArea: degradedAreaKm,
      afforestedArea: afforestedAreaKm,
      totalArea: totalCoupeAreaKm,
      totalPolygons: data.length,
      degradedPercentage,
      afforestedPercentage
    };
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
    return sorted;
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    sortData(currentTableData, key, direction);
  };

  // Handle coupe selection (optional direct selection)
  const handleCoupeChange = (event) => {
    const newCoupe = event.target.value;
    setSelectedCoupe(newCoupe);
    setSelectedDivision(null);
    setSelectedRange(null);
    setSelectedRound(null);
    setSelectedBeat(null);
    setHierarchyCoupeName(newCoupe);
    setMonthlyData({});
    setCurrentTableData([]);
    setSummaryStats(null);
    setTableNames([]);
    fetchTotalArea(newCoupe);
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
        (item.change_category?.toLowerCase().includes(searchLower)) ||
        (item.division?.toLowerCase().includes(searchLower));

      const matchesNotes = !showOnlyWithNotes || item.has_note;
      const matchesImages = !showOnlyWithImages || item.has_image;

      return matchesSearch && matchesNotes && matchesImages;
    });

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

  // Paginated data
  const paginatedData = React.useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, page, rowsPerPage]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setPage(0);
  }, [searchTerm, showOnlyWithNotes, showOnlyWithImages, sortConfig]);

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Prepare chart data
  const prepareMonthlyChartData = () => {
    const months = Object.keys(monthlyData).sort();
    const monthLabels = months.map(month => {
      const [year, monthNum] = month.split('-');
      const date = new Date(year, parseInt(monthNum) - 1, 1);
      return date.toLocaleString('default', { month: 'short' }) + ' ' + year;
    });
    
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
    const months = Object.keys(monthlyData).sort();
    const monthLabels = months.map(month => {
      const [year, monthNum] = month.split('-');
      const date = new Date(year, parseInt(monthNum) - 1, 1);
      return date.toLocaleString('default', { month: 'short' }) + ' ' + year;
    });
    
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

  // Chart options
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: !expandedChart,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: 'Monthly NDVI Change - Area Analysis',
        font: { size: 16, weight: 'bold' }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
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
          font: { weight: 'bold' }
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
          font: { weight: 'bold' }
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
        font: { size: 16, weight: 'bold' }
      }
    }
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: !expandedChart,
    plugins: {
      legend: { position: 'right' },
      title: {
        display: true,
        text: 'Area Distribution (Square Kilometers)',
        font: { size: 16, weight: 'bold' }
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
    if (Object.keys(monthlyData).length === 0) {
      return (
        <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No data available for the selected criteria
          </Typography>
        </Box>
      );
    }

    const chartData = {
      'bar': <Bar data={prepareMonthlyChartData()} options={barChartOptions} />,
      'line': <Line data={prepareAreaChartData()} options={lineChartOptions} />,
      'pie': <Pie data={preparePieChartData()} options={pieChartOptions} />
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
          {expandedChart ? <CloseFullscreen /> : <OpenInFull />}
        </IconButton>
      </Box>
    );
  };

  // Export to PDF
// Enhanced Export to PDF function
const handleExportToPDF = () => {
  try {
    // Check if there's data to export
    if (Object.keys(monthlyData).length === 0) {
      alert('No data available to export');
      return;
    }

    // Get current date for filename and report
    const now = new Date();
    const dateStr = now.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'medium'
    });
    
    const filename = `NDVI_Report_${selectedDivision === 'all' ? 'All_Divisions' : (selectedDivision || 'NDVI')}_${now.toISOString().slice(0,10)}`;
    
    // Determine the scope of the report
    const reportScope = selectedDivision === 'all' ? 'All Forest Divisions' : 
                       (selectedDivision ? `${selectedDivision} Division` : 
                       (selectedCoupe ? selectedCoupe : 'Selected Area'));
    
    // Create the HTML content for PDF
    const printWindow = window.open('', '_blank');
    
    // Write the HTML document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NDVI Change Report - ${reportScope}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 40px; 
              color: #1e293b; 
              line-height: 1.6;
              background: #f8fafc;
            }
            
            .report-container {
              max-width: 1400px;
              margin: 0 auto;
              background: white;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              border-radius: 16px;
              padding: 40px;
            }
            
            .header { 
              text-align: center; 
              border-bottom: 3px solid #2563eb; 
              padding-bottom: 25px; 
              margin-bottom: 30px; 
              background: linear-gradient(to right, #1e3c72, #2a5298);
              margin: -40px -40px 30px -40px;
              padding: 40px 40px 25px 40px;
              border-radius: 16px 16px 0 0;
              color: white;
            }
            
            h1 { 
              color: white; 
              margin-bottom: 10px; 
              font-size: 32px;
              font-weight: 700;
              letter-spacing: 1px;
            }
            
            .header .subtitle { 
              color: rgba(255,255,255,0.9); 
              font-size: 16px;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin: 30px 0;
              background: #f1f5f9;
              padding: 25px;
              border-radius: 12px;
            }
            
            .info-item {
              padding: 10px;
              border-left: 4px solid #2563eb;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            
            .info-label {
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .info-value {
              font-size: 18px;
              font-weight: 600;
              color: #1e293b;
            }
            
            .summary-card { 
              background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); 
              color: white; 
              padding: 30px; 
              border-radius: 16px; 
              margin: 30px 0; 
              box-shadow: 0 10px 30px rgba(37, 99, 235, 0.3); 
            }
            
            .stats-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
              gap: 25px; 
              margin: 25px 0; 
            }
            
            .stat-card { 
              background: white; 
              border: 1px solid #e2e8f0; 
              border-radius: 12px; 
              padding: 20px; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
              transition: transform 0.2s;
            }
            
            .stat-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 12px rgba(0,0,0,0.1);
            }
            
            .stat-card.degraded { 
              border-left: 6px solid #ef4444; 
            }
            
            .stat-card.afforested { 
              border-left: 6px solid #22c55e; 
            }
            
            .stat-card.total { 
              border-left: 6px solid #3b82f6; 
            }
            
            .stat-label {
              font-size: 14px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 10px;
            }
            
            .stat-value { 
              font-size: 32px; 
              font-weight: 700; 
              margin: 10px 0;
              line-height: 1.2;
            }
            
            .stat-unit {
              font-size: 14px;
              color: #94a3b8;
              margin-left: 5px;
            }
            
            .stat-percentage {
              font-size: 14px;
              color: #64748b;
              background: #f1f5f9;
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
            }
            
            h2 {
              color: #1e293b;
              font-size: 24px;
              font-weight: 600;
              margin: 30px 0 20px 0;
              padding-bottom: 10px;
              border-bottom: 2px solid #e2e8f0;
            }
            
            h3 {
              color: #334155;
              font-size: 18px;
              font-weight: 600;
              margin: 20px 0 15px 0;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0; 
              font-size: 13px; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            
            th { 
              background-color: #1e293b; 
              color: white; 
              padding: 12px 15px; 
              text-align: left; 
              font-weight: 600;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            td { 
              padding: 12px 15px; 
              border-bottom: 1px solid #e2e8f0; 
              color: #334155;
            }
            
            tr:last-child td {
              border-bottom: none;
            }
            
            tr:nth-child(even) { 
              background-color: #f8fafc; 
            }
            
            tr:hover {
              background-color: #f1f5f9;
            }
            
            .badge { 
              padding: 4px 12px; 
              border-radius: 20px; 
              font-size: 11px; 
              font-weight: 600; 
              display: inline-block;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .badge-degraded { 
              background-color: #fee2e2; 
              color: #dc2626; 
            }
            
            .badge-afforested { 
              background-color: #dcfce7; 
              color: #16a34a; 
            }
            
            .badge-note {
              background-color: #dbeafe;
              color: #2563eb;
            }
            
            .badge-image {
              background-color: #fef3c7;
              color: #d97706;
            }
            
            .monthly-summary {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              gap: 15px;
              margin: 20px 0;
            }
            
            .month-card {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 15px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            
            .month-title {
              font-size: 14px;
              font-weight: 600;
              color: #2563eb;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 1px dashed #e2e8f0;
            }
            
            .month-stat {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-size: 12px;
            }
            
            .progress-bar {
              width: 100%;
              height: 8px;
              background: #e2e8f0;
              border-radius: 4px;
              margin: 10px 0;
              overflow: hidden;
            }
            
            .progress-fill {
              height: 100%;
              background: linear-gradient(90deg, #22c55e, #16a34a);
              border-radius: 4px;
            }
            
            .progress-fill.degraded {
              background: linear-gradient(90deg, #ef4444, #dc2626);
            }
            
            .footer { 
              margin-top: 40px; 
              padding-top: 25px; 
              border-top: 2px solid #e2e8f0; 
              font-size: 12px; 
              color: #64748b; 
              text-align: center;
              background: #f8fafc;
              border-radius: 12px;
              padding: 25px;
            }
            
            .watermark {
              position: fixed;
              bottom: 20px;
              right: 20px;
              opacity: 0.1;
              font-size: 60px;
              font-weight: bold;
              color: #2563eb;
              pointer-events: none;
              z-index: 1000;
            }
            
            @media print { 
              body { 
                background: white; 
                padding: 0; 
              }
              .report-container {
                box-shadow: none;
                padding: 20px;
              }
              .header {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              th {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .summary-card {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          
          
          <div class="report-container">
            <!-- Header -->
            <div class="header">
              <h1>🌲 Forest Cover Change Monitoring System</h1>
              <div class="subtitle">NDVI Change Analysis Report - Multi-Month Analysis</div>
            </div>
            
            <!-- Report Information -->
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Division</div>
                <div class="info-value">${selectedDivision === 'all' ? 'All Divisions' : (selectedDivision || 'N/A')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Range / Round / Beat</div>
                <div class="info-value">${selectedRange || 'All'} / ${selectedRound || 'All'} / ${selectedBeat || 'All'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Date Range</div>
                <div class="info-value">${startDate ? startDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''} - ${endDate ? endDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Months Analyzed</div>
                <div class="info-value">${tableNames.length}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Generated On</div>
                <div class="info-value">${dateStr}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Report ID</div>
                <div class="info-value">FPMS-${Date.now().toString().slice(-8)}</div>
              </div>
            </div>
            
            <!-- Executive Summary -->
            <div class="summary-card">
              <h2 style="color: white; margin-top: 0; border-bottom-color: rgba(255,255,255,0.2);">📊 Executive Summary</h2>
              <p style="color: rgba(255,255,255,0.9); margin-bottom: 20px;">
                This report provides a comprehensive analysis of forest cover changes based on NDVI (Normalized Difference Vegetation Index) 
                satellite data for the period ${startDate ? startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ''} 
                to ${endDate ? endDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ''}.
              </p>
              
              ${summaryStats ? `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px;">
                  <div style="text-align: center;">
                    <div style="font-size: 14px; opacity: 0.9;">Total Area Monitored</div>
                    <div style="font-size: 36px; font-weight: 700;">${totalArea.toFixed(2)}</div>
                    <div style="font-size: 14px; opacity: 0.9;">km²</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 14px; opacity: 0.9;">Net Change (Latest)</div>
                    <div style="font-size: 36px; font-weight: 700; color: ${summaryStats.afforestedArea > summaryStats.degradedArea ? '#86efac' : '#fca5a5'};">
                      ${(summaryStats.afforestedArea - summaryStats.degradedArea).toFixed(2)}
                    </div>
                    <div style="font-size: 14px; opacity: 0.9;">km²</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 14px; opacity: 0.9;">Total Records</div>
                    <div style="font-size: 36px; font-weight: 700;">${summaryStats.totalPolygons}</div>
                    <div style="font-size: 14px; opacity: 0.9;">polygons</div>
                  </div>
                </div>
              ` : ''}
            </div>
            
            <!-- Key Statistics for Latest Month -->
            ${summaryStats ? `
              <h2>📈 Key Statistics - ${selectedMonth} (Latest Month)</h2>
              <div class="stats-grid">
                <div class="stat-card degraded">
                  <div class="stat-label">Degraded Area</div>
                  <div class="stat-value">${summaryStats.degradedArea.toFixed(2)}<span class="stat-unit">km²</span></div>
                  <div class="stat-percentage">${summaryStats.degradedPercentage.toFixed(2)}% of total area</div>
                </div>
                
                <div class="stat-card afforested">
                  <div class="stat-label">Afforested Area</div>
                  <div class="stat-value">${summaryStats.afforestedArea.toFixed(2)}<span class="stat-unit">km²</span></div>
                  <div class="stat-percentage">${summaryStats.afforestedPercentage.toFixed(1)}% of total area</div>
                </div>
                
                <div class="stat-card total">
                  <div class="stat-label">Total Area</div>
                  <div class="stat-value">${totalArea.toFixed(2)}<span class="stat-unit">km²</span></div>
                  <div class="stat-percentage">Complete coverage</div>
                </div>
                
                <div class="stat-card total">
                  <div class="stat-label">Data Quality</div>
                  <div class="stat-value">${summaryStats.withNotes}<span class="stat-unit">notes</span></div>
                  <div class="stat-value" style="font-size: 20px;">${summaryStats.withImages}<span class="stat-unit">images</span></div>
                </div>
              </div>
            ` : ''}
            
            <!-- Division-wise Breakdown (if All Divisions) -->
            ${selectedDivision === 'all' && monthlyData[selectedMonth]?.divisionStats ? `
              <h2>🏢 Division-wise Breakdown - ${selectedMonth}</h2>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin: 20px 0;">
                ${Object.entries(monthlyData[selectedMonth].divisionStats).map(([division, stats]) => `
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px;">
                    <h3 style="margin: 0 0 15px 0; color: #2563eb; font-size: 16px; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
                      ${division}
                    </h3>
                    <div style="margin-bottom: 15px;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #ef4444; font-size: 13px;">Degraded</span>
                        <span style="font-weight: 600;">${stats.degradedArea.toFixed(2)} km²</span>
                      </div>
                      <div class="progress-bar">
                        <div class="progress-fill degraded" style="width: ${stats.degradedPercentage}%;"></div>
                      </div>
                      
                      <div style="display: flex; justify-content: space-between; margin: 10px 0 5px;">
                        <span style="color: #22c55e; font-size: 13px;">Afforested</span>
                        <span style="font-weight: 600;">${stats.afforestedArea.toFixed(2)} km²</span>
                      </div>
                      <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.afforestedPercentage}%;"></div>
                      </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                      <span>📝 Notes: ${stats.withNotes}</span>
                      <span>🖼️ Images: ${stats.withImages}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <!-- Monthly Comparison -->
            <h2>📅 Monthly Comparison Overview</h2>
            <div class="monthly-summary">
              ${Object.entries(monthlyData).sort().reverse().map(([month, data]) => `
                <div class="month-card">
                  <div class="month-title">${month}</div>
                  <div class="month-stat">
                    <span>Degraded:</span>
                    <span style="color: #ef4444; font-weight: 600;">${data.stats.degradedArea.toFixed(2)} km²</span>
                  </div>
                  <div class="month-stat">
                    <span>Afforested:</span>
                    <span style="color: #22c55e; font-weight: 600;">${data.stats.afforestedArea.toFixed(2)} km²</span>
                  </div>
                  <div class="month-stat">
                    <span>Net Change:</span>
                    <span style="color: ${data.stats.afforestedArea > data.stats.degradedArea ? '#22c55e' : '#ef4444'}; font-weight: 600;">
                      ${(data.stats.afforestedArea - data.stats.degradedArea).toFixed(2)} km²
                    </span>
                  </div>
                  <div class="month-stat">
                    <span>Records:</span>
                    <span>${data.data.length}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <!-- Detailed Data Table -->
            <h2>🔍 Detailed Data Sample (Latest Month - First 20 Records)</h2>
            <table>
              <thead>
                <tr>
                  ${showDivisionColumn ? '<th>Division</th>' : ''}
                  <th>Status</th>
                  <th>NDVI Change</th>
                  <th>Category</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Area (km²)</th>
                  <th>Note</th>
                  <th>Image</th>
                </tr>
              </thead>
              <tbody>
                ${filteredData.slice(0, 20).map(item => `
                  <tr>
                    ${showDivisionColumn ? `<td>${item.division || selectedDivision || 'N/A'}</td>` : ''}
                    <td><span class="badge ${item.status ? 'badge-afforested' : 'badge-degraded'}">${item.status ? 'Afforested' : 'Degraded'}</span></td>
                    <td>${item.NDVI_change?.toFixed(4) || 'N/A'}</td>
                    <td>${item.change_category || (item.status ? 'Afforestation' : 'Degradation')}</td>
                    <td>${item.latitude?.toFixed(6) || 'N/A'}</td>
                    <td>${item.longitude?.toFixed(6) || 'N/A'}</td>
                    <td>${item.area_sq_km?.toFixed(6) || '0.000000'}</td>
                    <td>${item.has_note ? 
                      '<span class="badge badge-note">✓ Note</span>' : 
                      '<span style="color: #94a3b8;">—</span>'
                    }</td>
                    <td>${item.has_image ? 
                      '<span class="badge badge-image">📸 Image</span>' : 
                      '<span style="color: #94a3b8;">—</span>'
                    }</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            
            
            <!-- Monthly Trend Data -->
            <h2>📈 Monthly Trend Analysis</h2>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Degraded Area (km²)</th>
                  <th>Afforested Area (km²)</th>
                  <th>Degraded %</th>
                  <th>Afforested %</th>
                  <th>Net Change (km²)</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(monthlyData).sort().reverse().map(([month, data]) => {
                  const netChange = data.stats.afforestedArea - data.stats.degradedArea;
                  return `
                    <tr>
                      <td><strong>${month}</strong></td>
                      <td style="color: #ef4444;">${data.stats.degradedArea.toFixed(2)}</td>
                      <td style="color: #22c55e;">${data.stats.afforestedArea.toFixed(2)}</td>
                      <td>${data.stats.degradedPercentage.toFixed(1)}%</td>
                      <td>${data.stats.afforestedPercentage.toFixed(1)}%</td>
                      <td style="color: ${netChange >= 0 ? '#22c55e' : '#ef4444'}; font-weight: 600;">
                        ${netChange.toFixed(2)}
                      </td>
                      <td>${data.stats.totalPolygons}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background: #1e293b; color: white; font-weight: 600;">
                  <td colspan="7" style="text-align: center;">
                    Total Months Analyzed: ${Object.keys(monthlyData).length} | 
                    Date Range: ${startDate ? startDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''} - 
                    ${endDate ? endDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}
                  </td>
                </tr>
              </tfoot>
            </table>
            
            
            
            <!-- Footer -->
            <div class="footer">
              <p style="margin: 5px 0; font-size: 14px; font-weight: 600;">FOREST PATROLLING & MONITORING SYSTEM</p>
              <p style="margin: 5px 0;">© ${new Date().getFullYear()} Gujarat Forest Department | All Rights Reserved</p>
              <p style="margin: 5px 0;">Data Source: Sentinel-2 NDVI Satellite Analysis | Report Generated Automatically</p>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              // Auto-print and close after printing
              setTimeout(function() {
                window.print();
                setTimeout(function() { 
                  window.close(); 
                }, 1000);
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
  } catch (error) {
    console.error('Error generating PDF report:', error);
    alert('Failed to generate PDF report. Please try again.');
  }
};

  // Refresh data
  const handleRefresh = () => {
    if (tableNames.length > 0) {
      fetchFilteredData(tableNames);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }}>
      {/* Header */}
      <Card sx={{ mb: 4, bgcolor: 'transparent', color: 'black', borderRadius: 3, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        <CardContent>
          <Grid container alignItems="center" spacing={3}>
            <Grid item>
              <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            </Grid>
            <Grid item>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<PictureAsPdf />}
                  onClick={handleExportToPDF}
                  disabled={Object.keys(monthlyData).length === 0}
                  sx={{ borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  Export PDF
                </Button>
                
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Hierarchy Navigation */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.05)', bgcolor: "transparent" }}>
        <CardHeader 
          title="Forest Hierarchy Navigation"
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          avatar={<Forest />}
        />
        <NDVIMyCoups_dropdown onHierarchyChange={handleHierarchyChange} />
      </Card>

      {/* Main Filters */}
      <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.05)', bgcolor: "transparent" }}>
        <CardContent>
  <Grid container spacing={3}>
{/* Date Range Selection */}
<Grid item xs={12}>
  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
    Select Date Range
    {selectedDivision === 'all' 
      ? ' (Maximum 6 months for All Divisions)' 
      : ' (Maximum 12 months)'}
  </Typography>
</Grid>

<Grid item xs={12} md={5}>
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    <DatePicker
      views={['year', 'month']}
      label="Start Date"
      value={startDate}
      onChange={handleStartDateChange}
      minDate={new Date(2020, 0, 1)}
      maxDate={endDate ? new Date(Math.min(
        new Date(2030, 11, 31).getTime(),
        new Date(endDate.getFullYear(), endDate.getMonth() - (selectedDivision === 'all' ? 5 : 11), 1).getTime()
      )) : new Date(2030, 11, 31)}
      slotProps={{
        textField: {
          fullWidth: true,
          size: "small",
          InputProps: {
            startAdornment: <CalendarMonth sx={{ mr: 1, color: 'primary.main' }} />
          }
        }
      }}
    />
  </LocalizationProvider>
</Grid>

<Grid item xs={12} md={5}>
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    <DatePicker
      views={['year', 'month']}
      label="End Date"
      value={endDate}
      onChange={handleEndDateChange}
      minDate={startDate || new Date(2020, 0, 1)}
      maxDate={startDate ? new Date(Math.min(
        new Date(2030, 11, 31).getTime(),
        new Date(startDate.getFullYear(), startDate.getMonth() + (selectedDivision === 'all' ? 5 : 11), 1).getTime()
      )) : new Date(2030, 11, 31)}
      slotProps={{
        textField: {
          fullWidth: true,
          size: "small",
          InputProps: {
            startAdornment: <CalendarMonth sx={{ mr: 1, color: 'primary.main' }} />
          }
        }
      }}
    />
  </LocalizationProvider>
</Grid>

<Grid item xs={12} md={2}>
  <Button
    variant="contained"
    color="primary"
    fullWidth
    startIcon={<Send />}
    onClick={handleSubmit}
    disabled={!startDate || !endDate || (() => {
      if (!startDate || !endDate) return true;
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth());
      const maxAllowed = selectedDivision === 'all' ? 6 : 12;
      return monthsDiff > maxAllowed;
    })()}
    sx={{ borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', height: '40px' }}
  >
    Submit
  </Button>
</Grid>

{/* Error message for range exceeding limits */}
{startDate && endDate && (() => {
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                    (endDate.getMonth() - startDate.getMonth());
  
  const maxAllowed = selectedDivision === 'all' ? 6 : 12;
  
  if (monthsDiff > maxAllowed) {
    return (
      <Grid item xs={12}>
        <Alert severity="error" sx={{ mt: 1 }}>
          {selectedDivision === 'all' 
            ? 'For "All Divisions", date range cannot exceed 6 months. Please select a shorter range.'
            : 'Date range cannot exceed 12 months. Please select a shorter range.'}
        </Alert>
      </Grid>
    );
  }
  return null;
})()}
  </Grid>
</CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
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
                   'Loading NDVI change data for multiple months...'}
                </Typography>
                <MuiLinearProgress sx={{ mt: 1 }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Area Information */}
      {totalArea > 0 && (
        <Card sx={{ mb: 4, borderRadius: 3, background: 'transparent', color: 'black', boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)' }}>
          <CardContent>
            <Box sx={{ mb: 4 }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Select Month</InputLabel>
                <Select
                  value={selectedMonth}
                  onChange={(e) => {
                    const month = e.target.value;
                    setSelectedMonth(month);
                    if (monthlyData[month]) {
                      setCurrentTableData(monthlyData[month].data);
                      setSummaryStats(monthlyData[month].stats);
                    }
                  }}
                  label="Select Month"
                >
                  {Object.keys(monthlyData).sort().reverse().map((month) => (
                    <MenuItem key={month} value={month}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculate sx={{ fontSize: 36 }} />
                </Box>
              </Grid>
              
              <Grid item xs>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                  Area Analysis - {selectedDivision === 'all' ? 'All Divisions' : (selectedDivision || selectedCoupe || hierarchyCoupeName)}
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Box>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        Total Area
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        {totalArea.toFixed(2)} km²
                      </Typography>
                    </Box>
                  </Grid>
                  {summaryStats && (
                    <>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            Afforested Area (Latest)
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#22c55e' }}>
                            {summaryStats.afforestedArea.toFixed(2)} km²
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            Degraded Area (Latest)
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#ef4444' }}>
                            {summaryStats.degradedArea.toFixed(2)} km²
                          </Typography>
                        </Box>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      

      {/* Summary Cards - Show only if data is available */}
      {summaryStats && !loading && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 3, borderLeft: '6px solid #ef4444', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.1)', height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 600 }}>
                      Degraded Area (Latest)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#ef4444' }}>
                      {summaryStats.degradedArea.toFixed(2)}
                      <Typography component="span" variant="body1" sx={{ ml: 0.5, color: 'text.secondary' }}>
                        km²
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {summaryStats.degradedPercentage.toFixed(2)}% of total area
                    </Typography>
                  </Box>
                  <Warning sx={{ fontSize: 40, color: '#ef4444', opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 3, borderLeft: '6px solid #22c55e', boxShadow: '0 8px 24px rgba(34, 197, 94, 0.1)', height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 600 }}>
                      Afforested Area (Latest)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#22c55e' }}>
                      {summaryStats.afforestedArea.toFixed(2)}
                      <Typography component="span" variant="body1" sx={{ ml: 0.5, color: 'text.secondary' }}>
                        km²
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {summaryStats.afforestedPercentage.toFixed(2)}% of total area
                    </Typography>
                  </Box>
                  <CheckCircle sx={{ fontSize: 40, color: '#22c55e', opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderRadius: 3, borderLeft: '6px solid #3b82f6', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.1)', height: '100%' }}>
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
            <Card sx={{ borderRadius: 3, borderLeft: '6px solid #f59e0b', boxShadow: '0 8px 24px rgba(245, 158, 11, 0.1)', height: '100%' }}>
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

            {/* Division-wise Summary - Show only when All Divisions is selected */}
      {selectedDivision === 'all' && summaryStats && monthlyData[selectedMonth]?.divisionStats && (
        <Card sx={{ mb: 4, borderRadius: 3, bgcolor: 'transparent' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Info color="primary" />
              Division-wise Breakdown - {selectedMonth}
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(monthlyData[selectedMonth].divisionStats).map(([division, stats]) => (
                <Grid item xs={12} sm={6} md={4} key={division}>
                  <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ color: 'primary.main' }}>
                        {division}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600 }}>
                          Degraded: {stats.degradedArea.toFixed(2)} km²
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600 , paddingLeft: '20px' }}>
                          Afforested: {stats.afforestedArea.toFixed(2)} km²
                        </Typography>
                      </Box>
                      {/* <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Deg %: {stats.degradedPercentage.toFixed(1)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Aff %: {stats.afforestedPercentage.toFixed(1)}%
                        </Typography>
                      </Box> */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          Notes: {stats.withNotes}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Images: {stats.withImages}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* ===== SECTION 1: CHARTS & ANALYSIS ===== */}
      

      {/* ===== SECTION 2: DATA TABLE ===== */}
      {Object.keys(monthlyData).length > 0 && (
        <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', bgcolor: "transparent" }}>
          <CardHeader
            title="1. Detailed Data Table"
            titleTypographyProps={{ variant: 'h5', fontWeight: 700 }}
            avatar={<Visibility color="primary" />}
            action={
              <IconButton onClick={() => toggleSection('dataTable')}>
                {expandedSections.dataTable ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            }
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          />
          
          {expandedSections.dataTable && (
            <CardContent>
              {/* Search and Filter Controls */}
              <Card sx={{ mb: 3, borderRadius: 2, bgcolor: 'transparent' }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        placeholder="Search by ID, status, coordinates, notes, division..."
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
<Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
  <FormGroup row>
    {selectedDivision === 'all' && (
      <FormControlLabel
        control={
          <Checkbox
            checked={showDivisionColumn}
            onChange={(e) => setShowDivisionColumn(e.target.checked)}
            color="primary"
            size="small"
          />
        }
        label="Show Division Column"
      />
    )}
    
    <FormControlLabel
      control={
        <Checkbox
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
        <Checkbox
          checked={showOnlyWithImages}
          onChange={(e) => setShowOnlyWithImages(e.target.checked)}
          color="primary"
          size="small"
        />
      }
      label="Only with Images"
    />
  </FormGroup>
  
  <Button
    variant="outlined"
    size="small"
    startIcon={<FilterList />}
    onClick={() => {
      setSearchTerm('');
      setShowOnlyWithNotes(false);
      setShowOnlyWithImages(false);
      setShowDivisionColumn(false);
    }}
    sx={{ borderRadius: 2 }}
  >
    CLEAR FILTERS
  </Button>
</Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Data Table */}
              <Paper sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', bgcolor:'transparent' }}>
                <TableContainer sx={{ maxHeight: 500, position: 'relative' }}>
                  <Table stickyHeader size="small" sx={{ minWidth: 1200 }}>
                    <TableHead>
                      <TableRow>
                        {showDivisionColumn && (
                          <TableCell onClick={() => handleSort('division')} sx={{ cursor: 'pointer' }}>
                            <Box display="flex" alignItems="center">
                              <strong>Division</strong>
                              <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                            </Box>
                          </TableCell>
                        )}
                        {/* <TableCell onClick={() => handleSort('status')} sx={{ cursor: 'pointer' }}>
                          <Box display="flex" alignItems="center">
                            <strong>Status</strong>
                            <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                          </Box>
                        </TableCell> */}
                        <TableCell><strong>NDVI Change</strong></TableCell>
                        <TableCell><strong>Category</strong></TableCell>
                        <TableCell><strong>Location</strong></TableCell>
                        <TableCell><strong>Area (km²)</strong></TableCell>
                        <TableCell onClick={() => handleSort('has_note')} sx={{ cursor: 'pointer' }}>
                          <Box display="flex" alignItems="center">
                            <strong>Has Note</strong>
                            <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                          </Box>
                        </TableCell>
                        <TableCell onClick={() => handleSort('has_image')} sx={{ cursor: 'pointer' }}>
                          <Box display="flex" alignItems="center">
                            <strong>Has Image</strong>
                            <Sort sx={{ fontSize: 16, ml: 0.5 }} />
                          </Box>
                        </TableCell>
                        <TableCell><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showDivisionColumn ? 10 : 9} align="center" sx={{ py: 6 }}>
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
                        paginatedData.map((row) => (
                          <TableRow key={row.pixle_id} hover>
                            {showDivisionColumn && (
                              <TableCell>
                                <Typography variant="body2" fontWeight={600} color="primary">
                                  {row.division || 'N/A'}
                                </Typography>
                              </TableCell>
                            )}
                            {/* <TableCell>
                              <Chip
                                label={row.status ? 'Afforested' : 'Degraded'}
                                color={row.status ? 'success' : 'error'} 
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell> */}
                            <TableCell>
                              <Chip
                                label={row.NDVI_change ? row.NDVI_change.toFixed(4) : 'N/A'}
                                color={row.NDVI_change < 0 ? 'error' : 'success'}
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
                                {row.change_category || (row.status ? 'Degradation' : 'Afforestation')}
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
                                {row.area_sq_km?.toFixed(6) || '0.000000'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {row.has_note ? (
                                <MuiTooltip title={row.note || 'Note available'}>
                                  <Chip label="Yes" color="primary" size="small" icon={<Note />} />
                                </MuiTooltip>
                              ) : (
                                <Chip label="No" color="default" size="small" variant="outlined" />
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
                                <Chip label="No" color="default" size="small" variant="outlined" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Visibility />}
                                onClick={() => {
                                  setSelectedRecord(row);
                                  setModalOpen(true);
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
                
                {/* Pagination */}
                {filteredData.length > 0 && (
                  <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, filteredData.length)} of {filteredData.length.toLocaleString()} records
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Select
                        value={rowsPerPage}
                        onChange={handleChangeRowsPerPage}
                        size="small"
                        sx={{ minWidth: 80 }}
                      >
                        {rowsPerPageOptions.map(option => (
                          <MenuItem key={option} value={option}>{option}</MenuItem>
                        ))}
                      </Select>
                      <Box display="flex" gap={1}>
                        <Button size="small" onClick={() => setPage(page - 1)} disabled={page === 0}>
                          Previous
                        </Button>
                        <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                          Page {page + 1} of {Math.ceil(filteredData.length / rowsPerPage)}
                        </Typography>
                        <Button size="small" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(filteredData.length / rowsPerPage) - 1}>
                          Next
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Paper>
            </CardContent>
          )}
        </Card>
      )}

      {/* ===== SECTION 3: MONTHLY OVERVIEW ===== */}
      {Object.keys(monthlyData).length > 0 && (
        <Card sx={{ mb: 4, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', bgcolor: "transparent" }}>
          <CardHeader
            title="2. Monthly Overview"
            titleTypographyProps={{ variant: 'h5', fontWeight: 700 }}
            avatar={<CalendarMonth color="primary" />}
            action={
              <IconButton onClick={() => toggleSection('monthlyOverview')}>
                {expandedSections.monthlyOverview ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            }
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          />
          
          {expandedSections.monthlyOverview && (
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* <CalendarMonth color="primary" /> */}
                 {selectedDivision === 'all' && '(All Divisions)'}
              </Typography>
              <Grid container spacing={3}>
                {Object.entries(monthlyData).sort().reverse().map(([month, data]) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={month}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        borderRadius: 3,
                        border: selectedMonth === month ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 24px rgba(0,0,0,0.1)'
                        },
                        bgcolor: 'transparent',
                      }}
                      onClick={() => {
                        setSelectedMonth(month);
                        setCurrentTableData(data.data);
                        setSummaryStats(data.stats);
                        // Scroll to charts section
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: 'black' }}>
                          {month}
                        </Typography>
                        {data.stats && (
                          <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                              <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 600 }}>
                                Degraded: {data.stats.degradedArea?.toFixed(2)} km²
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 600, paddingLeft: '20px' }}>
                                Afforested: {data.stats.afforestedArea?.toFixed(2)} km²
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                                Δ: {(data.stats.afforestedArea - data.stats.degradedArea).toFixed(2)} km²
                              </Typography>
                              <Typography variant="caption" sx={{ 
                                color: data.stats.afforestedArea > data.stats.degradedArea ? '#22c55e' : '#ef4444',
                                fontWeight: 600
                              }}>
                                {data.stats.afforestedArea > data.stats.degradedArea ? '↑ Positive' : '↓ Negative'}
                              </Typography>
                            </Box>
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Records: {data.data.length}
                              </Typography>
                              {selectedDivision === 'all' && data.divisionStats && (
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Divisions: {Object.keys(data.divisionStats).length}
                                </Typography>
                              )}
                            </Box>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          )}
        </Card>
      )}



      {/* Record Detail Modal */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              <Visibility sx={{ mr: 1, verticalAlign: 'middle' }} />
              Pixel Details - ID: {selectedRecord?.pixle_id}
            </Typography>
            <IconButton onClick={() => setModalOpen(false)} sx={{ color: 'white' }}>
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
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Info color="primary" />
                      NDVI Change Information
                    </Typography>
                    <Grid container spacing={2}>
                      {/* <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Status:</strong> 
                          <Chip label={selectedRecord.status ? 'Afforested' : 'Degraded'} 
                                color={selectedRecord.status ? 'success' : 'error'} size="small" sx={{ ml: 1 }} />
                        </Typography>
                      </Grid> */}
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Category:</strong> {selectedRecord.change_category || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>NDVI Change:</strong> {selectedRecord.NDVI_change?.toFixed(4) || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Area:</strong> {selectedRecord.area_sq_km?.toFixed(6) || 'N/A'} km²
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Map color="primary" />
                      Geographic Information
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.light' }}><Map /></Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Coordinates"
                          secondary={
                            <>
                              <Typography variant="body2">Lat: {selectedRecord.latitude?.toFixed(6) || 'N/A'}</Typography>
                              <Typography variant="body2">Lon: {selectedRecord.longitude?.toFixed(6) || 'N/A'}</Typography>
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
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Note color="primary" />
                      Additional Information
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'warning.light' }}><Note /></Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary="Notes"
                          secondary={selectedRecord.note || 'No additional notes'}
                        />
                      </ListItem>
                      {selectedRecord.image_data && (
                        <ListItem>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'info.light' }}><ImageIcon /></Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary="Image Available"
                            secondary={
                              <Typography color="primary" sx={{ cursor: 'pointer' }} onClick={() => setImageModalOpen(true)}>
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
            </Grid>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={imageModalOpen} onClose={() => setImageModalOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              <ImageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Image Preview - Pixel ID: {selectedRecord?.pixle_id}
            </Typography>
            <IconButton onClick={() => setImageModalOpen(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedRecord?.image_data ? (
            <Box display="flex" justifyContent="center" sx={{ minHeight: '60vh' }}>
              <Box
                component="img"
                src={`data:image/jpeg;base64,${selectedRecord.image_data}`}
                alt={`NDVI Image - Pixel ${selectedRecord.pixle_id}`}
                sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </Box>
          ) : (
            <Box textAlign="center" py={8}>
              <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">No Image Available</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Box sx={{ mt: 6, pt: 4, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <strong>FOREST PATROLLING & MONITORING SYSTEM</strong> © {new Date().getFullYear()} | 
          Data Source: Sentinel-2 Satellite NDVI Analysis
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          <strong>Note:</strong> All area measurements are in square kilometers (km²). 
          Afforested area is calculated as (Total Coupe Area - Degraded Area from NDVI analysis).
        </Typography>
      </Box>
    </Container>
  );
};

export default NDVIChangeDashboard;