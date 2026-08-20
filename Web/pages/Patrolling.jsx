import React, { useState, useEffect, Suspense, lazy, useCallback, useRef } from "react";
import { 
  Table, Button, Input, DatePicker, Modal, Image, Select, Tag, 
  Card, Row, Col, Statistic, Progress, Typography, Pagination, 
  Space, Spin, Alert, message 
} from "antd";
import { 
  SearchOutlined, EyeOutlined, FilterOutlined, ReloadOutlined, DownloadOutlined
} from "@ant-design/icons";
import { FaCalendarCheck, FaRoute, FaUsers, FaSun, FaMoon, FaShieldAlt, FaUserTie, FaTrophy, FaMapMarkedAlt } from "react-icons/fa";
import "./PatrolIncidentLogs.css";
import exportIcon from "../assets/excel.png";
import dayjs from "dayjs";
import noDataImage from "../assets/no-data.png";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE_URL } from "../config";
import axios from "axios";
import { getAuthToken, getAuthHeaders, handleUnauthorized } from "../utils/authUtils";

import startIconImg from "../assets/marker-icon.png";
import endIconImg from "../assets/marker-icon-end.png";
import gujaratlogo from "../assets/FOREST DEPT.jpg";

import DOMPurify from 'dompurify';

const BeatPatrolCoverage = lazy(() => import("./BeatPatrolCoverage"));

import vector from '../assets/Vector.png';
import Analyze_patrolling from '../assets/Analyze_patroll.png';

import gisfylogo from "../assets/Gisfylogo.png";

import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

const Loader = () => {
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

const stripHtmlTags = (htmlString) => {
  if (!htmlString) return '';
  const cleanString = DOMPurify.sanitize(htmlString, { ALLOWED_TAGS: [] });
  return cleanString.trim();
};

const { Title, Text } = Typography;
const { Option } = Select;

const parsePatrolTimestamp = (datetime) => {
  if (!datetime) return null;
  if (datetime instanceof Date) return Number.isNaN(datetime.getTime()) ? null : datetime;
  if (typeof datetime === "string") {
    const match = datetime.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    }
  }
  const date = new Date(datetime);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPatrolDateTimeParts = (datetime) => {
  if (!datetime) return null;
  if (typeof datetime === "string") {
    const match = datetime.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return { date: `${day}-${month}-${year}`, time: `${hour}:${minute}` };
    }
  }
  const date = parsePatrolTimestamp(datetime);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    date: `${parts.day}-${parts.month}-${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  };
};

const getPatrolDateForFilter = (datetime) => {
  const parts = getPatrolDateTimeParts(datetime);
  if (!parts) return null;
  const [day, month, year] = parts.date.split("-");
  return `${year}-${month}-${day}`;
};

const getPatrolHours = (startTime, endTime) => {
  const start = parsePatrolTimestamp(startTime);
  const end = parsePatrolTimestamp(endTime);
  if (!start || !end) return 0;
  const hours = (end - start) / (1000 * 60 * 60);
  return Number.isFinite(hours) && hours >= 0 ? hours : 0;
};

const startIcon = new L.Icon({
  iconUrl: startIconImg,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
 
const endIcon = new L.Icon({
  iconUrl: endIconImg,
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

// Patrol Analysis Dashboard Component
const PatrolAnalysisDashboard = ({ 
  patrolData, 
  language, 
  isLoading,
  showBeatCoverage = false,
  coverageData = null,
  coveragePatrols = [],
  beatFilter = null,
  rangeFilter = null,
  divisionFilter = null,
  startFilter = null,
  endFilter = null,
  exportCoverageToExcel = null
}) => {
  if (isLoading) {
    return (
      <div style={{
        margin: 4,
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: 20,
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center'
      }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          {language === "gu" ? "લોડ થઈ રહ્યું છે..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (!patrolData || patrolData.length === 0) {
    return (
      <div style={{
        margin: 4,
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: 20,
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center'
      }}>
        <Title level={4} style={{ color: '#000000ff' }}>
          {language === "gu" ? "પેટ્રોલિંગ વિશ્લેષણ" : "Patrol Analysis"}
        </Title>
        <Text>{language === "gu" ? "કોઈ ડેટા ઉપલબ્ધ નથી" : "No data available"}</Text>
      </div>
    );
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
    const totalHours = filtered.reduce((sum, item) => sum + getPatrolHours(item.start_time, item.end_time), 0);
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
  const avgDistanceOverall = totalPatrols > 0 ? (totalDistance / totalPatrols).toFixed(1) : 0;
  
  // Calculate total hours
  const totalHours = patrolData.reduce((sum, item) => sum + getPatrolHours(item.start_time, item.end_time), 0);
  
  // Get unique officers
  const uniqueOfficers = [...new Set(patrolData.map(item => item.patrol_officer_name))];

  // Patrol distribution
  const dayPercentage = dayStats ? (dayStats.totalPatrols / totalPatrols * 100).toFixed(0) : 0;
  const nightPercentage = nightStats ? (nightStats.totalPatrols / totalPatrols * 100).toFixed(0) : 0;
  const beatPercentage = beatStats ? (beatStats.totalPatrols / totalPatrols * 100).toFixed(0) : 0;

  const getTypeColor = (type) => {
    switch (type) {
      case "Day patrolling": return "#0084ffff";
      case "Night patrolling": return "#55ff00ff";
      case "Beat checking": return "#6a00ffff";
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
        fontSize: '25px',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {language === "gu" ? "પેટ્રોલિંગ વિશ્લેષણ" : "Patrol Analysis"}
      </Title>
      
      {/* Overall Statistics */}
      {/* Overall Statistics */}
{/* Overall Statistics */}
<Row gutter={[8, 8]} style={{ marginBottom: 24 }}>
  {[
    {
      key: 'total',
      value: totalPatrols,
      title: language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols",
      icon: <FaCalendarCheck />,
      color: 'rgba(56, 189, 248, 0.3)',
      borderColor: 'rgba(56, 189, 248, 0.5)',
    },
    {
      key: 'distance',
      value: avgDistanceOverall,
      title: language === "gu" ? "સરેરાશ અંતર" : "Average Distance",
      suffix: "km",
      icon: <FaRoute />,
      color: 'rgba(0, 255, 162, 0.3)',
      borderColor: 'rgba(0, 255, 162, 1)'
    },
    {
      key: 'officers',
      value: uniqueOfficers.length,
      title: language === "gu" ? "કુલ અધિકારીઓ" : "Total Officers",
      icon: <FaUsers />,
      color: 'rgba(64, 0, 255, 0.3)',
      borderColor: 'rgba(64, 0, 255, 1)'
    }
  ].map((item) => (
    <Col xs={24} sm={12} md={8} key={item.key}>
      <div style={{
        background: item.isGradient ? item.color : item.color,
        backdropFilter: item.isGradient ? 'none' : 'blur(12px)',
        borderRadius: 12,
        paddingTop: 16,
        border: item.isGradient ? 'none' : `1px solid ${item.borderColor}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        height: '100%',
        textAlign: 'center'
      }}>
        <Statistic
          title={
            <span style={{
              color: 'rgba(0, 0, 0, 0.9)',
              fontSize: '16px',
              fontWeight: 500
            }}>
              {item.title}
            </span>
          }
          value={item.value}
          suffix={item.suffix}
          prefix={
            !item.isGradient && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.2)',
                marginRight: 8,
              }}>
                {item.icon &&
                  React.cloneElement(item.icon, {
                    style: { color: 'white', fontSize: '18px' }
                  })}
              </div>
            )
          }
          valueStyle={{
            color: '#000',
            fontSize: '22px',
            fontWeight: 600
          }}
        />
      </div>
    </Col>
  ))}
