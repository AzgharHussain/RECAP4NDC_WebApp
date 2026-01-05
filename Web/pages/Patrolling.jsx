import React, { useState, useEffect, Suspense, lazy } from "react";
import { Table, Button, Input, DatePicker, Modal, Image, Select, Tag, Card, Row, Col, Statistic, Progress, Typography } from "antd";
import { SearchOutlined, EyeOutlined, TeamOutlined, ClockCircleOutlined, DashboardOutlined, CalendarOutlined } from "@ant-design/icons";
import "./PatrolIncidentLogs.css";
import exportIcon from "../assets/excel.png";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import noDataImage from "../assets/no-data.png";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE_URL } from "../config";
import axios from "axios";
const BeatPatrolCoverage = lazy(() => import("./BeatPatrolCoverage"));

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Route } from "react-router-dom";
import MyCoups_dropdown from "./MyCoups_dropdown";

const Loader = () => {
  console.log("loading")
  return (
    <div className="map-loader">
      <div className="map-loader__radar">
        <div className="map-loader__center">
          <div className="map-loader__satellite"></div>
          <div className="map-loader__pulse"></div>
          <div className="map-loader__pulse delay-1"></div>
          <div className="map-loader__pulse delay-2"></div>
        </div>
        <div className="map-loader__sweep"></div>
      </div>
      <div className="map-loader__message">Loading...</div>
    </div>
  );
};

const { Title, Text } = Typography;
const { Option } = Select;

const startIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const endIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [25, 25],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

function ResizeMapOnShow({ coords }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
      if (coords && coords.length > 1) {
        map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
      }
    }, 700);
  }, [map, coords]);
  return null;
}

function PatrolMap({ patrol }) {
  if (!patrol?.geom) {
    return <p>No route available</p>;
  }

  const routeCoords = patrol.geom
    .split(",")
    .map((coord) => coord.trim().split(" ").map(Number))
    .map(([lat, lng]) => [lat, lng]);

  const start = routeCoords[0];
  const end = routeCoords[routeCoords.length - 1] || start;
  const initialZoom = 15;

  return (
    <MapContainer
      style={{ height: "400px", width: "100%" }}
      center={start}
      zoom={initialZoom}
      scrollWheelZoom={true}
    >
      <ResizeMapOnShow coords={routeCoords} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
      />
      <Marker position={start} icon={startIcon}>
        <Popup>Start</Popup>
      </Marker>
      {routeCoords.length > 1 && (
        <>
          <Marker position={end} icon={endIcon}>
            <Popup>End</Popup>
          </Marker>
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "blue", weight: 3, opacity: 1 }}
          />
        </>
      )}
      {routeCoords.length === 1 && (
        <Popup position={start}>Only one location point logged.</Popup>
      )}
    </MapContainer>
  );
}