</Row>

      {/* Beat Coverage Analysis Section - Moved Here */}
      {/* {showBeatCoverage && coverageData && (beatFilter || rangeFilter || divisionFilter) && (
        <div style={{
          marginTop: '16px',
          marginBottom: '24px',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px 8px 0 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src={Analyze_patrolling} 
                alt="Coverage" 
                style={{ width: '18px', height: '18px' }} 
              />
              <p style={{ color: '#115F22', margin: 0, fontWeight: 700 }}>
                {(() => {
                  // Get the selected location name
                  let locationName = '';
                  if (beatFilter) {
                    locationName = beatFilter;
                  } else if (rangeFilter) {
                    locationName = rangeFilter;
                  } else if (divisionFilter) {
                    locationName = divisionFilter;
                  }
                  
                  // Get the date range text
                  const startDateText = startFilter ? startFilter.format('MMMM, YYYY') : '';
                  const endDateText = endFilter ? endFilter.format('MMMM, YYYY') : '';
                  
                  // Format the date range for display
                  let dateRangeText = '';
                  if (startDateText && endDateText) {
                    if (startDateText === endDateText) {
                      dateRangeText = startDateText;
                    } else {
                      dateRangeText = `${startDateText} - ${endDateText}`;
                    }
                  } else if (startDateText) {
                    dateRangeText = startDateText;
                  } else if (endDateText) {
                    dateRangeText = endDateText;
                  } else {
                    dateRangeText = '';
                  }
                  
                  // Generate the analysis text based on language
                  if (language === "gu") {
                    if (beatFilter) {
                      return dateRangeText ? `બીટ પેટ્રોલિંગ કવરેજનું વિશ્લેષણ: ${locationName} - ${dateRangeText}` : `બીટ પેટ્રોલિંગ કવરેજનું વિશ્લેષણ: ${locationName}`;
                    } else if (rangeFilter) {
                      return dateRangeText ? `રેંજ પેટ્રોલિંગ કવરેજનું વિશ્લેષણ: ${locationName} - ${dateRangeText}` : `રેંજ પેટ્રોલિંગ કવરેજનું વિશ્લેષણ: ${locationName}`;
                    } else if (divisionFilter) {
                      return dateRangeText ? `વિભાગ પેટ્રોલિંગ કવરેજનું વિશ્લેષણ: ${locationName} - ${dateRangeText}` : `વિભાગ પેટ્રોલિંગ કવરેજનું વિશ્લેષણ: ${locationName}`;
                    }
                  } else {
                    // English
                    if (beatFilter) {
                      return dateRangeText ? `Analyzing patrolling coverage for Beat: ${locationName} - ${dateRangeText}` : `Analyzing patrolling coverage for Beat: ${locationName}`;
                    } else if (rangeFilter) {
                      return dateRangeText ? `Analyzing patrolling coverage for Range: ${locationName} - ${dateRangeText}` : `Analyzing patrolling coverage for Range: ${locationName}`;
                    } else if (divisionFilter) {
                      return dateRangeText ? `Analyzing patrolling coverage for Division: ${locationName} - ${dateRangeText}` : `Analyzing patrolling coverage for Division: ${locationName}`;
                    }
                  }
                  
                  // Fallback
                  return language === "gu" ? "પેટ્રોલિંગ કવરેજનું વિશ્લેષણ" : "Analyzing patrolling coverage";
                })()}
              </p>
            </div>
            {exportCoverageToExcel && (
              <Button
                onClick={exportCoverageToExcel}
                style={{
                  background: 'rgb(0, 166, 81)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '18px 22px',
                  height: '32px'
                }}
                size="small"
              >
                <img src={vector} alt="Export" style={{ width: '16px', height: '16px' }} />
                {language === "gu" ? "એક્સેલ" : "Export"}
              </Button>
            )}
          </div>
         
        </div>
      )} */}

      {/* Patrol Distribution */}
      <div className="patrol-distribution-section">
        <Text strong className="patrol-distribution-heading">
          {language === "gu" ? "પેટ્રોલિંગ વિતરણ" : "Patrol Distribution"}
        </Text>
        <Row gutter={[16, 16]}>
          {[
            { stats: dayStats, type: "Day Patrolling", percent: dayPercentage, color: '#17a8f5', icon: <FaSun /> },
            { stats: nightStats, type: "Night Patrolling", percent: nightPercentage, color: '#2fb36b', icon: <FaMoon /> },
            { stats: beatStats, type: "Beat Checking", percent: beatPercentage, color: '#64748b', icon: <FaShieldAlt /> }
          ].map(({ stats, type, percent, color, icon }) => {
            const hasData = stats !== null;
            return (
              <Col xs={24} lg={8} key={type}>
                <div className="patrol-distribution-card" style={{ borderColor: hasData ? color : '#d9d9d9' }}>
                  <div className="patrol-progress-pane">
                    <Progress
                      type="circle"
                      percent={parseInt(percent)}
                      width={108}
                      strokeColor={color}
                      trailColor="#e5e7eb"
                      strokeWidth={8}
                      format={value => <span className="patrol-progress-text">{value}%</span>}
                    />
                  </div>

                  <div className="patrol-card-body">
                    <div className="patrol-type-header">
                      <span className="patrol-type-icon" style={{ color }}>{icon}</span>
                      <div>
                        <div className="patrol-type-name">{getTypeDisplayName(type)}</div>
                        <div className="patrol-type-label">{language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols"}</div>
                        <div className="patrol-type-count">{hasData ? stats.totalPatrols : '0'}</div>
                      </div>
                    </div>

                    <div className="patrol-mini-stats">
                      {[
                        { label: language === "gu" ? "સરેરાશ અંતર" : "Avg Distance", value: hasData ? `${stats.avgDistance} km` : '0.0 km' },
                        { label: language === "gu" ? "સરેરાશ સમય" : "Avg Time", value: hasData ? `${stats.avgHours} hrs` : '0.0 hrs' },
                        { label: language === "gu" ? "સરેરાશ સ્ટાફ" : "Avg Staff", value: hasData ? stats.avgStaff : '0' },
                        { label: language === "gu" ? "કુલ અંતર" : "Total Distance", value: hasData ? `${stats.totalDistance} km` : '0.0 km' }
                      ].map((item) => (
                        <div className="patrol-mini-stat" key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="patrol-top-officer">
                      <FaUserTie />
                      <span>{language === "gu" ? "શ્રેષ્ઠ અધિકારી:" : "Top Officer:"}</span>
                      <strong>{hasData && stats.topOfficer ? stats.topOfficer : 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </div>

      {/* Quick Insights */}
      {(dayStats || nightStats || beatStats) && (
        <div className="patrol-quick-insights">
          <Text strong className="patrol-quick-insights-heading">
            {language === "gu" ? "ઝડપી જાણકારી" : "Quick Insights"}
          </Text>
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              {(() => {
                const types = [
                  { name: "Day Patrolling", count: dayStats?.totalPatrols || 0 },
                  { name: "Night Patrolling", count: nightStats?.totalPatrols || 0 },
                  { name: "Beat Checking", count: beatStats?.totalPatrols || 0 }
                ];
                const mostActive = types.reduce((prev, current) => 
                  prev.count > current.count ? prev : current
                );
                return (
                  <div className="patrol-insight-card">
                    <div className="patrol-insight-icon"><FaTrophy /></div>
                    <div className="patrol-insight-content">
                      <div className="patrol-insight-label">{language === "gu" ? "સૌથી સક્રિય પ્રકાર" : "Most Active Type"}</div>
                      <div className="patrol-insight-main">
                        <span>{getTypeDisplayName(mostActive.name)}</span>
                        <em>{mostActive.count} {language === "gu" ? "પેટ્રોલિંગ" : "patrols"}</em>
                      </div>
                      <div className="patrol-insight-subtitle">
                        {language === "gu" ? "કુલ પેટ્રોલિંગ પ્રવૃત્તિમાં સૌથી વધુ હિસ્સો." : `Accounts for ${totalPatrols ? Math.round((mostActive.count / totalPatrols) * 100) : 0}% of all patrol activities.`}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Col>
            <Col xs={24} md={12}>
              {(() => {
                const types = [
                  { name: "Day Patrolling", distance: parseFloat(dayStats?.totalDistance || 0) },
                  { name: "Night Patrolling", distance: parseFloat(nightStats?.totalDistance || 0) },
                  { name: "Beat Checking", distance: parseFloat(beatStats?.totalDistance || 0) }
                ];
                const longestDistance = types.reduce((prev, current) => 
                  prev.distance > current.distance ? prev : current
                );
                return (
                  <div className="patrol-insight-card">
                    <div className="patrol-insight-icon"><FaMapMarkedAlt /></div>
                    <div className="patrol-insight-content">
                      <div className="patrol-insight-label">{language === "gu" ? "સૌથી લાંબું અંતર" : "Longest Distance Type"}</div>
                      <div className="patrol-insight-main">
                        <span>{getTypeDisplayName(longestDistance.name)}</span>
                        <em>{longestDistance.distance} km</em>
                      </div>
                      <div className="patrol-insight-subtitle">
                        {language === "gu" ? "સૌથી વધુ કુલ અંતર આવરી લેવામાં આવ્યું." : "Highest total distance covered."}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
};

// Main PatrolIncidentLogs Component
const PatrolIncidentLogs = () => {
  const [patrolData, setPatrolData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [dashboardData, setDashboardData] = useState([]);
  const [selectedPatrol, setSelectedPatrol] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isExportConfirmVisible, setIsExportConfirmVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const { language } = useLanguage();
  const [showmaproute, setShowMapRoute] = useState(false);
  
  // Filter states
  const [searchText, setSearchText] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("");
  const [beatFilter, setBeatFilter] = useState("");
  const [forestId, setForestId] = useState("");
  const [roundFilter, setRoundFilter] = useState("");
  const [patrolLocationFilter, setPatrolLocationFilter] = useState("");
  const [patrolLocations, setPatrolLocations] = useState([]);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  
  // Beat coverage analysis states
  const [selectedBeatForCoverage, setSelectedBeatForCoverage] = useState(null);
  const [showBeatCoverage, setShowBeatCoverage] = useState(false);
  const [isAnalyzingCoverage, setIsAnalyzingCoverage] = useState(false);
  const [coverageData, setCoverageData] = useState(null);
  const [coveragePatrols, setCoveragePatrols] = useState([]);
  
  // Hierarchy filter states
  const [forestTypes, setForestTypes] = useState([]);
  const [divisions1, setDivisions1] = useState([]);
  const [beats1, setBeats1] = useState([]);
  const [ranges1, setRanges1] = useState([]);
  const [filteredRanges, setFilteredRanges] = useState([]);
  const [filteredBeats, setFilteredBeats] = useState([]);
  
  const [locationSearch, setLocationSearch] = useState("");
  const [coupeFilter, setCoupeFilter] = useState("");
  
  const filterTimeoutRef = useRef(null);

  // In your buildFilters function in PatrolIncidentLogs.js
const buildFilters = useCallback(() => {
  const filters = {};
  if (searchText?.trim()) filters.officer_name = searchText.trim();
  
  // Fix date handling
  if (startFilter) {
    // Send start date with time 00:00:00
    filters.start_date = startFilter.format('YYYY-MM-DD') + ' 00:00:00';
  }
  
  if (endFilter) {
    // Send end date with time 23:59:59
    filters.end_date = endFilter.format('YYYY-MM-DD') + ' 23:59:59';
  }
  
  if (typeFilter) filters.type_name = typeFilter;
  if (divisionFilter) filters.division = divisionFilter;
  if (rangeFilter) filters.range = rangeFilter;
  if (roundFilter) filters.round = roundFilter;
  if (beatFilter) filters.beat = beatFilter;
  if (forestId) filters.forest_id = forestId;
  if (patrolLocationFilter) filters.patrolling_location = patrolLocationFilter;
  
  return filters;
}, [searchText, startFilter, endFilter, typeFilter, divisionFilter, rangeFilter, roundFilter, beatFilter, forestId, patrolLocationFilter]);

const applyPatrolFilters = useCallback((records) => {
  const search = searchText?.trim().toLowerCase();
  const startDate = startFilter ? startFilter.startOf('day') : null;
  const endDate = endFilter ? endFilter.endOf('day') : null;

  return records.filter((item) => {
    if (!item || !(item.patrol_id || item.start_time || item.patrol_officer_name || item.type_name)) return false;

    if (search) {
      const officer = (item.patrol_officer_name || '').toLowerCase();
      if (!officer.includes(search)) return false;
    }

    if (typeFilter && item.type_name !== typeFilter) return false;
    if (divisionFilter && item.division !== divisionFilter) return false;
    if (rangeFilter && item.range !== rangeFilter) return false;
    if (roundFilter && item.round !== roundFilter) return false;
    if (beatFilter && item.beat !== beatFilter) return false;
    if (forestId && String(item.forest_id || '') !== String(forestId)) return false;
    if (patrolLocationFilter && (item.patrolling_location || '') !== patrolLocationFilter) return false;

    if (startDate || endDate) {
      const parsedStart = parsePatrolTimestamp(item.start_time);
      const parsedEnd = parsePatrolTimestamp(item.end_time) || parsedStart;
      const start = parsedStart ? dayjs(parsedStart) : null;
      const end = parsedEnd ? dayjs(parsedEnd) : start;
      if (!start?.isValid()) return false;
      if (startDate && end.isBefore(startDate)) return false;
      if (endDate && start.isAfter(endDate)) return false;
    }

    return true;
  });
}, [searchText, startFilter, endFilter, typeFilter, divisionFilter, rangeFilter, roundFilter, beatFilter, forestId, patrolLocationFilter]);

  // Fetch filtered data for dashboard (all records without pagination)
  // In fetchDashboardData function, add the same filtering logic
const fetchDashboardData = useCallback(async () => {
  const filters = buildFilters();
  const hasActiveFilters = Object.keys(filters).length > 0;
  
  setIsDashboardLoading(true);
  try {
    const token = getAuthToken();
    if (!token) return;
    
    if (!hasActiveFilters) {
      // Fetch all patrol data without filters
      const response = await fetch(`${API_BASE_URL}/api/patrol-info-all`, {
        method: "GET",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
      });

      
      if (handleUnauthorized(response.status)) return;
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      let formattedData = Array.isArray(data.data) ? data.data : [];
      formattedData = formattedData
        .filter(item => item && (item.patrol_id || item.start_time || item.patrol_officer_name || item.type_name))
        .map((item, index) => ({
          key: item.patrol_id || `patrol-${index}`,
          ...item,
          patrol_officer_name: stripHtmlTags(item.patrol_officer_name),
          division: stripHtmlTags(item.division),
          range: stripHtmlTags(item.range),
          beat: stripHtmlTags(item.beat),
          patrolling_location: stripHtmlTags(item.patrolling_location),
          current_location_distict: stripHtmlTags(item.current_location_distict),
          current_location_village: stripHtmlTags(item.current_location_village),
          start_location: stripHtmlTags(item.start_location),
          end_location: stripHtmlTags(item.end_location)
        }));
      
      // ========== ADD SAME DATE FILTER HERE ==========
      if (startFilter && endFilter && startFilter.format('YYYY-MM-DD') === endFilter.format('YYYY-MM-DD')) {
        const selectedDate = startFilter.format('YYYY-MM-DD');
        formattedData = formattedData.filter(item => {
          const itemStartDate = getPatrolDateForFilter(item.start_time);
          const itemEndDate = getPatrolDateForFilter(item.end_time);
          return itemStartDate === selectedDate || itemEndDate === selectedDate;
        });
      }
      // ========== END OF ADDED CODE ==========
      
      setDashboardData(applyPatrolFilters(formattedData));
    } else {
      // Similar filtering for filtered data
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '10000',
        ...filters
      });

      
      const response = await fetch(`${API_BASE_URL}/api/patrol-info-page?${queryParams}`, {
        method: "GET",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
      });

      
      if (handleUnauthorized(response.status)) return;
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      let formattedData = Array.isArray(data.data) ? data.data : [];
      formattedData = formattedData
        .filter(item => item && (item.patrol_id || item.start_time || item.patrol_officer_name || item.type_name))
        .map((item, index) => ({
          key: item.patrol_id || `patrol-filtered-${index}`,
          ...item,
          patrol_officer_name: stripHtmlTags(item.patrol_officer_name),
          division: stripHtmlTags(item.division),
          range: stripHtmlTags(item.range),
          beat: stripHtmlTags(item.beat),
          patrolling_location: stripHtmlTags(item.patrolling_location),
          current_location_distict: stripHtmlTags(item.current_location_distict),
          current_location_village: stripHtmlTags(item.current_location_village),
          start_location: stripHtmlTags(item.start_location),
          end_location: stripHtmlTags(item.end_location)
        }));
      
      // ========== ADD SAME DATE FILTER HERE ==========
      if (startFilter && endFilter && startFilter.format('YYYY-MM-DD') === endFilter.format('YYYY-MM-DD')) {
        const selectedDate = startFilter.format('YYYY-MM-DD');
        formattedData = formattedData.filter(item => {
          const itemStartDate = getPatrolDateForFilter(item.start_time);
          const itemEndDate = getPatrolDateForFilter(item.end_time);
          return itemStartDate === selectedDate || itemEndDate === selectedDate;
        });
      }
      // ========== END OF ADDED CODE ==========
      
      setDashboardData(applyPatrolFilters(formattedData));
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  } finally {
    setIsDashboardLoading(false);
  }
}, [buildFilters, applyPatrolFilters, startFilter, endFilter]); // Add dependencies

  // Fetch patrol data with pagination
  // Fetch patrol data with pagination
const fetchPatrolData = useCallback(async (page = 1, limit = 5) => {
  const filters = buildFilters();
  const hasActiveFilters = Object.keys(filters).length > 0;
  
  setIsLoading(true);
  setPaginationLoading(true);
  setIsFiltering(hasActiveFilters);
  
  try {
    const token = getAuthToken();
    if (!token) return;
    
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters
    });
    
    const response = await fetch(`${API_BASE_URL}/api/patrol-info-page?${params.toString()}`, {
      method: "GET",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
    });

    
    if (handleUnauthorized(response.status)) return;
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    let formattedData = Array.isArray(data.data) ? data.data : [];
    formattedData = formattedData
      .filter(item => item && (item.patrol_id || item.start_time || item.patrol_officer_name || item.type_name))
      .map((item, index) => ({
        key: item.patrol_id || `patrol-${index}`,
        ...item,
        patrol_officer_name: stripHtmlTags(item.patrol_officer_name),
        division: stripHtmlTags(item.division),
        range: stripHtmlTags(item.range),
        beat: stripHtmlTags(item.beat),
        patrolling_location: stripHtmlTags(item.patrolling_location),
        current_location_distict: stripHtmlTags(item.current_location_distict),
        current_location_village: stripHtmlTags(item.current_location_village),
        start_location: stripHtmlTags(item.start_location),
        end_location: stripHtmlTags(item.end_location)
      }));
    
    // ========== ADD THE DATE FILTER HERE ==========
    // Filter for same date selection
    if (startFilter && endFilter && startFilter.format('YYYY-MM-DD') === endFilter.format('YYYY-MM-DD')) {
      const selectedDate = startFilter.format('YYYY-MM-DD');
      const originalLength = formattedData.length;
      
      formattedData = formattedData.filter(item => {
        const itemStartDate = getPatrolDateForFilter(item.start_time);
        const itemEndDate = getPatrolDateForFilter(item.end_time);
        return itemStartDate === selectedDate || itemEndDate === selectedDate;
      });
      
      
      // Update pagination counts based on filtered data
      if (data.pagination) {
        setTotalItems(formattedData.length);
        setTotalPages(Math.ceil(formattedData.length / pageSize));
      }
    } else {
      // Use original pagination from backend for date ranges
      if (data.pagination) {
        setCurrentPage(data.pagination.currentPage);
        setPageSize(data.pagination.pageSize);
        setTotalItems(data.pagination.totalItems);
        setTotalPages(data.pagination.totalPages);
      }
    }
    // ========== END OF ADDED CODE ==========
    
    setPatrolData(formattedData);
    setFilteredData(formattedData);
    
  } catch (error) {
    console.error("Error fetching Patrol data:", error);
    setPatrolData([]);
    setFilteredData([]);
    setTotalItems(0);
    setTotalPages(0);
  } finally {
    setIsLoading(false);
    setPaginationLoading(false);
    setIsFiltering(false);
  }
}, [buildFilters, startFilter, endFilter, pageSize]); // IMPORTANT: Add startFilter and endFilter to dependencies

  // Combined fetch function that updates both table and dashboard
  const fetchAllData = useCallback(async (page = 1, limit = 5) => {
    await Promise.all([
      fetchPatrolData(page, limit),
      fetchDashboardData()
    ]);
  }, [fetchPatrolData, fetchDashboardData]);

  // Handle search with debounce
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchAllData(1, pageSize);
  }, [fetchAllData, pageSize]);

  // Debounced search effect
  useEffect(() => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }
    
    filterTimeoutRef.current = setTimeout(() => {
      const hasActiveFilters = searchText?.trim() || startFilter || endFilter || typeFilter || 
                            divisionFilter || rangeFilter || roundFilter || beatFilter || forestId;
      
      if (hasActiveFilters) {
        handleSearch();
      } else if (searchText === "" && !startFilter && !endFilter && !typeFilter && 
                 !divisionFilter && !rangeFilter && !roundFilter && !beatFilter && !forestId) {
        handleSearch();
      }
    }, 500);
    
    return () => {
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, [searchText, startFilter, endFilter, typeFilter, divisionFilter, rangeFilter, roundFilter, beatFilter, forestId, handleSearch]);

  // AUTO-ANALYZE EFFECT - This automatically analyzes coverage when beat/range/division AND both dates are selected
  useEffect(() => {
    // Check if we have location filter (beat, range, or division) AND both dates
    const hasLocationFilter = (beatFilter || rangeFilter || divisionFilter);
    const hasDates = (startFilter && endFilter);
    
    if (hasLocationFilter && hasDates) {
      // Small delay to ensure all states are updated
      const timer = setTimeout(() => {
        fetchBeatCoverageData();
      }, 500);
      
      return () => clearTimeout(timer);
    } else if (!hasLocationFilter || !hasDates) {
      // Clear coverage data when filters are cleared
      setShowBeatCoverage(false);
      setCoverageData(null);
      setCoveragePatrols([]);
    }
  }, [beatFilter, rangeFilter, divisionFilter, startFilter, endFilter]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchText("");
    setLocationSearch("");
    setStartFilter(null);
    setEndFilter(null);
    setTypeFilter("");
    setForestId("");
    setDivisionFilter("");
    setRangeFilter("");
    setRoundFilter("");
    setBeatFilter("");
    setCoupeFilter("");
    setPatrolLocationFilter("");
    setFilteredRanges([]);
    setFilteredBeats([]);
    setSelectedBeatForCoverage(null);
    setShowBeatCoverage(false);
    setCoverageData(null);
    setCoveragePatrols([]);
    setCurrentPage(1);
    fetchAllData(1, pageSize);
  };

  const handlePageChange = (page, newPageSize) => {
    setCurrentPage(page);
    setPageSize(newPageSize);
    fetchPatrolData(page, newPageSize);
  };

  // Extract unique patrol locations from data
  useEffect(() => {
    const locations = [...new Set(
      patrolData
        .map(item => item.patrolling_location)
        .filter(Boolean)
    )].sort();
    setPatrolLocations(locations);
  }, [patrolData]);

  // Initial load
  useEffect(() => {
    fetchAllData(1, pageSize);
    
    // Fetch hierarchy data
    axios.get(`${API_BASE_URL}/api/forest-types`).then((res) => setForestTypes(res.data)).catch((err) => console.error(err));
    axios.get(`${API_BASE_URL}/api/patrolling-division`).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) setDivisions1(data);
      else if (data && data.data && Array.isArray(data.data)) setDivisions1(data.data);
      else setDivisions1([]);
    }).catch((err) => console.error("Error fetching divisions:", err));
    
    axios.get(`${API_BASE_URL}/api/patrolling-range`).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) setRanges1(data);
      else if (data && data.data && Array.isArray(data.data)) setRanges1(data.data);
      else setRanges1([]);
    }).catch((err) => console.error("Error fetching ranges:", err));
    
    axios.get(`${API_BASE_URL}/api/patrolling-beat`).then((res) => {
      const data = res.data;
      if (Array.isArray(data)) setBeats1(data);
      else if (data && data.data && Array.isArray(data.data)) setBeats1(data.data);
      else setBeats1([]);
    }).catch((err) => console.error("Error fetching beats:", err));
  }, []);

  const handleDivisionFilterChange = (value) => {
    setDivisionFilter(value);
    setRangeFilter("");
    setBeatFilter("");
    setSelectedBeatForCoverage(null);
    setShowBeatCoverage(false);
    setCoverageData(null);
    setCoveragePatrols([]);
    
    if (value) {
      const filtered = ranges1.filter(range => {
        if (typeof range === 'string') return true;
        return range.division === value || range.division_name === value;
      });
      
      if (filtered.length > 0) {
        setFilteredRanges(filtered);
      } else {
        fetchRangesByDivision(value);
      }
    } else {
      setFilteredRanges([]);
    }
  };

  const fetchRangesByDivision = async (division) => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await axios.get(
        `${API_BASE_URL}/api/patrolling-range-by-division?division=${encodeURIComponent(division)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data && response.data.data) setFilteredRanges(response.data.data);
    } catch (error) {
      console.error("Error fetching ranges by division:", error);
      setFilteredRanges([]);
    }
  };

  const handleRangeFilterChange = (value) => {
    setRangeFilter(value);
    setBeatFilter("");
    setSelectedBeatForCoverage(null);
    setShowBeatCoverage(false);
    setCoverageData(null);
    setCoveragePatrols([]);
    
    if (value && divisionFilter) {
      fetchBeatsByRange(value, divisionFilter);
    } else {
      setFilteredBeats([]);
    }
  };

  const fetchBeatsByRange = async (range, division) => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await axios.get(
        `${API_BASE_URL}/api/patrolling-beat-by-range?range=${encodeURIComponent(range)}&division=${encodeURIComponent(division)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data && response.data.data) setFilteredBeats(response.data.data);
    } catch (error) {
      console.error("Error fetching beats by range:", error);
      setFilteredBeats([]);
    }
  };

  const handleBeatFilterChange = (value) => {
    let selectedRange = null;
    if (value) {
      const beatObject = [...beats1, ...filteredBeats].find(beat => {
        const beatValue = typeof beat === 'string' ? beat : (beat.beat || beat.name || beat.value);
        return beatValue === value;
      });
      if (beatObject && typeof beatObject === 'object') {
        selectedRange = beatObject.range || beatObject.range_name || null;
      }
    }
    setBeatFilter(value);
    setSelectedBeatForCoverage(value);
    if (selectedRange) setRangeFilter(selectedRange);
    else if (!value) setRangeFilter("");
    setShowBeatCoverage(false);
    setCoverageData(null);
    setCoveragePatrols([]);
  };

  const formatDateTime = (datetime) => {
    if (!datetime) return { date: "-", time: "-" };
    return getPatrolDateTimeParts(datetime) || { date: "-", time: "-" };
  };

  // Fetch beat coverage data using existing startFilter and endFilter
  const fetchBeatCoverageData = async () => {
    if (!beatFilter && !rangeFilter && !divisionFilter) {
      message.warning(language === "gu" ? "કૃપા કરીને બીટ, રેંજ અથવા વિભાગ પસંદ કરો" : "Please select a beat, range or division");
      return;
    }
    if (!startFilter || !endFilter) {
      message.warning(language === "gu" ? "કૃપા કરીને શરૂઆત અને સમાપ્તિ તારીખ પસંદ કરો" : "Please select start and end date from the filters above");
      return;
    }

    setIsAnalyzingCoverage(true);
    try {
      const token = getAuthToken();
      if (!token) return;
      const requestPayload = { 
        start_date: startFilter.format('YYYY-MM-DD'),
        end_date: endFilter.format('YYYY-MM-DD')
      };
      
      if (beatFilter) requestPayload.coupe_table = beatFilter.toUpperCase();
      else if (rangeFilter) {
        requestPayload.range = rangeFilter;
        if (divisionFilter) requestPayload.division = divisionFilter;
      } else if (divisionFilter) requestPayload.division = divisionFilter;
      
      const response = await axios.post(`${API_BASE_URL}/api/coupe-patrol-coverage`, requestPayload, {
        headers: getAuthHeaders({ "Content-Type": "application/json" })
      });

      if (response.data.success) {
  const data = response.data.data;
  
  // Check if we have actual data or zeros
  const hasValidData = data.coupe_area_sq_m && Number(data.coupe_area_sq_m) > 0;
  
  setCoverageData(data);
  setCoveragePatrols(data.patrols_covering_coupe || []);
  
  if (hasValidData) {
    message.success(language === "gu" ? "કવરેજ ડેટા સફળતાપૂર્વક લોડ થયો" : "Coverage data loaded successfully");
  } else {
    message.info(language === "gu" ? "આ સમયગાળા માટે કોઈ કવરેજ ડેટા ઉપલબ્ધ નથી" : "No coverage data available for this period");
  }
  
  setShowBeatCoverage(true);
} else {
  message.warning(response.data.message || (language === "gu" ? "કોઈ કવરેજ ડેટા મળ્યો નથી" : "No coverage data found"));
  // Set to null values to show N/A
  setCoverageData({
    coupe_area_sq_m: null,
    patrol_area_sq_m: null,
    coverage_percentage: null,
    patrols_covering_coupe: []
  });
  setCoveragePatrols([]);
  setShowBeatCoverage(true);
}
    } catch (err) {
      console.error("Error fetching coverage data:", err);
      message.error(language === "gu" ? "કવરેજ ડેટા લોડ કરવામાં નિષ્ફળ" : "Failed to load coverage data");
    } finally {
      setIsAnalyzingCoverage(false);
    }
  };

  const exportCoverageToExcel = async () => {
    if (!coverageData) return;

    const [XLSX, { saveAs }] = await Promise.all([
      import("xlsx"),
      import("file-saver"),
    ]);

    const formatDateTime = (dateTime) => {
      if (!dateTime) return "N/A";
      const parts = getPatrolDateTimeParts(dateTime);
      return parts ? `${parts.date} ${parts.time}` : "N/A";
    };

    const formatDuration = (startTime, endTime) => {
      if (!startTime || !endTime) return "N/A";
      const start = parsePatrolTimestamp(startTime);
      const end = parsePatrolTimestamp(endTime);
      if (!start || !end) return "N/A";
      const durationMs = end - start;
      if (!Number.isFinite(durationMs) || durationMs < 0) return "N/A";
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    };

    const filterType = beatFilter ? "Beat" : (rangeFilter ? "Range" : "Division");
    const filterValue = beatFilter || rangeFilter || divisionFilter;

    const summaryData = [{
      [filterType]: filterValue,
      "Area (sq m)": coverageData.coupe_area_sq_m,
      "Patrol Covered Area (sq m)": coverageData.patrol_area_sq_m,
      "Coverage %": coverageData.coverage_percentage,
      "Date Range": `${startFilter ? startFilter.format('YYYY-MM-DD') : 'N/A'} to ${endFilter ? endFilter.format('YYYY-MM-DD') : 'N/A'}`
    }];

    const patrolsData = coveragePatrols.map((patrol) => ({
      "Patrol ID": patrol.patrol_id,
      "Start Time": formatDateTime(patrol.start_time),
      "End Time": formatDateTime(patrol.end_time),
      "Duration": formatDuration(patrol.start_time, patrol.end_time),
      "Patrol Officer": patrol.patrol_officer_name,
      "Patrol Location": patrol.patrolling_location || "N/A",
      "District": patrol.current_location_distict || "N/A",
      "Village": patrol.current_location_village || "N/A",
      "Distance (kms)": patrol.distance_kms,
      "Start Location": patrol.start_location,
      "End Location": patrol.end_location,
    }));

    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Coverage Summary");

    if (patrolsData.length > 0) {
      const patrolSheet = XLSX.utils.json_to_sheet(patrolsData);
      XLSX.utils.book_append_sheet(wb, patrolSheet, "Patrols");
    }

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
    const fileName = `${filterValue}_patrol_coverage_${startFilter ? startFilter.format('YYYY-MM-DD') : 'N/A'}_to_${endFilter ? endFilter.format('YYYY-MM-DD') : 'N/A'}.xlsx`;
    saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), fileName);
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

  const getTypeColor = (type) => {
    switch (type) {
      case "Day patrolling": return "blue";
      case "Night patrolling": return "green";
      case "Beat checking": return "purple";
      default: return "default";
    }
  };

  const columns = [
    {
      title: language === "gu" ? "ક્રમાંક" : "Sr. No.",
      key: "serial",
      align: "center",
      width: 80,
      render: (text, record, index) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type",
      dataIndex: "type_name",
      key: "type_name",
      align: "center",
      render: (type) => <Tag color={getTypeColor(type)}>{getTypeDisplayName(type)}</Tag>,
    },
    {
      title: language === "gu" ? "અધિકારીનું નામ" : "Officer Name",
      dataIndex: "patrol_officer_name",
      key: "patrol_officer_name",
      align: "center",
    },
    {
      title: language === "gu" ? "વિભાગ" : "Division",
      dataIndex: "division",
      key: "division",
      align: "center",
    },
    {
      title: language === "gu" ? "રેન્જ" : "Range",
      dataIndex: "range",
      key: "range",
      align: "center",
    },
    {
      title: language === "gu" ? "બીટ" : "Beat",
      dataIndex: "beat",
      key: "beat",
      align: "center",
    },
    {
      title: language === "gu" ? "પેટ્રોલિંગ સ્થાન" : "Patrol Location",
      dataIndex: "patrolling_location",
      key: "patrolling_location",
      align: "center",
      render: (value) => value || "N/A",
    },
    {
      title: language === "gu" ? "જિલ્લો" : "District",
      dataIndex: "current_location_distict",
      key: "current_location_distict",
      align: "center",
      render: (value) => value || "N/A",
    },
    {
      title: language === "gu" ? "ગામ" : "Village",
      dataIndex: "current_location_village",
      key: "current_location_village",
      align: "center",
      render: (value) => value || "N/A",
    },
    {
      title: language === "gu" ? "શરૂઆતની તારીખ" : "Search by Start Date",
      key: "start_date",
      align: "center",
      render: (record) => formatDateTime(record.start_time).date,
      sorter: (a, b) => (parsePatrolTimestamp(a.start_time)?.getTime() || 0) - (parsePatrolTimestamp(b.start_time)?.getTime() || 0),
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
      sorter: (a, b) => (parsePatrolTimestamp(a.end_time)?.getTime() || 0) - (parsePatrolTimestamp(b.end_time)?.getTime() || 0),
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

  const downloadBase64Image = (image, fallbackName) => {
    if (!image?.image_data) {
      message.warning(language === "gu" ? "છબી ઉપલબ્ધ નથી" : "Image is not available");
      return;
    }

    const mimeType = image.image_type || "image/jpeg";
    const extension = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : mimeType.includes("heic") ? "heic" : "jpg";
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${image.image_data}`;
    link.download = `${fallbackName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getExportFilterSummary = () => [
    `${language === "gu" ? "અધિકારીનું નામ" : "Officer Name"}: ${searchText || "All"}`,
    `${language === "gu" ? "વિભાગ" : "Division"}: ${divisionFilter || "All"}`,
    `${language === "gu" ? "રેન્જ" : "Range"}: ${rangeFilter || "All"}`,
    `${language === "gu" ? "બીટ" : "Beat"}: ${beatFilter || "All"}`,
    `${language === "gu" ? "પેટ્રોલિંગ સ્થાન" : "Patrol Location"}: ${patrolLocationFilter || "All"}`,
    `${language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type"}: ${typeFilter ? getTypeDisplayName(typeFilter) : "All"}`,
    `${language === "gu" ? "શરૂઆતની તારીખ" : "Start Date"}: ${startFilter ? startFilter.format('YYYY-MM-DD') : "All"}`,
    `${language === "gu" ? "સમાપ્તિ તારીખ" : "End Date"}: ${endFilter ? endFilter.format('YYYY-MM-DD') : "All"}`,
    `${language === "gu" ? "કુલ રેકોર્ડ" : "Total Records"}: ${filteredData.length}`,
  ];

  const confirmExportTableToExcel = () => {
    setIsExportConfirmVisible(true);
  };

  const handleExportConfirm = async () => {
    setIsExportConfirmVisible(false);
    setIsExporting(true);
    try {
      await exportTableToExcel();
    } catch (err) {
      console.error("Export error:", err);
      message.error(language === "gu" ? "નિકાસ નિષ્ફળ" : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const CustomPagination = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginTop: 16,
      padding: '16px',
      borderRadius: '8px',
      flexWrap: 'wrap',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#666', fontSize: '14px' }}>
          {language === "gu" ? "કુલ રેકોર્ડ:" : "Total Records:"} 
          <strong style={{ marginLeft: '4px' }}>{totalItems}</strong>
        </span>
        {isFiltering && (
          <Tag color="processing">
            <FilterOutlined /> {language === "gu" ? "ફિલ્ટર થઈ રહ્યું છે" : "Filtering..."}
          </Tag>
        )}
      </div>
      
      <Pagination
        current={currentPage}
        pageSize={pageSize}
        total={totalItems}
        onChange={handlePageChange}
        showSizeChanger
        showQuickJumper
        showTotal={(total, range) => 
          `${language === "gu" ? "બતાવી રહ્યા છીએ" : "Showing"} ${range[0]}-${range[1]} ${language === "gu" ? "ના" : "of"} ${total} ${language === "gu" ? "રેકોર્ડ" : "items"}`
        }
        pageSizeOptions={['5', '10', '20', '50', '100']}
        disabled={paginationLoading || isLoading}
      />
    </div>
  );

  // Add this function after your existing exportCoverageToExcel function
// Add this function after your existing exportCoverageToExcel function
const exportTableToExcel = async () => {
  if (!filteredData || filteredData.length === 0) {
    message.warning(language === "gu" ? "કોઈ ડેટા નિકાસ કરવા માટે ઉપલબ્ધ નથી" : "No data available to export");
    return;
  }

  const [XLSX, { saveAs }] = await Promise.all([
    import("xlsx"),
    import("file-saver"),
  ]);

  const formatDateForExport = (datetime) => {
    if (!datetime) return "N/A";
    return getPatrolDateTimeParts(datetime)?.date || "N/A";
  };

  const formatTimeForExport = (datetime) => {
    if (!datetime) return "N/A";
    return getPatrolDateTimeParts(datetime)?.time || "N/A";
  };

  // Sheet 1: Patrol Logs Data (with separate date and time columns)
  const patrolLogsData = filteredData.map((item, index) => ({
    [language === "gu" ? "ક્રમાંક" : "Sr. No."]: index + 1,
    [language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type"]: getTypeDisplayName(item.type_name),
    [language === "gu" ? "અધિકારીનું નામ" : "Officer Name"]: item.patrol_officer_name || "N/A",
    [language === "gu" ? "વિભાગ" : "Division"]: item.division || "N/A",
    [language === "gu" ? "રેન્જ" : "Range"]: item.range || "N/A",
    [language === "gu" ? "બીટ" : "Beat"]: item.beat || "N/A",
    [language === "gu" ? "પેટ્રોલિંગ સ્થાન" : "Patrol Location"]: item.patrolling_location || "N/A",
    [language === "gu" ? "જિલ્લો" : "District"]: item.current_location_distict || "N/A",
    [language === "gu" ? "ગામ" : "Village"]: item.current_location_village || "N/A",
    [language === "gu" ? "શરૂઆતની તારીખ" : "Start Date"]: formatDateForExport(item.start_time),
    [language === "gu" ? "શરૂઆતનો સમય" : "Start Time"]: formatTimeForExport(item.start_time),
    [language === "gu" ? "સમાપ્તિ તારીખ" : "End Date"]: formatDateForExport(item.end_time),
    [language === "gu" ? "સમાપ્તિ સમય" : "End Time"]: formatTimeForExport(item.end_time),
    [language === "gu" ? "શરૂઆતનું સ્થાન" : "Start Location"]: item.start_location || "N/A",
    [language === "gu" ? "અંતિમ સ્થાન" : "End Location"]: item.end_location || "N/A",
    [language === "gu" ? "અંતર (કિ.મી.)" : "Distance (km)"]: item.distance_kms || "0",
  }));

  // Sheet 2: Patrol Analysis Dashboard Summary
  const calculateTypeStatsForExport = (type) => {
    const filtered = dashboardData.filter(item => item.type_name === type);
    if (filtered.length === 0) return null;
    
    const totalPatrols = filtered.length;
    const totalDistance = filtered.reduce((sum, item) => sum + parseFloat(item.distance_kms || 0), 0);
    const totalStaff = filtered.reduce((sum, item) => sum + (item.number_of_staff || 1), 0);
    const avgDistance = totalDistance / totalPatrols;
    
    const totalHours = filtered.reduce((sum, item) => sum + getPatrolHours(item.start_time, item.end_time), 0);
    const avgHours = totalHours / totalPatrols;
    
    return {
      type: getTypeDisplayName(type),
      totalPatrols,
      totalDistance: totalDistance.toFixed(1),
      avgDistance: avgDistance.toFixed(1),
      avgHours: avgHours.toFixed(1),
      avgStaff: (totalStaff / totalPatrols).toFixed(1),
    };
  };

  const dayStatsExport = calculateTypeStatsForExport("Day patrolling");
  const nightStatsExport = calculateTypeStatsForExport("Night patrolling");
  const beatStatsExport = calculateTypeStatsForExport("Beat checking");

  const analysisSummary = [
    {
      [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols",
      [language === "gu" ? "મૂલ્ય" : "Value"]: dashboardData.length,
    },
    {
      [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "કુલ અધિકારીઓ" : "Total Officers",
      [language === "gu" ? "મૂલ્ય" : "Value"]: [...new Set(dashboardData.map(item => item.patrol_officer_name))].length,
    },
    {
      [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "કુલ અંતર (કિ.મી.)" : "Total Distance (km)",
      [language === "gu" ? "મૂલ્ય" : "Value"]: dashboardData.reduce((sum, item) => sum + parseFloat(item.distance_kms || 0), 0).toFixed(1),
    },
    {
      [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "સરેરાશ અંતર (કિ.મી.)" : "Average Distance (km)",
      [language === "gu" ? "મૂલ્ય" : "Value"]: (dashboardData.reduce((sum, item) => sum + parseFloat(item.distance_kms || 0), 0) / (dashboardData.length || 1)).toFixed(1),
    },
  ];

  // Sheet 3: Patrol Type-wise Breakdown
  const typeBreakdownData = [
    dayStatsExport && {
      [language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type"]: language === "gu" ? "દિવસ પેટ્રોલિંગ" : "Day Patrolling",
      [language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols"]: dayStatsExport.totalPatrols,
      [language === "gu" ? "કુલ અંતર (કિ.મી.)" : "Total Distance (km)"]: dayStatsExport.totalDistance,
      [language === "gu" ? "સરેરાશ અંતર (કિ.મી.)" : "Avg Distance (km)"]: dayStatsExport.avgDistance,
      [language === "gu" ? "સરેરાશ સમય (કલાક)" : "Avg Time (hours)"]: dayStatsExport.avgHours,
      [language === "gu" ? "સરેરાશ સ્ટાફ" : "Avg Staff"]: dayStatsExport.avgStaff,
    },
    nightStatsExport && {
      [language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type"]: language === "gu" ? "રાત પેટ્રોલિંગ" : "Night Patrolling",
      [language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols"]: nightStatsExport.totalPatrols,
      [language === "gu" ? "કુલ અંતર (કિ.મી.)" : "Total Distance (km)"]: nightStatsExport.totalDistance,
      [language === "gu" ? "સરેરાશ અંતર (કિ.મી.)" : "Avg Distance (km)"]: nightStatsExport.avgDistance,
      [language === "gu" ? "સરેરાશ સમય (કલાક)" : "Avg Time (hours)"]: nightStatsExport.avgHours,
      [language === "gu" ? "સરેરાશ સ્ટાફ" : "Avg Staff"]: nightStatsExport.avgStaff,
    },
    beatStatsExport && {
      [language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type"]: language === "gu" ? "બીટ ચેકિંગ" : "Beat Checking",
      [language === "gu" ? "કુલ પેટ્રોલિંગ" : "Total Patrols"]: beatStatsExport.totalPatrols,
      [language === "gu" ? "કુલ અંતર (કિ.મી.)" : "Total Distance (km)"]: beatStatsExport.totalDistance,
      [language === "gu" ? "સરેરાશ અંતર (કિ.મી.)" : "Avg Distance (km)"]: beatStatsExport.avgDistance,
      [language === "gu" ? "સરેરાશ સમય (કલાક)" : "Avg Time (hours)"]: beatStatsExport.avgHours,
      [language === "gu" ? "સરેરાશ સ્ટાફ" : "Avg Staff"]: beatStatsExport.avgStaff,
    },
  ].filter(Boolean);

  // Officer Patrol Summary Report sheet (multi-level grouped headers)
  const computeTypeStats = (records, type) => {
    const matched = records.filter((r) => r.type_name === type);
    const total = matched.length;
    if (total === 0) {
      return { total: 0, avgStaff: "0.0", avgHours: "0.0", avgDist: "0.0" };
    }

    const totalStaff = matched.reduce((sum, r) => sum + (parseInt(r.number_of_staff) || 0), 0);
    const totalHours = matched.reduce((sum, r) => sum + getPatrolHours(r.start_time, r.end_time), 0);
    const totalDist = matched.reduce((sum, r) => sum + parseFloat(r.distance_kms || 0), 0);

    return {
      total,
      avgStaff: (totalStaff / total).toFixed(1),
      avgHours: (totalHours / total).toFixed(1),
      avgDist: (totalDist / total).toFixed(1),
    };
  };

  const officerMap = {};
  filteredData.forEach((item) => {
    const name = item.patrol_officer_name || "Unknown";
    if (!officerMap[name]) officerMap[name] = [];
    officerMap[name].push(item);
  });

  const officerNames = Object.keys(officerMap).sort();
  const dayLabel = language === "gu" ? "દિવસ પેટ્રોલિંગ" : "Day Patrolling";
  const nightLabel = language === "gu" ? "રાત પેટ્રોલિંગ" : "Night Patrolling";
  const beatLabel = language === "gu" ? "બીટ ચેકિંગ" : "Beat Checking";
  const totalPatrolsLabel = language === "gu" ? "કુલ પેટ્રોલ" : "Total Patrols";
  const totalChecksLabel = language === "gu" ? "કુલ ચેક્સ" : "Total Checks";
  const avgStaffLabel = language === "gu" ? "સરેરાસ સ્ટાફ" : "Avg Staff";
  const avgHoursLabel = language === "gu" ? "સરેરાસ કલાક" : "Avg Hours";
  const avgDistLabel = language === "gu" ? "સરેરાસ અંતર" : "Avg Dist";

  const summaryData = [];
  summaryData.push([
    language === "gu" ? "અધિકારી પેટ્રોલ સારાંશ રિપોર્ટ" : "Officer Patrol Summary Report",
    "", "", "", "", "", "", "", "", "", "", "", "",
  ]);
  summaryData.push([
    language === "gu" ? "અધિકારીનું નામ" : "Officer Name",
    dayLabel, "", "", "",
    nightLabel, "", "", "",
    beatLabel, "", "", "",
  ]);
  summaryData.push([
    "",
    totalPatrolsLabel, avgStaffLabel, avgHoursLabel, avgDistLabel,
    totalPatrolsLabel, avgStaffLabel, avgHoursLabel, avgDistLabel,
    totalChecksLabel, avgStaffLabel, avgHoursLabel, avgDistLabel,
  ]);

  officerNames.forEach((name) => {
    const records = officerMap[name];
    const day = computeTypeStats(records, "Day patrolling");
    const night = computeTypeStats(records, "Night patrolling");
    const beat = computeTypeStats(records, "Beat checking");
    summaryData.push([
      name,
      day.total, day.avgStaff, day.avgHours, day.avgDist,
      night.total, night.avgStaff, night.avgHours, night.avgDist,
      beat.total, beat.avgStaff, beat.avgHours, beat.avgDist,
    ]);
  });

  const dayTotal = computeTypeStats(filteredData, "Day patrolling");
  const nightTotal = computeTypeStats(filteredData, "Night patrolling");
  const beatTotal = computeTypeStats(filteredData, "Beat checking");

  summaryData.push([
    language === "gu" ? "કુલ" : "TOTAL",
    dayTotal.total, dayTotal.avgStaff, dayTotal.avgHours, dayTotal.avgDist,
    nightTotal.total, nightTotal.avgStaff, nightTotal.avgHours, nightTotal.avgDist,
    beatTotal.total, beatTotal.avgStaff, beatTotal.avgHours, beatTotal.avgDist,
  ]);

  summaryData.push(["", "", "", "", "", "", "", "", "", "", "", "", ""]);
  summaryData.push([
    language === "gu" ? "રિપોર્ટ જનરેટ:" : "Report Generated:",
    new Date().toLocaleString(),
    "", "", "", "", "", "", "", "", "", "", "",
  ]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } },
    { s: { r: 1, c: 5 }, e: { r: 1, c: 8 } },
    { s: { r: 1, c: 9 }, e: { r: 1, c: 12 } },
    { s: { r: summaryData.length - 1, c: 1 }, e: { r: summaryData.length - 1, c: 12 } },
  ];
  summarySheet["!cols"] = [
    { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  // Sheet 4: Filter Criteria Applied
  const filterCriteria = [
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "અધિકારીનું નામ" : "Officer Name", [language === "gu" ? "મૂલ્ય" : "Value"]: searchText || "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "વિભાગ" : "Division", [language === "gu" ? "મૂલ્ય" : "Value"]: divisionFilter || "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "રેન્જ" : "Range", [language === "gu" ? "મૂલ્ય" : "Value"]: rangeFilter || "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "બીટ" : "Beat", [language === "gu" ? "મૂલ્ય" : "Value"]: beatFilter || "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "પેટ્રોલિંગ સ્થાન" : "Patrol Location", [language === "gu" ? "મૂલ્ય" : "Value"]: patrolLocationFilter || "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrol Type", [language === "gu" ? "મૂલ્ય" : "Value"]: typeFilter ? getTypeDisplayName(typeFilter) : "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "શરૂઆતની તારીખ" : "Start Date", [language === "gu" ? "મૂલ્ય" : "Value"]: startFilter ? startFilter.format('YYYY-MM-DD') : "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "સમાપ્તિ તારીખ" : "End Date", [language === "gu" ? "મૂલ્ય" : "Value"]: endFilter ? endFilter.format('YYYY-MM-DD') : "N/A" },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "કુલ રેકોર્ડ" : "Total Records", [language === "gu" ? "મૂલ્ય" : "Value"]: filteredData.length },
    { [language === "gu" ? "ફિલ્ટર" : "Filter"]: language === "gu" ? "નિકાસ તારીખ" : "Export Date", [language === "gu" ? "મૂલ્ય" : "Value"]: new Date().toLocaleString() },
  ];

  // Sheet 5: Coverage Analysis Data (if available)
  let coverageDataSheet = [];
  if (coverageData && showBeatCoverage) {
    coverageDataSheet = [
      {
        [language === "gu" ? "મેટ્રિક" : "Metric"]: beatFilter ? (language === "gu" ? "બીટ" : "Beat") : (rangeFilter ? (language === "gu" ? "રેન્જ" : "Range") : (language === "gu" ? "વિભાગ" : "Division")),
        [language === "gu" ? "મૂલ્ય" : "Value"]: beatFilter || rangeFilter || divisionFilter || "N/A",
      },
      {
        [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "વિસ્તાર (ચો.મી.)" : "Area (sq m)",
        [language === "gu" ? "મૂલ્ય" : "Value"]: coverageData.coupe_area_sq_m ? Number(coverageData.coupe_area_sq_m).toLocaleString() : "N/A",
      },
      {
        [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "કવરેજ વિસ્તાર (ચો.મી.)" : "Covered Area (sq m)",
        [language === "gu" ? "મૂલ્ય" : "Value"]: coverageData.patrol_area_sq_m ? Number(coverageData.patrol_area_sq_m).toLocaleString() : "N/A",
      },
      {
        [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "કવરેજ ટકાવારી" : "Coverage Percentage",
        [language === "gu" ? "મૂલ્ય" : "Value"]: coverageData.coverage_percentage ? `${Number(coverageData.coverage_percentage).toFixed(2)}%` : "N/A",
      },
      {
        [language === "gu" ? "મેટ્રિક" : "Metric"]: language === "gu" ? "તારીખ શ્રેણી" : "Date Range",
        [language === "gu" ? "મૂલ્ય" : "Value"]: `${startFilter ? startFilter.format('YYYY-MM-DD') : 'N/A'} to ${endFilter ? endFilter.format('YYYY-MM-DD') : 'N/A'}`,
      },
    ];
  }

  // Create workbook with multiple sheets
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Officer Patrol Summary Report (multi-level grouped headers)
  workbook.SheetNames.unshift("Officer Patrol Summary Report");
  workbook.Sheets["Officer Patrol Summary Report"] = summarySheet;
  
  // Sheet 2: Patrol Logs (with separate date and time columns)
  const patrolSheet = XLSX.utils.json_to_sheet(patrolLogsData);
  XLSX.utils.book_append_sheet(workbook, patrolSheet, "Patrol Logs");
  
  // Sheet 2: Analysis Summary
  const analysisSheet = XLSX.utils.json_to_sheet(analysisSummary);
  XLSX.utils.book_append_sheet(workbook, analysisSheet, "Analysis Summary");
  
  // Sheet 3: Type Breakdown
  if (typeBreakdownData.length > 0) {
    const typeSheet = XLSX.utils.json_to_sheet(typeBreakdownData);
    XLSX.utils.book_append_sheet(workbook, typeSheet, "Patrol Type Breakdown");
  }
  
  // Sheet 4: Filter Criteria
  const filterSheet = XLSX.utils.json_to_sheet(filterCriteria);
  XLSX.utils.book_append_sheet(workbook, filterSheet, "Filter Criteria");
  
  // Sheet 5: Coverage Analysis (if available)
  if (coverageDataSheet.length > 0) {
    const coverageSheet = XLSX.utils.json_to_sheet(coverageDataSheet);
    XLSX.utils.book_append_sheet(workbook, coverageSheet, "Coverage Analysis");
    
    // Sheet 6: Covering Patrols (if available)
    if (coveragePatrols && coveragePatrols.length > 0) {
      const formatDateForExportCoverage = (datetime) => {
        if (!datetime) return "N/A";
        return getPatrolDateTimeParts(datetime)?.date || "N/A";
      };

      const formatTimeForExportCoverage = (datetime) => {
        if (!datetime) return "N/A";
        return getPatrolDateTimeParts(datetime)?.time || "N/A";
      };

      const coveringPatrolsData = coveragePatrols.map((patrol, idx) => ({
        [language === "gu" ? "ક્રમાંક" : "Sr. No."]: idx + 1,
        [language === "gu" ? "પેટ્રોલ ID" : "Patrol ID"]: patrol.patrol_id || "N/A",
        [language === "gu" ? "અધિકારીનું નામ" : "Officer Name"]: patrol.patrol_officer_name || "N/A",
        [language === "gu" ? "શરૂઆતની તારીખ" : "Start Date"]: formatDateForExportCoverage(patrol.start_time),
        [language === "gu" ? "શરૂઆતનો સમય" : "Start Time"]: formatTimeForExportCoverage(patrol.start_time),
        [language === "gu" ? "સમાપ્તિ તારીખ" : "End Date"]: formatDateForExportCoverage(patrol.end_time),
        [language === "gu" ? "સમાપ્તિ સમય" : "End Time"]: formatTimeForExportCoverage(patrol.end_time),
        [language === "gu" ? "અંતર (કિ.મી.)" : "Distance (km)"]: patrol.distance_kms || "0",
      }));
      const coveringSheet = XLSX.utils.json_to_sheet(coveringPatrolsData);
      XLSX.utils.book_append_sheet(workbook, coveringSheet, "Covering Patrols");
    }
  }
  
  // Auto-size columns for all sheets
  const sheets = ['Officer Patrol Summary Report', 'Patrol Logs', 'Analysis Summary', 'Patrol Type Breakdown', 'Filter Criteria', 'Coverage Analysis', 'Covering Patrols'];
  sheets.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) {
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
      const colWidths = {};
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = sheet[cellAddress];
          if (cell && cell.v) {
            const value = cell.v.toString();
            const width = Math.min(value.length, 50);
            if (!colWidths[C] || width > colWidths[C]) {
              colWidths[C] = width;
            }
          }
        }
      }
      sheet['!cols'] = Object.keys(colWidths).map(c => ({ wch: Math.max(colWidths[c] + 2, 12) }));
    }
  });

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const fileName = `patrol_complete_report_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), fileName);
  
  message.success(language === "gu" ? "સંપૂર્ણ રિપોર્ટ સફળતાપૂર્વક નિકાસ થયો" : "Complete report exported successfully");
};


  return (
    <div className="container patrol-logs-page">
      {isLoading && <Loader />}
      <div className="section patrol-logs-section">
        <h3 className="main-heading" style={{textShadow: "rgba(0, 0, 0, 0.3) 0px 2px 4px", fontSize: '25px',marginLeft: "20px", marginBottom: "10px"}}>
          {language === "gu" ? "પેટ્રોલિંગ નોંધણી" : "Detail Level Patrolling Logs"}
        </h3>

        <div style={{ fontSize: '12px', color: 'rgb(17, 95, 34)', marginLeft: "20px" }}>
          {language === "gu" 
    ? "કવરેજ વિશ્લેષણ કરવા માટે વિભાગ માટે શરૂઆત અને સમાપ્તિ તારીખો પસંદ કરો" 
    : "Select the start and end dates for the division to perform coverage analysis"}
        </div>

        <div className="heading-container patrol-filter-card">
          <Input
            placeholder={language === "gu" ? "અધિકારીના નામ પ્રમાણે શોધો" : "Search by Officer Name"}
            style={{ width: "180px", background: "#fff", border: "1px solid #d9d9d9", borderRadius: "4px" }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            suffix={<SearchOutlined style={{ color: "rgba(0, 0, 0, 0.45)", fontSize: "16px", cursor: "pointer" }} />}
          />

          <Select
            placeholder={language === "gu" ? "વિભાગ પસંદ કરો" : "Select Division"}
            style={{ width: "180px", borderRadius: "4px", background: "#fff" }}
            value={divisionFilter}
            onChange={handleDivisionFilterChange}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            <Option value="">{language === "gu" ? "બધા વિભાગો" : "All Divisions"}</Option>
            {Array.isArray(divisions1) && divisions1.length > 0 ? (
              divisions1.map((division, index) => {
                let divisionValue = '';
                let divisionLabel = '';
                if (typeof division === 'string') {
                  divisionValue = division;
                  divisionLabel = division;
                } else if (typeof division === 'object' && division !== null) {
                  divisionValue = division.division || division.name || division.value || '';
                  divisionLabel = division.division || division.name || division.value || division.label || divisionValue;
                }
                return divisionValue ? (
                  <Option key={`div-${index}`} value={divisionValue}>
                    {divisionLabel}
                  </Option>
                ) : null;
              })
            ) : (
              <Option disabled value="no-data">
                {language === "gu" ? "કોઈ ડેટા નથી" : "No data available"}
              </Option>
            )}
          </Select>

          <Select
            placeholder={language === "gu" ? "રેંજ પસંદ કરો" : "Select Range"}
            style={{ width: "180px", borderRadius: "4px", background: "#fff" }}
            value={rangeFilter}
            onChange={handleRangeFilterChange}
            allowClear
            showSearch
            optionFilterProp="children"
            disabled={!divisionFilter}
          >
            <Option value="">{language === "gu" ? "બધી રેંજ" : "All Ranges"}</Option>
            {(filteredRanges.length > 0 ? filteredRanges : ranges1).map((range, index) => {
              let rangeValue = '';
              let rangeLabel = '';
              if (typeof range === 'string') {
                rangeValue = range;
                rangeLabel = range;
              } else if (typeof range === 'object' && range !== null) {
                rangeValue = range.range || range.name || range.value || '';
                rangeLabel = range.range || range.name || range.value || range.label || rangeValue;
              }
              return rangeValue ? (
                <Option key={`range-${index}`} value={rangeValue}>
                  {rangeLabel}
                </Option>
              ) : null;
            })}
          </Select>

          <Select
            placeholder={language === "gu" ? "બીટ પસંદ કરો" : "Select Beat"}
            style={{ width: "180px", borderRadius: "4px", background: "#fff" }}
            value={beatFilter}
            onChange={handleBeatFilterChange}
            allowClear
            showSearch
            optionFilterProp="children"
            disabled={!rangeFilter}
          >
            <Option value="">{language === "gu" ? "બધી બીટ" : "All Beats"}</Option>
            {(filteredBeats.length > 0 ? filteredBeats : beats1).map((beat, index) => {
              let beatValue = '';
              let beatLabel = '';
              if (typeof beat === 'string') {
                beatValue = beat;
                beatLabel = beat;
              } else if (typeof beat === 'object' && beat !== null) {
                beatValue = beat.beat || beat.name || beat.value || '';
                beatLabel = beat.beat || beat.name || beat.value || beat.label || beatValue;
              }
              return beatValue ? (
                <Option key={`beat-${index}`} value={beatValue}>
                  {beatLabel}
                </Option>
              ) : null;
            })}
          </Select>

          <Select
            placeholder={language === "gu" ? "પેટ્રોલિંગ સ્થાન" : "Patrol Location"}
            style={{ width: "180px", borderRadius: "4px", background: "#fff" }}
            value={patrolLocationFilter}
            onChange={(value) => setPatrolLocationFilter(value || "")}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            <Option value="">{language === "gu" ? "બધા સ્થાનો" : "All Locations"}</Option>
            {patrolLocations.map((loc) => (
              <Option key={loc} value={loc}>{loc}</Option>
            ))}
          </Select>

          <DatePicker
            placeholder={language === "gu" ? "શરૂઆતની તારીખ" : "Search By Start Date"}
            style={{ width: "180px", border: "1px solid #d9d9d9", borderRadius: "4px", background: "#fff" }}
            value={startFilter}
            onChange={(date) => setStartFilter(date)}
            allowClear
          />

          <DatePicker
            placeholder={language === "gu" ? "સમાપ્તિ તારીખ" : "Search By End Date"}
            style={{ width: "180px", border: "1px solid #d9d9d9", borderRadius: "4px", background: "#fff" }}
            value={endFilter}
            onChange={(date) => setEndFilter(date)}
            allowClear
          />
          
          <Select
            placeholder={language === "gu" ? "પેટ્રોલિંગ પ્રકાર" : "Patrolling Type"}
            style={{ width: "180px", borderRadius: "4px", background: "#fff" }}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value)}
            allowClear
          >
            <Option value="">{language === "gu" ? "પ્રકારથી શોધો" : "Patrolling Type"}</Option>
            <Option value="Day patrolling">{language === "gu" ? "દિવસ પેટ્રોલિંગ" : "Day Patrolling"}</Option>
            <Option value="Night patrolling">{language === "gu" ? "રાત પેટ્રોલિંગ" : "Night Patrolling"}</Option>
            <Option value="Beat checking">{language === "gu" ? "બીટ ચેકિંગ" : "Beat Checking"}</Option>
          </Select>
          
          <Button 
            onClick={clearAllFilters}
            icon={<ReloadOutlined />}
            style={{ marginRight: "10px", background: "#f5f5f5", borderColor: "#d9d9d9", color: "#000" }}
          >
            {language === "gu" ? "ફિલ્ટર દૂર કરો" : "Clear Filters"}
          </Button>

          <Button 
    onClick={confirmExportTableToExcel}
    style={{ 
      background: "linear-gradient(135deg, #28a745 0%, #218838 100%)", 
      borderColor: "#28a745", 
      color: "#fff",
      fontWeight: 500
    }}
  >
    <img src={vector} alt="Export" style={{ width: '16px', height: '16px' }} />
    {language === "gu" ? "નિકાસ" : "Export"}
  </Button>
          
        </div>

        <div className="patrol-table-card">
        <div className="patrol-table-title">{language === "gu" ? "પેટ્રોલ લોગ્સ" : "Patrol Logs"}</div>
        <Table
          className="transparent-table patrol-modern-table"
          columns={columns}
          dataSource={filteredData}
          rowKey={(record) => record.key || record.patrol_id}
          pagination={false}
          bordered
          scroll={{ x: 'max-content' }}
          loading={isLoading || paginationLoading}
          locale={{
            emptyText: isLoading || paginationLoading ? (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <Spin />
                <div style={{ fontSize: 16, color: "#000", fontWeight: 500, marginTop: 12 }}>
                  {language === "gu" ? "લોડ થઈ રહ્યું છે..." : "Loading data..."}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <img src={noDataImage} alt="No Data" style={{ width: 60, marginBottom: 16 }} />
                <div style={{ fontSize: 16, color: "#000", fontWeight: 500 }}>
                  {language === "gu" ? "કોઈ ડેટા ઉપલબ્ધ નથી" : "No data available"}
                </div>
              </div>
            ),
          }}
          
        />
        
        {totalItems > 0 && <CustomPagination />}

      </div>
      
      {/* Patrol Analysis Dashboard - Now includes coverage section */}
      <PatrolAnalysisDashboard 
        patrolData={dashboardData} 
        language={language} 
        isLoading={isDashboardLoading}
        showBeatCoverage={showBeatCoverage}
        coverageData={coverageData}
        coveragePatrols={coveragePatrols}
        beatFilter={beatFilter}
        rangeFilter={rangeFilter}
        divisionFilter={divisionFilter}
        startFilter={startFilter}
        endFilter={endFilter}
        exportCoverageToExcel={exportCoverageToExcel}
      />
      
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
            <div style={{ marginBottom: 16 }}>
              {selectedPatrol.images && selectedPatrol.images.length > 0 ? (
                <>
                  <h4 style={{ marginBottom: 12 }}>
                    {language === "gu" ? "પેટ્રોલ છબીઓ" : "Patrol Images"} ({selectedPatrol.images.length})
                  </h4>
                  <Row gutter={[8, 8]}>
                    {selectedPatrol.images.map((image, index) => {
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
                        <Col xs={12} sm={8} md={6} key={`image_${index}`}>
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
                                width: 170,
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
                              <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                style={{ marginTop: 6, width: '100%' }}
                                onClick={() => downloadBase64Image(image, `patrol_${selectedPatrol.patrol_id || 'image'}_${image.image_category || index + 1}`)}
                              >
                                {language === "gu" ? "ડાઉનલોડ" : "Download"}
                              </Button>
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
            
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 8 }}>
                {language === "gu" ? "પેટ્રોલ માર્ગ" : "Patrol Route"}
              </h4>
              <PatrolMap patrol={selectedPatrol} />
            </div>
          </>
        )}
      </Modal>
      
      {showmaproute && (
        <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "18px", color: "#666" }}>Loading map...</div>}>
          <BeatPatrolCoverage showmaproute={showmaproute} language={language} setShowMapRoute={setShowMapRoute} />
        </Suspense>
      )}

      {/* FOOTER */}
      <footer className="footer" style={{color:'black',
        textAlign:'center',
        padding:'15px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'}}> 
          <div>
        <p style={{display: 'flex',alignItems: 'center',gap: '6px' }}> © 2026 Gujarat Forest Department <img src={gujaratlogo} alt="logo picture" style={{width:'40px'}}></img> </p>

          </div>
        <div style={{display:'flex', alignItems:'center',gap: '6px'}}>
          <p>Powered by  </p>
          <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
            <img 
              src={gisfylogo} 
              alt="logo picture" 
              style={{ width: '100px', height: '40px' }} 
            />
          </a>
        </div>
      </footer>

      {/* Export Confirmation Modal */}
      <Modal
        title={language === "gu" ? "ફિલ્ટર સાથે નિકાસ કરો" : "Export with current filters?"}
        open={isExportConfirmVisible}
        onOk={handleExportConfirm}
        onCancel={() => setIsExportConfirmVisible(false)}
        okText={language === "gu" ? "નિકાસ કરો" : "Export"}
        cancelText={language === "gu" ? "રદ કરો" : "Cancel"}
        okButtonProps={{ loading: isExporting }}
        zIndex={10000}
      >
        <div>
          <p>{language === "gu" ? "નીચેના ફિલ્ટર લાગુ થશે:" : "The following filters will be applied:"}</p>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            {getExportFilterSummary().map((item) => <li key={item}>{item}</li>)}
          </ul>
          {(!filteredData || filteredData.length === 0) && (
            <p style={{ color: "#faad14", marginTop: 8 }}>
              {language === "gu" ? "કોઈ ડેટા ઉપલબ્ધ નથી. નિકાસ ખાલી રહેશે." : "No data available. Export will be empty."}
            </p>
          )}
        </div>
      </Modal>

    </div>
    </div>
  );
};

export default PatrolIncidentLogs;