// New component for analysis dashboard
const PatrolAnalysisDashboard = ({ patrolData, language }) => {
  if (!patrolData || patrolData.length === 0) {
    return null;
  }

  // Calculate statistics for each patrol type
  const calculateTypeStats = (type) => {
    const filtered = patrolData.filter(item => item.type_name === type);
    if (filtered.length === 0) return null;

    const totalPatrols = filtered.length;
    const totalDistance = filtered.reduce((sum, item) => sum + parseFloat(item.distance_kms || 0), 0);
    const totalStaff = filtered.reduce((sum, item) => sum + (item.number_of_staff || 1), 0);
    const avgDistance = totalDistance / totalPatrols;
    const avgStaff = totalStaff / totalPatrols;

    // Calculate total hours
    const totalHours = filtered.reduce((sum, item) => {
      const start = new Date(item.start_time);
      const end = new Date(item.end_time);
      const hours = (end - start) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    const avgHours = totalHours / totalPatrols;

    // Get top officer for this type
    const officerStats = {};
    filtered.forEach(item => {
      const officer = item.patrol_officer_name;
      officerStats[officer] = (officerStats[officer] || 0) + 1;
    });
    const topOfficer = Object.entries(officerStats).sort((a, b) => b[1] - a[1])[0];

    return {
      type,
      totalPatrols,
      totalDistance: totalDistance.toFixed(1),
      avgDistance: avgDistance.toFixed(1),
      avgHours: avgHours.toFixed(1),
      avgStaff: avgStaff.toFixed(1),
      topOfficer: topOfficer ? `${topOfficer[0]} (${topOfficer[1]} patrols)` : 'N/A'
    };
  };

  const dayStats = calculateTypeStats("Day patrolling");
  const nightStats = calculateTypeStats("Night patrolling");
  const beatStats = calculateTypeStats("Beat checking");

  // Overall statistics
  const totalPatrols = patrolData.length;
  const totalDistance = patrolData.reduce((sum, item) => sum + parseFloat(item.distance_kms || 0), 0);
  const avgDistanceOverall = (totalDistance / totalPatrols).toFixed(1);
  
  // Calculate utilization percentage (assuming max 8 hours per day as standard)
  const totalHours = patrolData.reduce((sum, item) => {
    const start = new Date(item.start_time);
    const end = new Date(item.end_time);
    const hours = (end - start) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);
  
  const utilizationPercentage = Math.min(100, (totalHours / (patrolData.length * 8)) * 100).toFixed(0);

  // Get unique officers
  const uniqueOfficers = [...new Set(patrolData.map(item => item.patrol_officer_name))];

  // Patrol distribution
  const dayPercentage = dayStats ? (dayStats.totalPatrols / totalPatrols * 100).toFixed(0) : 0;
  const nightPercentage = nightStats ? (nightStats.totalPatrols / totalPatrols * 100).toFixed(0) : 0;
  const beatPercentage = beatStats ? (beatStats.totalPatrols / totalPatrols * 100).toFixed(0) : 0;

  const getTypeColor = (type) => {
    switch (type) {
      case "Day patrolling": return "#0084ffff";
      case "Night patrolling": return "#6a00ffff";
      case "Beat checking": return "#55ff00ff";
      default: return "#d9d9d9";
    }
  };

  const getTypeDisplayName = (type) => {
    if (language === "gu") {
      switch (type) {
        case "Day patrolling": return "દિવસ પેટ્રોલિંગ";
        case "Night patrolling": return "રાત પેટ્રોલિંગ";
        case "Beat checking": return "બીટ ચેકિંગ";
        default: return type;
      }
    }
    return type;
  };

  return (
    <div style={{
      margin: 4,
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      padding: 20,
      borderRadius: 16,
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Glass overlay effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)'
      }} />
      
      <Title level={4} style={{ 
        marginBottom: 20, 
        color: '#000000ff',
        fontWeight: 600,
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {language === "gu" ? "પેટ્રોલિંગ વિશ્લેષણ" : "Patrol Analysis"}
      </Title>
      
      {/* Overall Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            key: 'total',
            value: totalPatrols,
            title: language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols",
            icon: <CalendarOutlined />,
            color: 'rgba(56, 189, 248, 0.3)',
            borderColor: 'rgba(56, 189, 248, 0.5)'
          },
          {
            key: 'distance',
            value: avgDistanceOverall,
            title: language === "gu" ? "સરેરાશ અંતર" : "Average Distance",
            suffix: "km",
            icon: <DashboardOutlined />,
            color: 'rgba(0, 255, 162, 0.3)',
            borderColor: 'rgba(0, 255, 162, 1)'
          },
          {
            key: 'officers',
            value: uniqueOfficers.length,
            title: language === "gu" ? "કુલ અધિકારીઓ" : "Total Officers",
            icon: <TeamOutlined />,
            color: 'rgba(64, 0, 255, 0.3)',
            borderColor: 'rgba(64, 0, 255, 1)'
          }
        ].map((item, index) => (
          <Col xs={24} sm={12} md={6} key={item.key}>
            <div style={{
              background: item.color,
              backdropFilter: 'blur(12px)',
              borderRadius: 12,
              padding: 16,
              border: `1px solid ${item.borderColor}`,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              height: '100%',
              transition: 'transform 0.2s',
              ':hover': {
                transform: 'translateY(-4px)'
              }
            }}>
              <Statistic
                title={
                  <span style={{ 
                    color: 'rgba(0, 0, 0, 0.9)',
                    fontSize: '12px',
                    fontWeight: 500
                  }}>
                    {item.title}
                  </span>
                }
                value={item.value}
                prefix={
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(0, 0, 0, 0.2)',
                    marginRight: 8,
                    border: '1px solid rgba(0, 0, 0, 0.3)'
                  }}>
                    {React.cloneElement(item.icon, { 
                      style: { 
                        color: 'white',
                        fontSize: '16px'
                      } 
                    })}
                  </div>
                }
                suffix={item.suffix}
                valueStyle={{ 
                  color: '#000000ff',
                  fontSize: '24px',
                  fontWeight: 600,
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
          </Col>
        ))}
      </Row>

      {/* Patrol Distribution */}
      <div style={{ 
        marginTop: 44,
        marginBottom: 44,
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        padding: 20,
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.15)'
      }}>
        <Text strong style={{ 
          display: 'block', 
          marginBottom: 16,
          color: 'rgba(0, 0, 0, 0.95)',
          fontSize: '16px'
        }}>
          {language === "gu" ? "પેટ્રોલિંગ વિતરણ" : "Patrol Distribution"}
        </Text>
        <Row gutter={8}>
          {[
            { type: "Day patrolling", percent: dayPercentage, color: '#00b3ffff' },
            { type: "Night patrolling", percent: nightPercentage, color: '#4000ffff' },
            { type: "Beat checking", percent: beatPercentage, color: '#00ffa2ff' }
          ].map((item) => (
            <Col span={8} key={item.type}>
              <div style={{ textAlign: 'center', padding: '0 8px' }}>
                <div style={{
                  position: 'relative',
                  display: 'inline-block',
                  marginBottom: 8
                }}>
                  <Progress
                    type="dashboard"
                    percent={parseInt(item.percent)}
                    strokeColor={item.color}
                    trailColor="rgba(255, 255, 255, 0.1)"
                    strokeWidth={8}
                    format={percent => (
                      <div style={{
                        color: '#000000ff',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        textShadow: '0 2px 4px rgba(185, 166, 166, 0.3)'
                      }}>
                        {percent}%
                      </div>
                    )}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '80%',
                    height: '80%',
                    borderRadius: '50%',
                    background: 'rgba(136, 108, 108, 0.05)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(173, 159, 159, 0.1)'
                  }} />
                </div>
                <Text style={{ 
                  color: 'rgba(0, 0, 0, 0.9)',
                  fontSize: '14px',
                  display: 'block',
                  marginTop: 8
                }}>
                  {getTypeDisplayName(item.type)}
                </Text>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      {/* Detailed Type Analysis */}
      <Row gutter={[16, 16]}>
        {[
          { stats: dayStats, type: "Day patrolling", color: '#00b3ffff' },
          { stats: nightStats, type: "Night patrolling", color: '#4000ffff' },
          { stats: beatStats, type: "Beat checking", color: '#00ffa2ff' }
        ].map(({ stats, type, color }, index) => {
          if (!stats) return null;
          
          return (
            <Col xs={24} md={8} key={type}>
              <div style={{
                background: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.15)`,
                backdropFilter: 'blur(12px)',
                borderRadius: 16,
                padding: 0,
                border: `1px solid rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.3)`,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                height: '100%',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{
                  padding: '16px 20px',
                  background: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.25)`,
                  borderBottom: `1px solid rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.4)`,
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: color,
                    marginRight: 12,
                    boxShadow: `0 0 12px ${color}`
                  }} />
                  <span style={{ 
                    color: 'rgba(0, 0, 0, 0.95)',
                    fontWeight: 600,
                    fontSize: '16px'
                  }}>
                    {getTypeDisplayName(type)}
                  </span>
                </div>
                
                {/* Content */}
                <div style={{ padding: 20 }}>
                  <div style={{ 
                    textAlign: 'center',
                    marginBottom: 20,
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <div style={{ 
                      color: 'rgba(0, 0, 0, 0.7)',
                      fontSize: '14px',
                      marginBottom: 4
                    }}>
                      {language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols"}
                    </div>
                    <div style={{ 
                      color: '#000000ff',
                      fontSize: '32px',
                      fontWeight: 'bold',
                      textShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}>
                      {stats.totalPatrols}
                    </div>
                  </div>
                  
                  <Row gutter={[12, 12]}>
                    {[
                      { label: language === "gu" ? "સરેરાશ અંતર" : "Avg Distance", value: `${stats.avgDistance} km` },
                      { label: language === "gu" ? "સરેરાશ સમય" : "Avg Time", value: `${stats.avgHours} hrs` },
                      { label: language === "gu" ? "સરેરાશ સ્ટાફ" : "Avg Staff", value: stats.avgStaff },
                      { label: language === "gu" ? "કુલ અંતર" : "Total Distance", value: `${stats.totalDistance} km` }
                    ].map((item, idx) => (
                      <Col span={12} key={idx}>
                        <div style={{
                          padding: '12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 8,
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          height: '100%'
                        }}>
                          <div style={{ 
                            color: 'rgba(0, 0, 0, 0.7)',
                            fontSize: '12px',
                            marginBottom: 4
                          }}>
                            {item.label}
                          </div>
                          <div style={{ 
                            color: '#000000ff',
                            fontSize: '16px',
                            fontWeight: 600
                          }}>
                            {item.value}
                          </div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                  
                  {/* Top Officer */}
                  {stats.topOfficer && (
                    <div style={{
                      marginTop: 16,
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      <div style={{ 
                        color: 'rgba(0, 0, 0, 0.7)',
                        fontSize: '12px',
                        marginBottom: 4
                      }}>
                        {language === "gu" ? "શ્રેષ્ઠ અધિકારી" : "Top Officer"}
                      </div>
                      <div style={{ 
                        color: '#000000ff',
                        fontSize: '14px',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {stats.topOfficer}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* Additional Insights */}
      {(dayStats || nightStats || beatStats) && (
        <div style={{
          marginTop: 16,
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          borderRadius: 16,
          padding: 0,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.12)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <span style={{ 
              color: 'rgba(0, 0, 0, 0.95)',
              fontWeight: 600,
              fontSize: '16px'
            }}>
              {language === "gu" ? "વધારાની જાણકારી" : "Additional Insights"}
            </span>
          </div>
          
          <div style={{ padding: 20 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div style={{
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  height: '100%'
                }}>
                  <div style={{ 
                    color: 'rgba(0, 0, 0, 0.7)',
                    fontSize: '14px',
                    marginBottom: 8
                  }}>
                    {language === "gu" ? "સૌથી વધુ પેટ્રોલિંગ" : "Most Active Type"}
                  </div>
                  {(() => {
                    const types = [
                      { name: "Day patrolling", count: dayStats?.totalPatrols || 0 },
                      { name: "Night patrolling", count: nightStats?.totalPatrols || 0 },
                      { name: "Beat checking", count: beatStats?.totalPatrols || 0 }
                    ];
                    const mostActive = types.reduce((prev, current) => 
                      prev.count > current.count ? prev : current
                    );
                    return (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: getTypeColor(mostActive.name),
                      marginRight: 8,
                      boxShadow: `0 0 8px ${getTypeColor(mostActive.name)}`
                    }} />
                    <span style={{ 
                      color: '#000000ff',
                      fontSize: '16px',
                      fontWeight: 600
                    }}>
                      {getTypeDisplayName(mostActive.name)}
                    </span>
                    <span style={{ 
                      color: 'rgba(0, 0, 0, 0.7)',
                      marginLeft: 8,
                      fontSize: '14px'
                    }}>
                      ({mostActive.count} {language === "gu" ? "પેટ્રોલિંગ" : "patrols"})
                    </span>
                  </div>
                );
              })()}
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={{
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              height: '100%'
            }}>
              <div style={{ 
                color: 'rgba(0, 0, 0, 0.7)',
                fontSize: '14px',
                marginBottom: 8
              }}>
                {language === "gu" ? "સૌથી વધુ અંતર" : "Longest Distance Type"}
              </div>
              {(() => {
                const types = [
                  { name: "Day patrolling", distance: parseFloat(dayStats?.totalDistance || 0) },
                  { name: "Night patrolling", distance: parseFloat(nightStats?.totalDistance || 0) },
                  { name: "Beat checking", distance: parseFloat(beatStats?.totalDistance || 0) }
                ];
                const longestDistance = types.reduce((prev, current) => 
                  prev.distance > current.distance ? prev : current
                );
                return (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: getTypeColor(longestDistance.name),
                      marginRight: 8,
                      boxShadow: `0 0 8px ${getTypeColor(longestDistance.name)}`
                    }} />
                    <span style={{ 
                      color: '#000000ff',
                      fontSize: '16px',
                      fontWeight: 600
                    }}>
                      {getTypeDisplayName(longestDistance.name)}
                    </span>
                    <span style={{ 
                      color: 'rgba(0, 0, 0, 0.7)',
                      marginLeft: 8,
                      fontSize: '14px'
                    }}>
                      ({longestDistance.distance} km)
                    </span>
                  </div>
                );
              })()}
            </div>
          </Col>
        </Row>
      </div>
    </div>
  )}
</div>
  );
};

const PatrolIncidentLogs = () => {
  const [patrolData, setPatrolData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [filteredData, setFilteredData] = useState([]);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const [showmaproute, setShowMapRoute] = useState(false);
  
  // Hierarchy filter states
  const [forestTypes, setForestTypes] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [beats, setBeats] = useState([]);
  const [coupes, setCoupes] = useState([]);
  const [hierarchyData, setHierarchyData] = useState([]);
  
  const [forestId, setForestId] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [beatFilter, setBeatFilter] = useState("");
  const [coupeFilter, setCoupeFilter] = useState("");

  const fetchPatrolData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patrol-info`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log("Fetched Patrol data:", data);
      
      let formattedData = Array.isArray(data.data)
        ? data.data
        : data.data && typeof data.data === "object"
        ? [data.data]
        : [];
      
      formattedData = formattedData.map((item, index) => ({
        key: item.patrol_id || index,
        ...item,
      }));
      
      setPatrolData(formattedData);
      setFilteredData(formattedData); // Initialize filteredData with all data
    } catch (error) {
      console.error("Error fetching Patrol data:", error);
      setPatrolData([]);
      setFilteredData([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPatrolData();
    
    // Load forest types
    axios
      .get(`${API_BASE_URL}/api/forest-types`)
      .then((res) => setForestTypes(res.data))
      .catch((err) => console.error(err));
  }, []);

  // Handle forest type change
  const handleForestChange = async (value) => {
    setForestId(value);
    setDivisionFilter("");
    setBeatFilter("");
    setCoupeFilter("");
    setDivisions([]);
    setBeats([]);
    setCoupes([]);

    if (!value) {
      handleSearch();
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/get-divisions`, {
        forest_id: value,
      });
      setDivisions(res.data);
    } catch (error) {
      console.error("Error fetching divisions:", error);
    }
  };

  // Handle division change
  const handleDivisionChange = async (value) => {
    setDivisionFilter(value);
    setBeatFilter("");
    setCoupeFilter("");
    setBeats([]);
    setCoupes([]);

    if (!value) {
      handleSearch();
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/hierarchy`, {
        forest_id: forestId,
        division_name: value,
      });

      setHierarchyData(res.data);

      // Extract unique beats
      const uniqueBeats = [
        ...new Set(res.data.map((item) => item.BEAT)),
      ];
      setBeats(uniqueBeats);
    } catch (error) {
      console.error("Error fetching hierarchy:", error);
    }
  };

  // Handle beat change
  const handleBeatChange = (value) => {
    setBeatFilter(value);
    setCoupeFilter("");

    if (!value) {
      handleSearch();
      return;
    }

    const filteredCoupes = hierarchyData
      .filter((item) => item.BEAT === value)
      .map((item) => item.coupe_name);

    setCoupes([...new Set(filteredCoupes)]);
  };

  // Handle coupe change
  const handleCoupeChange = (value) => {
    setCoupeFilter(value);
  };

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return { date: `${day}-${month}-${year}`, time: `${hours}:${minutes}` };
  };

  // Function to handle search with all filters
  const handleSearch = () => {
    let data = [...patrolData];
    
    // Text search filter
    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      data = data.filter((item) =>
        item.patrol_officer_name?.toLowerCase().includes(lower)
      );
    }
    
    // Date filters
    if (startFilter) {
      data = data.filter((item) =>
        dayjs(item.start_time).isSame(startFilter, "day")
      );
    }
    
    if (endFilter) {
      data = data.filter((item) =>
        dayjs(item.end_time).isSame(endFilter, "day")
      );
    }
    
    // Type filter
    if (typeFilter) {
      data = data.filter((item) => item.type_name === typeFilter);
    }
    
    // Hierarchy filters
    if (divisionFilter) {
      data = data.filter((item) => 
        item.division_name?.toLowerCase().includes(divisionFilter.toLowerCase())
      );
    }
    
    if (beatFilter) {
      data = data.filter((item) => 
        item.beat_name?.toLowerCase().includes(beatFilter.toLowerCase())
      );
    }
    
    if (coupeFilter) {
      // Assuming there's a coupe field in patrol data
      // You may need to adjust this based on your actual data structure
      data = data.filter((item) => 
        item.coupe_name?.toLowerCase().includes(coupeFilter.toLowerCase())
      );
    }
    
    setFilteredData(data);
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setSearchText("");
    setStartFilter(null);
    setEndFilter(null);
    setTypeFilter("");
    setForestId("");
    setDivisionFilter("");
    setBeatFilter("");
    setCoupeFilter("");
    setDivisions([]);
    setBeats([]);
    setCoupes([]);
    setFilteredData(patrolData);
  };

  // Apply filters when any filter changes
  useEffect(() => {
    handleSearch();
  }, [searchText, startFilter, endFilter, typeFilter, divisionFilter, beatFilter, coupeFilter, patrolData]);

  const getTypeDisplayName = (type) => {
    if (language === "gu") {
      switch (type) {
        case "Day patrolling": return "દિવસ પેટ્રોલિંગ";
        case "Night patrolling": return "રાત પેટ્રોલિંગ";
        case "Beat checking": return "બીટ ચેકિંગ";
        default: return type;
      }
    }
    return type;
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "Day patrolling": return "blue";
      case "Night patrolling": return "purple";
      case "Beat checking": return "green";
      default: return "default";
    }
  };

  const admindata = {
    division: "Bhavnagar Forest Division",
    Range: "MAHUVA",
    Beat: "GEBAR",
  };

  const columns = [
    {
      title: language === "gu" ? "પેટ્રોલિંગ આઈડી" : "Patrol ID",
      dataIndex: "patrol_id",
      key: "patrol_id",
      align: "center",
      sorter: (a, b) => a.patrol_id - b.patrol_id,
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type",
      dataIndex: "type_name",
      key: "type_name",
      align: "center",
      render: (type) => (
        <Tag color={getTypeColor(type)}>
          {getTypeDisplayName(type)}
        </Tag>
      ),
      filters: [
        { text: language === "gu" ? "દિવસ પેટ્રોલિંગ" : "Day Patrolling", value: "Day patrolling" },
        { text: language === "gu" ? "રાત પેટ્રોલિંગ" : "Night Patrolling", value: "Night patrolling" },
        { text: language === "gu" ? "બીટ ચેકિંગ" : "Beat Checking", value: "Beat checking" },
      ],
      onFilter: (value, record) => record.type_name === value,
    },
    {
      title: language === "gu" ? "અધિકારીનું નામ" : "Officer Name",
      dataIndex: "patrol_officer_name",
      key: "patrol_officer_name",
      align: "center",
    },
    {
      title: language === "gu" ? "વિભાગ" : "Division",
      dataIndex: "division_name",
      key: "division_name",
      align: "center",
    },
    {
      title: language === "gu" ? "રંગ" : "Range",
      dataIndex: "range_name",
      key: "range_name",
      align: "center",
    },
    {
      title: language === "gu" ? "બીટ" : "Beat",
      dataIndex: "beat_name",
      key: "beat_name",
      align: "center",
    },
    {
      title: language === "gu" ? "શરૂઆતની તારીખ" : "Start Date",
      key: "start_date",
      align: "center",
      render: (record) => formatDateTime(record.start_time).date,
      sorter: (a, b) => new Date(a.start_time) - new Date(b.start_time),
    },
    {
      title: language === "gu" ? "શરૂઆતનો સમય" : "Start Time",
      key: "start_time",
      align: "center",
      render: (record) => formatDateTime(record.start_time).time,
    },
    {
      title: language === "gu" ? "સમાપ્તિ તારીખ" : "End Date",
      key: "end_date",
      align: "center",
      render: (record) => formatDateTime(record.end_time).date,
      sorter: (a, b) => new Date(a.end_time) - new Date(b.end_time),
    },
    {
      title: language === "gu" ? "સમાપ્તિ સમય" : "End Time",
      key: "end_time",
      align: "center",
      render: (record) => formatDateTime(record.end_time).time,
    },
    {
      title: language === "gu" ? "શરૂઆતનું સ્થાન" : "Start Location",
      dataIndex: "start_location",
      key: "start_location",
      align: "center",
    },
    {
      title: language === "gu" ? "અંતિમ સ્થાન" : "End Location",
      dataIndex: "end_location",
      key: "end_location",
      align: "center",
    },
    {
      title: language === "gu" ? "અંતર (કિ.મી.)" : "Distance (km)",
      dataIndex: "distance_kms",
      key: "distance_kms",
      align: "center",
      sorter: (a, b) => parseFloat(a.distance_kms) - parseFloat(b.distance_kms),
    },
    {
      title: language === "gu" ? "રસ્તો" : "Route",
      key: "route",
      align: "center",
      render: (record) => (
        <Button
          style={{
            borderRadius: "4.618px",
            border: "1.961px solid rgba(255, 255, 255, 0.23)",
            background: "rgba(116, 190, 0, 0.40)",
            color: "#000",
          }}
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedPatrol(record);
            setIsModalVisible(true);
          }}
        >
          {language === "gu" ? "દેખાવ" : "View"}
        </Button>
      ),
    },
  ];

  const handleExport = () => {
    if (!filteredData.length) {
      alert(language === "gu" ? "નિકાસ કરવા માટે કોઈ ડેટા નથી" : "No data to export");
      return;
    }
    
    // Group data by officer name
    const officers = {};
    filteredData.forEach((item) => {
      if (!officers[item.patrol_officer_name]) {
        officers[item.patrol_officer_name] = {
          dayPatrols: [],
          nightPatrols: [],
          beatChecks: []
        };
      }
      
      if (item.type_name === "Day patrolling") {
        officers[item.patrol_officer_name].dayPatrols.push(item);
      } else if (item.type_name === "Night patrolling") {
        officers[item.patrol_officer_name].nightPatrols.push(item);
      } else if (item.type_name === "Beat checking") {
        officers[item.patrol_officer_name].beatChecks.push(item);
      }
    });

    // Calculate statistics for each officer
    const calculateStats = (patrols) => {
      if (!patrols.length) {
        return { total: 0, avgStaff: 0, avgHours: 0, avgDist: 0 };
      }

      const total = patrols.length;
      const avgStaff = patrols.reduce((sum, item) => sum + (item.number_of_staff || 1), 0) / total;
      
      const totalHours = patrols.reduce((sum, item) => {
        const start = new Date(item.start_time);
        const end = new Date(item.end_time);
        const hours = (end - start) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      const avgHours = totalHours / total;
      
      const avgDist = patrols.reduce((sum, item) => sum + parseFloat(item.distance_kms || 0), 0) / total;

      return {
        total,
        avgStaff: avgStaff.toFixed(1),
        avgHours: avgHours.toFixed(1),
        avgDist: avgDist.toFixed(0) + 'km'
      };
    };

    // Prepare data for Excel export
    const exportData = [
      // Title row
      ['Officer Patrol Summary Report', '', '', '', '', '', '', '', '', '', '', '', ''],
      
      // Empty row for spacing
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      
      // Header row
      [
        'Division', 'Range', 'Beat',
        'Officer Name',
        'Day Patrolling', '', '', '',
        'Night Patrolling', '', '', '',
        'Beat Checking', '', '', ''
      ],
      // Sub-header row
      [
        '', '', '', '',
        'Total Patrols', 'Avg Staff', 'Avg Hours', 'Avg Dist',
        'Total Patrols', 'Avg Staff', 'Avg Hours', 'Avg Dist',
        'Total Checks', 'Avg Staff', 'Avg Hours', 'Avg Dist'
      ]
    ];

    // Add data for each officer
    Object.keys(officers).forEach(officerName => {
      const officerData = officers[officerName];
      const dayStats = calculateStats(officerData.dayPatrols);
      const nightStats = calculateStats(officerData.nightPatrols);
      const beatStats = calculateStats(officerData.beatChecks);

      exportData.push([
        admindata.division,
        admindata.Range,
        admindata.Beat,
        officerName,
        dayStats.total, dayStats.avgStaff, dayStats.avgHours, dayStats.avgDist,
        nightStats.total, nightStats.avgStaff, nightStats.avgHours, nightStats.avgDist,
        beatStats.total, beatStats.avgStaff, beatStats.avgHours, beatStats.avgDist
      ]);
    });

    // Calculate totals row
    const allOfficers = Object.keys(officers);
    const totalDayPatrols = allOfficers.reduce((sum, officer) => sum + officers[officer].dayPatrols.length, 0);
    const totalNightPatrols = allOfficers.reduce((sum, officer) => sum + officers[officer].nightPatrols.length, 0);
    const totalBeatChecks = allOfficers.reduce((sum, officer) => sum + officers[officer].beatChecks.length, 0);

    // Add empty row before totals
    exportData.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
    
    // Add totals row
    exportData.push([
      'TOTAL', '', '',
      '',
      totalDayPatrols, '-', '-', '-',
      totalNightPatrols, '-', '-', '-',
      totalBeatChecks, '-', '-', '-'
    ]);

    // Add timestamp
    exportData.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
    exportData.push(['Report Generated:', new Date().toLocaleString(), '', '', '', '', '', '', '', '', '', '', '']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    
    // Apply comprehensive styling
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Define color scheme
    const colors = {
      title: "2F75B5",        // Dark Blue
      mainHeader: "4472C4",   // Medium Blue
      subHeader: "8FAADC",    // Light Blue
      totals: "70AD47",       // Green
      officerName: "F2F2F2",  // Light Gray
      evenRow: "FFFFFF",      // White
      oddRow: "F8F9FA",       // Very Light Gray
      timestamp: "D9E1F2"     // Very Light Blue
    };

    // Style all cells
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) ws[cellAddress] = { v: '' };
        
        const cell = ws[cellAddress];
        
        // Default cell style
        cell.s = {
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          },
          alignment: { horizontal: "center", vertical: "center" },
          font: { sz: 10 }
        };

        // Title row (Row 0)
        if (R === 0) {
          cell.s = {
            ...cell.s,
            font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: colors.title } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }

        // Main header row (Row 2) - Dark Blue Background
        if (R === 2) {
          cell.s = {
            ...cell.s,
            font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: colors.mainHeader } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }

        // Sub-header row (Row 3) - Light Blue Background
        if (R === 3) {
          cell.s = {
            ...cell.s,
            font: { bold: true, sz: 10, color: { rgb: "000000" } },
            fill: { fgColor: { rgb: colors.subHeader } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }

        // Data rows (Row 4 to second last row - 3)
        if (R >= 4 && R <= range.e.r - 3) {
          // Officer name column (Column 0)
          if (C === 0) {
            cell.s = {
              ...cell.s,
              font: { bold: true, sz: 10 },
              fill: { fgColor: { rgb: colors.officerName } },
              alignment: { horizontal: "left", vertical: "center" }
            };
          } else {
            // Alternate row coloring for data cells
            if (R % 2 === 0) {
              cell.s.fill = { fgColor: { rgb: colors.evenRow } };
            } else {
              cell.s.fill = { fgColor: { rgb: colors.oddRow } };
            }
          }
        }

        // Totals row (second last row - 2)
        if (R === range.e.r - 2) {
          cell.s = {
            ...cell.s,
            font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: colors.totals } },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }

        // Timestamp row (last row)
        if (R === range.e.r) {
          if (C === 0) {
            cell.s = {
              ...cell.s,
              font: { bold: true, italic: true, sz: 9 },
              fill: { fgColor: { rgb: colors.timestamp } },
              alignment: { horizontal: "left", vertical: "center" }
            };
          } else if (C === 1) {
            cell.s = {
              ...cell.s,
              font: { italic: true, sz: 9 },
              fill: { fgColor: { rgb: colors.timestamp } },
              alignment: { horizontal: "left", vertical: "center" }
            };
          } else {
            cell.s.fill = { fgColor: { rgb: colors.timestamp } };
          }
        }
      }
    }

    // Merge cells for better layout
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }, // Title
      { s: { r: 2, c: 4 }, e: { r: 2, c: 7 } },  // Day
      { s: { r: 2, c: 8 }, e: { r: 2, c: 11 } }, // Night
      { s: { r: 2, c: 12 }, e: { r: 2, c: 15 } },// Beat
      { s: { r: range.e.r, c: 1 }, e: { r: range.e.r, c: 15 } }
    ];

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 25 }, // Division
      { wch: 15 }, // Range
      { wch: 15 }, // Beat
      { wch: 20 }, // Officer Name
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, // Day Patrolling
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, // Night Patrolling  
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }  // Beat Checking
    ];

    // Set row heights
    ws['!rows'] = [
      { hpt: 30 }, // Title row
      { hpt: 10 }, // Spacing row
      { hpt: 25 }, // Main header
      { hpt: 20 }, // Sub-header
    ];

    // Add more rows for data (you can extend this as needed)
    for (let i = 4; i <= range.e.r; i++) {
      if (!ws['!rows']) ws['!rows'] = [];
      ws['!rows'][i] = { hpt: 20 };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Officer Patrol Summary");

    // Also keep the original detailed data in a separate sheet with better styling
    const detailedData = filteredData.map((item) => ({
      "Patrol ID": item.patrol_id,
      "Officer Name": item.patrol_officer_name,
      "Patrol Type": item.type_name,
      "Patrol Start Date": formatDateTime(item.start_time).date,
      "Patrol Start Time": formatDateTime(item.start_time).time,
      "Patrol End Date": formatDateTime(item.end_time).date,
      "Patrol End Time": formatDateTime(item.end_time).time,
      "Start Location": item.start_location,
      "End Location": item.end_location,
      "Distance (Kms)": item.distance_kms,
      "Number of Staff": item.number_of_staff || 1
    }));

    const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
    
    // Style the detailed sheet
    const detailedRange = XLSX.utils.decode_range(detailedSheet['!ref']);
    
    // Add header styling for detailed sheet with blue background
    for (let C = detailedRange.s.c; C <= detailedRange.e.c; C++) {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
      if (detailedSheet[headerCell]) {
        detailedSheet[headerCell].s = {
          font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: colors.mainHeader } }, // Using the same blue as main header
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }
    }

    // Style data rows in detailed sheet
    for (let R = 1; R <= detailedRange.e.r; R++) {
      for (let C = detailedRange.s.c; C <= detailedRange.e.c; C++) {
        const cell = XLSX.utils.encode_cell({ r: R, c: C });
        if (detailedSheet[cell]) {
          detailedSheet[cell].s = {
            border: {
              top: { style: "thin", color: { rgb: "D0D0D0" } },
              left: { style: "thin", color: { rgb: "D0D0D0" } },
              bottom: { style: "thin", color: { rgb: "D0D0D0" } },
              right: { style: "thin", color: { rgb: "D0D0D0" } }
            },
            alignment: { horizontal: "center", vertical: "center" },
            font: { sz: 9 }
          };
          
          // Alternate row colors
          if (R % 2 === 0) {
            detailedSheet[cell].s.fill = { fgColor: { rgb: colors.oddRow } };
          } else {
            detailedSheet[cell].s.fill = { fgColor: { rgb: colors.evenRow } };
          }
        }
      }
    }

    // Set column widths for detailed sheet
    detailedSheet['!cols'] = [
      { wch: 12 }, // Patrol ID
      { wch: 20 }, // Officer Name
      { wch: 15 }, // Patrol Type
      { wch: 12 }, // Start Date
      { wch: 12 }, // Start Time
      { wch: 12 }, // End Date
      { wch: 12 }, // End Time
      { wch: 20 }, // Start Location
      { wch: 20 }, // End Location
      { wch: 12 }, // Distance
      { wch: 12 }  // Number of Staff
    ];

    XLSX.utils.book_append_sheet(wb, detailedSheet, "Detailed Patrol Data");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `Officer_Patrol_Summary_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  return (
    <div className="container">
      {isLoading && <Loader />}
      <div className="section">
        <div className="heading-container">
          <h3 className="main-heading">
            {language === "gu" ? "પેટ્રોલિંગ નોંધણી" : "Patrolling Logs"}
          </h3>
          <div className="filters">
           
            {/* Hierarchy Filters */}
            <Select
              placeholder={language === "gu" ? "ફોરેસ્ટ પ્રકાર" : "Forest Type"}
              style={{
                width: "180px",
                border: "1px solid #d9d9d9",
                borderRadius: "0px",
                background: "#fff",
              }}
              value={forestId}
              onChange={handleForestChange}
              allowClear
            dropdownStyle={{
              background: "#fff",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              <Option value="">{language === "gu" ? "બધા" : "All"}</Option>
              {forestTypes.map((f) => (
                <Option key={f.forest_id} value={f.forest_id}>
                  {f.forest_type}
                </Option>
              ))}
            </Select>

            <Select
              placeholder={language === "gu" ? "વિભાગ" : "Division"}
              style={{
                width: "180px",
                border: "1px solid #d9d9d9",
                borderRadius: "0px",
                background: "#fff",
              }}
              value={divisionFilter}
              onChange={handleDivisionChange}
              allowClear
              disabled={!forestId}
              dropdownStyle={{
              background: "#fff",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              <Option value="">{language === "gu" ? "બધા" : "All"}</Option>
              {divisions.map((d, index) => (
                <Option key={index} value={d.DIVISION}>
                  {d.DIVISION}
                </Option>
              ))}
            </Select>

            {/* <Select
              placeholder={language === "gu" ? "બીટ" : "Beat"}
              style={{
                width: "180px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                background: "#fff",
              }}
              value={beatFilter}
              onChange={handleBeatChange}
              allowClear
              disabled={!divisionFilter}
            >
              <Option value="">{language === "gu" ? "બધા" : "All"}</Option>
              {beats.map((b, index) => (
                <Option key={index} value={b}>
                  {b}
                </Option>
              ))}
            </Select>

            <Select
              placeholder={language === "gu" ? "કૂપ" : "Coupe"}
              style={{
                width: "180px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                background: "#fff",
              }}
              value={coupeFilter}
              onChange={handleCoupeChange}
              allowClear
              disabled={!beatFilter}
            >
              <Option value="">{language === "gu" ? "બધા" : "All"}</Option>
              {coupes.map((c, index) => (
                <Option key={index} value={c}>
                  {c}
                </Option>
              ))}
            </Select> */}

            {/* Existing filters */}
            <Input
              placeholder={
                language === "gu"
                  ? "અધિકારીના નામ પ્રમાણે શોધો"
                  : "Search by Officer Name"
              }
              style={{
                width: "200px",
                background: "rgba(255, 255, 255, 0.2)",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
              }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              suffix={
                <SearchOutlined
                  style={{ 
                    color: "rgba(0, 0, 0, 0.45)", 
                    fontSize: "16px",
                    cursor: "pointer"
                  }}
                  onClick={handleSearch}
                />
              }
            />
            <DatePicker
              placeholder={
                language === "gu"
                  ? "શરૂઆતની તારીખથી શોધો"
                  : "Search by Start Date"
              }
              style={{
                width: "200px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                background: "#fff",
              }}
              value={startFilter}
              onChange={(date) => setStartFilter(date)}
              allowClear
            />
            {/* <DatePicker
              placeholder={
                language === "gu" ? "સમાપ્ત તારીખથી શોધો" : "Search by End Date"
              }
              style={{
                width: "200px",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                background: "#fff",
              }}
              value={endFilter}
              onChange={(date) => setEndFilter(date)}
              allowClear
            /> */}
            <Select
              placeholder={language === "gu" ? "પેટ્રોલિંગ પ્રકારથી શોધો" : "Search by Patrolling Type"}
              style={{
                width: "100px",
                border: "1px solid #d9d9d9",
                borderRadius: "0px",
                background: "#fff",
              }}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
              allowClear
              dropdownStyle={{
              background: "#fff",
            }}
            dropdownRender={(menu) => (
              <div style={{ background: "#fff" }}>
                {menu}
              </div>
            )}
            >
              <Option value="">{language === "gu" ? "બધા" : "All"}</Option>
              <Option value="Day patrolling">{language === "gu" ? "દિવસ પેટ્રોલિંગ" : "Day Patrolling"}</Option>
              <Option value="Night patrolling">{language === "gu" ? "રાત પેટ્રોલિંગ" : "Night Patrolling"}</Option>
              <Option value="Beat checking">{language === "gu" ? "બીટ ચેકિંગ" : "Beat Checking"}</Option>
            </Select>
            
            <Button 
              onClick={clearAllFilters}
              style={{
                marginRight: "10px",
                background: "#f5f5f5",
                borderColor: "#d9d9d9",
                color: "#000",
              }}
            >
              {language === "gu" ? "ફિલ્ટર સાફ કરો" : "Clear Filters"}
            </Button>
            <Button 
              onClick={() => {
                setShowMapRoute(!showmaproute);
              }}
              style={{
                marginRight: "10px",
                background: "#f5f5f5",
                borderColor: "#d9d9d9",
                color: "#000",
              }}
            >
              {language === "gu" ? "બીટ પેટ્રોલ કવરેજ વિશ્લેષણ" : "Beat Patrol Coverage Analysis"}
            </Button>
            
            <Button className="btn-Export" onClick={handleExport}>
              {language === "gu" ? "નિકાસ કરો" : "Export"}
              <img src={exportIcon} alt="Export Icon" className="btn-icon" />
            </Button>
          </div>
        </div>
        
        {/* Analysis Dashboard - Shows statistics for current filtered data */}
      
        <Table
          className="transparent-table"
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 5 }}
          bordered
          scroll={{ x: 'max-content' }}
          onChange={(pagination, filters, sorter) => {
            // Handle table sorting and filtering
            console.log('Table changed:', { pagination, filters, sorter });
          }}
          locale={{
            emptyText: (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <img
                  src={noDataImage}
                  alt="No Data"
                  style={{ width: 60, marginBottom: 16 }}
                />
                <div style={{ fontSize: 16, color: "#000", fontWeight: 500 }}>
                  {language === "gu" ? "કોઈ ડેટા ઉપલબ્ધ નથી" : "No data available"}
                </div>
                {(searchText || startFilter || endFilter || typeFilter || divisionFilter || beatFilter || coupeFilter) && (
                  <Button 
                    onClick={clearAllFilters}
                    style={{ marginTop: "16px" }}
                  >
                    {language === "gu" ? "બધા ફિલ્ટર સાફ કરો" : "Clear All Filters"}
                  </Button>
                )}
              </div>
            ),
          }}
        />
      </div>
        <PatrolAnalysisDashboard patrolData={filteredData} language={language} />
        
      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
        title={
          selectedPatrol
            ? `${language === "gu" ? "પેટ્રોલ માર્ગ" : "Patrol Route"} - ${
                selectedPatrol.patrol_officer_name
              } (${language === "gu" ? "અંતર" : "Distance"}: ${
                selectedPatrol.distance_kms
              } km)`
            : language === "gu"
            ? "પેટ્રોલ માર્ગ"
            : "Patrol Route"
        }
      >
        {selectedPatrol && (
          <>
            {/* Display all images in a grid */}
            <div style={{ marginBottom: 16 }}>
              {selectedPatrol.images && selectedPatrol.images.length > 0 ? (
                <>
                  <h4 style={{ marginBottom: 12 }}>
                    {language === "gu" ? "પેટ્રોલ છબીઓ" : "Patrol Images"} ({selectedPatrol.images.length})
                  </h4>
                  <Row gutter={[8, 8]}>
                    {selectedPatrol.images.map((image, index) => {
                      // Get display name for image based on category
                      const getImageLabel = () => {
                        if (language === "gu") {
                          switch(image.image_category) {
                            case 'start_image': return 'શરૂઆતની છબી';
                            case 'end_image': return 'અંતિમ છબી';
                            default:
                              if (image.image_category.startsWith('image_')) {
                                const num = image.image_category.replace('image_', '');
                                return `છબી ${num}`;
                              }
                              return `છબી ${index + 1}`;
                          }
                        } else {
                          switch(image.image_category) {
                            case 'start_image': return 'Start Image';
                            case 'end_image': return 'End Image';
                            default:
                              if (image.image_category.startsWith('image_')) {
                                const num = image.image_category.replace('image_', '');
                                return `Image ${num}`;
                              }
                              return `Image ${index + 1}`;
                          }
                        }
                      };

                      return (
                        <Col 
                          xs={12} 
                          sm={8} 
                          md={6} 
                          key={`image_${index}`}
                        >
                          <div style={{ 
                            border: '1px solid #d9d9d9', 
                            borderRadius: 4,
                            padding: 4,
                            height: '100%'
                          }}>
                            <Image
                              src={`data:${image.image_type};base64,${image.image_data}`}
                              alt={getImageLabel()}
                              style={{ 
                                width: '100%',
                                height: 150,
                                objectFit: 'cover',
                                borderRadius: 2
                              }}
                              preview={{
                                mask: (
                                  <div style={{ 
                                    color: '#fff',
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%'
                                  }}>
                                    {language === "gu" ? "જૂઓ" : "View"}
                                  </div>
                                )
                              }}
                            />
                            <div style={{ 
                              fontSize: 10,
                              color: '#666',
                              marginTop: 4,
                              padding: '0 2px',
                              textAlign: 'center'
                            }}>
                              {getImageLabel()}
                              {image.note && (
                                <div style={{
                                  fontSize: 9,
                                  color: '#999',
                                  marginTop: 2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {image.note}
                                </div>
                              )}
                            </div>
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                </>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 20,
                  color: '#999'
                }}>
                  {language === "gu" ? "કોઈ છબીઓ ઉપલબ્ધ નથી" : "No images available"}
                </div>
              )}
            </div>
            
            {/* Map section */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 8 }}>
                {language === "gu" ? "પેટ્રોલ માર્ગ" : "Patrol Route"}
              </h4>
              <PatrolMap patrol={selectedPatrol} />
            </div>
          </>
        )}
      </Modal>
      
      {
        showmaproute &&  <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                fontSize: "18px",
                color: "#666",
              }}
            >
              Loading map...
            </div>
          }
        >
          <BeatPatrolCoverage showmaproute={showmaproute} language={language} setShowMapRoute={setShowMapRoute}/>
        </Suspense>
      }
    </div>
  );
};

export default PatrolIncidentLogs;





//  <div style={{ margin: 4, backgroundColor: '#fafafa', padding: 20, borderRadius: 8 }}>
//       <Title level={4} style={{ marginBottom: 20 }}>
//         {language === "gu" ? "પેટ્રોલિંગ વિશ્લેષણ" : "Patrol Analysis"}
//       </Title>
      
    
//       <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
//         <Col xs={24} sm={12} md={6}>
//           <Card size="small">
//             <Statistic
//               title={language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols"}
//               value={totalPatrols}
//               prefix={<CalendarOutlined />}
//               valueStyle={{ color: '#1890ff' }}
//             />
//           </Card>
//         </Col>
//         <Col xs={24} sm={12} md={6}>
//           <Card size="small">
//             <Statistic
//               title={language === "gu" ? "સરેરાશ અંતર" : "Average Distance"}
//               value={avgDistanceOverall}
//               suffix="km"
//               prefix={<DashboardOutlined />}
//               valueStyle={{ color: '#52c41a' }}
//             />
//           </Card>
//         </Col>
//         <Col xs={24} sm={12} md={6}>
//           <Card size="small">
//             <Statistic
//               title={language === "gu" ? "કુલ અધિકારીઓ" : "Total Officers"}
//               value={uniqueOfficers.length}
//               prefix={<TeamOutlined />}
//               valueStyle={{ color: '#722ed1' }}
//             />
//           </Card>
//         </Col>
//         <Col xs={24} sm={12} md={6}>
//           <Card size="small">
//             <Statistic
//               title={language === "gu" ? "ઉપયોગિતા" : "Utilization"}
//               value={utilizationPercentage}
//               suffix="%"
//               prefix={<ClockCircleOutlined />}
//               valueStyle={{ color: '#fa8c16' }}
//             />
//           </Card>
//         </Col>
//       </Row>

     
//       <div style={{ marginBottom: 24 }}>
//         <Text strong style={{ display: 'block', marginBottom: 8 }}>
//           {language === "gu" ? "પેટ્રોલિંગ વિતરણ" : "Patrol Distribution"}
//         </Text>
//         <Row gutter={8}>
//           <Col span={8}>
//             <div style={{ textAlign: 'center' }}>
//               <Progress
//                 type="dashboard"
//                 percent={parseInt(dayPercentage)}
//                 strokeColor="#1890ff"
//                 format={percent => `${percent}%`}
//               />
//               <Text type="secondary">{getTypeDisplayName("Day patrolling")}</Text>
//             </div>
//           </Col>
//           <Col span={8}>
//             <div style={{ textAlign: 'center' }}>
//               <Progress
//                 type="dashboard"
//                 percent={parseInt(nightPercentage)}
//                 strokeColor="#722ed1"
//                 format={percent => `${percent}%`}
//               />
//               <Text type="secondary">{getTypeDisplayName("Night patrolling")}</Text>
//             </div>
//           </Col>
//           <Col span={8}>
//             <div style={{ textAlign: 'center' }}>
//               <Progress
//                 type="dashboard"
//                 percent={parseInt(beatPercentage)}
//                 strokeColor="#52c41a"
//                 format={percent => `${percent}%`}
//               />
//               <Text type="secondary">{getTypeDisplayName("Beat checking")}</Text>
//             </div>
//           </Col>
//         </Row>
//       </div>

     
//       <Row gutter={[16, 16]}>
//         {[dayStats, nightStats, beatStats].map((stats, index) => {
//           if (!stats) return null;
          
//           const types = ["Day patrolling", "Night patrolling", "Beat checking"];
//           const type = types[index];
          
//           return (
//             <Col xs={24} md={8} key={type}>
//               <Card 
//                 size="small" 
//                 title={
//                   <div style={{ display: 'flex', alignItems: 'center' }}>
//                     <div style={{
//                       width: 12,
//                       height: 12,
//                       borderRadius: '50%',
//                       backgroundColor: getTypeColor(type),
//                       marginRight: 8
//                     }} />
//                     <span>{getTypeDisplayName(type)}</span>
//                   </div>
//                 }
//                 headStyle={{ backgroundColor: getTypeColor(type) + '10', borderBottomColor: getTypeColor(type) + '30' }}
//               >
//                 <Statistic
//                   title={language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols"}
//                   value={stats.totalPatrols}
//                   valueStyle={{ fontSize: '24px' }}
//                 />
//                 <Row style={{ marginTop: 12 }}>
//                   <Col span={12}>
//                     <Text type="secondary">{language === "gu" ? "સરેરાશ અંતર:" : "Avg Distance:"}</Text>
//                     <br />
//                     <Text strong>{stats.avgDistance} km</Text>
//                   </Col>
//                   <Col span={12}>
//                     <Text type="secondary">{language === "gu" ? "સરેરાશ સમય:" : "Avg Time:"}</Text>
//                     <br />
//                     <Text strong>{stats.avgHours} hrs</Text>
//                   </Col>
//                 </Row>
//                 <Row style={{ marginTop: 12 }}>
//                   <Col span={12}>
//                     <Text type="secondary">{language === "gu" ? "સરેરાશ સ્ટાફ:" : "Avg Staff:"}</Text>
//                     <br />
//                     <Text strong>{stats.avgStaff}</Text>
//                   </Col>
//                   <Col span={12}>
//                     <Text type="secondary">{language === "gu" ? "શ્રેષ્ઠ અધિકારી:" : "Top Officer:"}</Text>
//                     <br />
//                     <Text strong style={{ fontSize: '12px' }}>{stats.topOfficer}</Text>
//                   </Col>
//                 </Row>
//                 <div style={{ marginTop: 12 }}>
//                   <Text type="secondary">{language === "gu" ? "કુલ અંતર:" : "Total Distance:"}</Text>
//                   <br />
//                   <Text strong>{stats.totalDistance} km</Text>
//                 </div>
//               </Card>
//             </Col>
//           );
//         })}
//       </Row>

     
//       {(dayStats || nightStats || beatStats) && (
//         <Card 
//           size="small" 
//           style={{ marginTop: 16 }}
//           title={language === "gu" ? "વધારાની જાણકારી" : "Additional Insights"}
//         >
//           <Row gutter={[16, 16]}>
//             <Col xs={24} sm={12}>
//               <div>
//                 <Text strong>
//                   {language === "gu" ? "સૌથી વધુ પેટ્રોલિંગ:" : "Most Active Type:"}
//                 </Text>
//                 <br />
//                 {(() => {
//                   const types = [
//                     { name: "Day patrolling", count: dayStats?.totalPatrols || 0 },
//                     { name: "Night patrolling", count: nightStats?.totalPatrols || 0 },
//                     { name: "Beat checking", count: beatStats?.totalPatrols || 0 }
//                   ];
//                   const mostActive = types.reduce((prev, current) => 
//                     prev.count > current.count ? prev : current
//                   );
//                   return (
//                     <Text>
//                       {getTypeDisplayName(mostActive.name)} ({mostActive.count} {language === "gu" ? "પેટ્રોલિંગ" : "patrols"})
//                     </Text>
//                   );
//                 })()}
//               </div>
//             </Col>
//             <Col xs={24} sm={12}>
//               <div>
//                 <Text strong>
//                   {language === "gu" ? "સૌથી વધુ અંતર:" : "Longest Distance Type:"}
//                 </Text>
//                 <br />
//                 {(() => {
//                   const types = [
//                     { name: "Day patrolling", distance: parseFloat(dayStats?.totalDistance || 0) },
//                     { name: "Night patrolling", distance: parseFloat(nightStats?.totalDistance || 0) },
//                     { name: "Beat checking", distance: parseFloat(beatStats?.totalDistance || 0) }
//                   ];
//                   const longestDistance = types.reduce((prev, current) => 
//                     prev.distance > current.distance ? prev : current
//                   );
//                   return (
//                     <Text>
//                       {getTypeDisplayName(longestDistance.name)} ({longestDistance.distance} km)
//                     </Text>
//                   );
//                 })()}
//               </div>
//             </Col>
//           </Row>
//         </Card>
//       )}
//     </div>