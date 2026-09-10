import React, { useEffect, useState, useRef } from "react";
import { Button, Card, Col, DatePicker, Descriptions, Input, Modal, Row, Select, Space, Statistic, Table, Tag, message } from "antd";
import { DownloadOutlined, EyeOutlined, EnvironmentOutlined, ReloadOutlined, SearchOutlined, EditOutlined, TableOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE_URL } from "../config";
import { getAuthHeaders, matchesUserHierarchy, matchesUserHierarchyString, getMostSpecificLevel } from "../utils/authUtils";
import { capitalizeFirst } from "../utils/textFormat";
import { useLanguage } from "../context/LanguageContext";
import gujaratlogo from "../assets/FOREST DEPT.jpg";
import gisfylogo from "../assets/Gisfylogo.png";

const { RangePicker } = DatePicker;
const { Option } = Select;

const emptyOptions = { usernames: [], villages: [], coupes: [], divisions: [], months: [] };

// Convert any timestamp to IST (UTC+5:30) and display as DD-MM-YYYY HH:mm:ss
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const toIST = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const istDate = new Date(d.getTime() + IST_OFFSET_MS);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(istDate.getUTCDate())}-${pad(istDate.getUTCMonth() + 1)}-${istDate.getUTCFullYear()} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
  }
  return String(value);
};

const formatSentAt = (value) => {
  const result = toIST(value);
  return result || "-";
};

// Normalize status from NDVI change tables.
// The `status` column in NDVI Change tables is a boolean:
//   true  → "Resolved" (action taken)
//   false → "Pending"
// String values ("Pending", "Resolved", "Under Review", "False Positive") pass through.
const normalizeStatus = (v) => {
  if (v === true) return "Resolved";
  if (v === false) return "Pending";
  if (v == null || v === "") return "Pending";
  return String(v);
};

// ── Language strings ──────────────────────────────────────────────────────────
const TEXTS = {
  en: {
    pageTitle: "NDVI Notifications",
    usersReceived: "Users Received",
    totalNotifications: "Total Notifications",
    totalChanges: "Total Changes",
    // Filter placeholders
    userId: "User ID",
    userName: "User Name",
    division: "Division",
    month: "Month",
    filter: "Filter",
    clear: "Clear",
    // Table columns
    range: "Range",
    round: "Round",
    beat: "Beat",
    village: "Village",
    notificationDate: "Notification Date",
    slot: "Slot",
    changeCount: "Changes Count",
    sentAt: "Sent At (IST)",
    action: "Action",
    viewChanges: "View Changes",
    // Section titles
    monthlySummary: "Monthly Division-wise NDVI Notification Summary",
    notificationData: "Notification Data",
    export: "Export",
    alertsGenerated: "Changes Detected",
    notificationsSent: "Notifications Sent",
    // Modal
    notificationDetails: "Notification Details",
    coupeName: "Coupe Name",
    noData: "No notification data available to export",
    startDate: "Start Date",
    endDate: "End Date",
  },
  gu: {
    pageTitle: "NDVI સૂચનાઓ",
    usersReceived: "વપરાશકર્તાઓ પ્રાપ્ત",
    totalNotifications: "કુલ સૂચનાઓ",
    totalChanges: "કુલ ફેરફાર",
    // Filter placeholders
    userId: "વપરાશકર્તા ID",
    userName: "વપરાશકર્તા નામ",
    division: "વિભાગ",
    month: "મહિનો",
    filter: "ફિલ્ટર",
    clear: "સાફ કરો",
    // Table columns
    range: "રેન્જ",
    round: "રાઉન્ડ",
    beat: "બીટ",
    village: "ગ્રામ",
    notificationDate: "સૂચના તારીખ",
    slot: "સ્લોટ",
    changeCount: "ફેરફાર સંખ્યા",
    sentAt: "મોકલ્યો (IST)",
    action: "ક્રિયા",
    viewChanges: "ફેરફાર જુઓ",
    // Section titles
    monthlySummary: "માસિક વિભાગ-વાર NDVI સૂચના સારાંશ",
    notificationData: "સૂચના ડેટા",
    export: "નિકાસ",
    alertsGenerated: "જોવામાં આવેલ ફેરફાર",
    notificationsSent: "મોકલાયેલ સૂચનાઓ",
    // Modal
    notificationDetails: "સૂચના વિગતો",
    coupeName: "ક્યુપ નામ",
    noData: "નિકાસ માટે કોઈ સૂચના ડેટા ઉપલબ્ધ નથી",
    startDate: "શરૂઆત તારીખ",
    endDate: "સમાપ્તિ તારીખ",
  },
};

const NDVINotifications = () => {
  const { language } = useLanguage();
  const t = TEXTS[language] || TEXTS.en;

  // Check if the logged-in user has a division to lock
  // Use state + useEffect to avoid stale reads when component mounts before
  // userData is set in localStorage (right after login).
  const [lockedDivision, setLockedDivision] = useState(null);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [options, setOptions] = useState(emptyOptions);
  const [summary, setSummary] = useState({ total_notifications: 0, users_received: 0, total_changes: 0 });
  // table_name kept in state for API calls but no longer shown as a UI filter
  const [filters, setFilters] = useState({
    username: null,
    division: null,
    month: null, dates: null
  });
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  // Pagination state — server-driven
  const [pagination, setPagination] = useState({ current: 1, pageSize: 500, total: 0 });

  // ── NDVI Changes modal state ──
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [changesData, setChangesData] = useState([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [changesUser, setChangesUser] = useState(null);
  const [changesUserName, setChangesUserName] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const wmsLayerRef = useRef(null);

  // ── Status update modal state ──
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: "Pending", note: "" });
  const [statusUpdating, setStatusUpdating] = useState(false);

  // ── Point details modal state (note + image for False Positive) ──
  const [pointDetailOpen, setPointDetailOpen] = useState(false);
  const [pointDetailRecord, setPointDetailRecord] = useState(null);
  const [pointDetailLoading, setPointDetailLoading] = useState(false);
  const [pointDetailImage, setPointDetailImage] = useState(null);

  const fetchReport = async (overrideFilters = filters, page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      ["username", "division", "month"].forEach((key) => {
        if (overrideFilters[key]) params.append(key, overrideFilters[key]);
      });
      if (overrideFilters.dates?.[0]) params.append("start_date", overrideFilters.dates[0].format("YYYY-MM-DD"));
      if (overrideFilters.dates?.[1]) params.append("end_date", overrideFilters.dates[1].format("YYYY-MM-DD"));
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));

      const res = await fetch(`${API_BASE_URL}/api/ndvi-notification-report?${params.toString()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch notification report");
      // Apply client-side hierarchy filter (beat → round → range → division → circle)
      // as a backup to the backend ILIKE filter
      let rows = (json.data || []).map((item) => ({ ...item, key: item.id }));
      if (lockedDivision) {
        rows = rows.filter(item =>
          matchesUserHierarchy(item) ||
          matchesUserHierarchyString(item.coupe_name || '')
        );
      }
      setData(rows);
      let monthlyRows = (json.monthlyDivisionSummary || []).map((item, index) => ({ ...item, key: `${item.month}-${item.division}-${index}` }));
      if (lockedDivision) {
        monthlyRows = monthlyRows.filter(item => matchesUserHierarchy(item));
      }
      setMonthlySummary(monthlyRows);
      setSummary(json.summary || { total_notifications: 0, users_received: 0, total_changes: 0 });
      setOptions({ ...emptyOptions, ...(json.options || {}) });
      if (json.pagination) {
        setPagination(prev => ({
          ...prev,
          current: json.pagination.page,
          pageSize: json.pagination.pageSize,
          total: json.pagination.total,
        }));
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || "Failed to fetch NDVI notifications");
      setData([]);
      setMonthlySummary([]);
      setSummary({ total_notifications: 0, users_received: 0, total_changes: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Read the user's division from localStorage once userData is available,
  // then update the filters and fetch the report.
  useEffect(() => {
    // Use the most specific hierarchy level (beat → round → range → division → circle)
    const div = getMostSpecificLevel();
    setLockedDivision(div);
    if (div) {
      setFilters(prev => ({ ...prev, division: div }));
      fetchReport({ ...filters, division: div });
    } else {
      fetchReport();
    }
  }, []);

  // Handle Ant Design Table page change
  const handleTableChange = (pag) => {
    const newPage = pag.current;
    const newPageSize = pag.pageSize;
    setPagination(prev => ({ ...prev, current: newPage, pageSize: newPageSize }));
    fetchReport(filters, newPage, newPageSize);
  };

  const clearFilters = () => {
    // Keep the locked division when clearing filters
    const cleared = { username: null, division: lockedDivision || null, month: null, dates: null };
    setFilters(cleared);
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchReport(cleared, 1, pagination.pageSize);
  };

  const renderSelect = (key, placeholder, values, span = 4, disabled = false) => (
    <Col xs={24} md={8} lg={span}>
      <Select
        allowClear
        showSearch
        placeholder={placeholder}
        value={filters[key]}
        onChange={(value) => setFilters((prev) => ({ ...prev, [key]: value }))}
        style={{ width: "100%" }}
        optionFilterProp="children"
        disabled={disabled}
      >
        {(values || []).map((value) => <Option key={value} value={value}>{capitalizeFirst(value)}</Option>)}
      </Select>
    </Col>
  );

  const exportToExcel = async () => {
    if (!data.length) {
      message.warning(t.noData);
      return;
    }

    window.dispatchEvent(new CustomEvent('global-data-loading-start', { detail: { message: 'Data is exporting...' } }));
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const [XLSX, { saveAs }] = await Promise.all([import("xlsx"), import("file-saver")]);
      const rows = data.map((item, index) => ({
        "Sr. No.": index + 1,
        [t.userId]: item.user_id || "-",
        [t.userName]: item.username || "-",
        [t.division]: item.division || "-",
        [t.range]: item.range || "-",
        [t.round]: item.round || "-",
        [t.beat]: item.beat || "-",
        [t.village]: item.village || item.village_name || "-",
        [t.notificationDate]: item.notification_date || "-",
        [t.slot]: item.slot_label || "-",
        [t.changeCount]: item.change_count || 0,
        [t.sentAt]: formatSentAt(item.sent_at),
      }));
      const summaryRows = monthlySummary.map((item) => ({
        [t.month]: item.month,
        [t.division]: item.division,
        [t.range]: item.range || "-",
        [t.round]: item.round || "-",
        [t.beat]: item.beat || "-",
        [t.village]: item.village || "-",
        [t.alertsGenerated]: item.alerts_generated,
        [t.notificationsSent]: item.notifications_sent,
      }));
      const filterRows = [
        { Filter: t.userName, Value: filters.username || "All" },
        { Filter: t.division,  Value: filters.division  || "All" },
        { Filter: t.month,     Value: filters.month     || "All" },
        { Filter: t.startDate, Value: filters.dates?.[0]?.format("YYYY-MM-DD") || "All" },
        { Filter: t.endDate,   Value: filters.dates?.[1]?.format("YYYY-MM-DD") || "All" },
        { Filter: t.usersReceived,      Value: summary.users_received     || 0 },
        { Filter: t.totalNotifications, Value: summary.total_notifications || 0 },
        { Filter: t.totalChanges,       Value: summary.total_changes       || 0 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Notifications");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Monthly Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filterRows), "Filters");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buffer], { type: "application/octet-stream" }), `ndvi_notifications_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
    } finally {
      window.dispatchEvent(new Event('global-data-loading-end'));
    }
  };

  const showDetails = (record) => {
    setDetailRecord(record);
    setDetailModalOpen(true);
  };

  // ── Fetch NDVI changes for a specific user ──
  const fetchUserChanges = async (user_id, userName = null) => {
    setChangesLoading(true);
    setChangesUser(user_id);
    setChangesUserName(userName);
    setChangesModalOpen(true);
    setSelectedPoint(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ndvi-changes/user/${user_id}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to fetch NDVI changes");
      setChangesData((json.data || []).map((item, i) => ({ ...item, key: `${item.table_name}-${item.pixel_id}-${i}` })));
    } catch (err) {
      console.error(err);
      message.error(err.message || "Failed to fetch NDVI changes");
      setChangesData([]);
    } finally {
      setChangesLoading(false);
    }
  };

  // ── Select a point from the changes table and zoom the map ──
  const handleSelectPoint = (point) => {
    setSelectedPoint(point);
    const lat = parseFloat(point.latitude);
    const lng = parseFloat(point.longitude);

    // Initialize or update the map
    setTimeout(() => {
      if (!mapRef.current) return;
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, { zoomControl: true }).setView(
          Number.isNaN(lat) || Number.isNaN(lng) ? [23.0, 72.0] : [lat, lng],
          13
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      } else if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        mapInstanceRef.current.setView([lat, lng], 15);
      }

      // ── Add GeoServer WMS layer for this NDVI Change table ──
      // Remove any previous WMS layer
      if (wmsLayerRef.current) {
        mapInstanceRef.current.removeLayer(wmsLayerRef.current);
        wmsLayerRef.current = null;
      }
      if (point.table_name) {
        const wmsLayerName = `Recap4NDC:${point.table_name}`;
        wmsLayerRef.current = L.tileLayer.wms("/geoserver/wms", {
          layers: wmsLayerName,
          format: "image/png",
          transparent: true,
          version: "1.1.0",
          tileSize: 512,
          zIndex: 1000,
        }).addTo(mapInstanceRef.current);
      }

      // Add/update marker if coordinates are valid
      if (markerRef.current) markerRef.current.remove();
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current)
          .bindPopup(`<b>Pixel ID:</b> ${point.pixel_id}<br><b>NDVI Change:</b> ${point.NDVI_change || '-'}<br><b>Village:</b> ${point.village || '-'}`)
          .openPopup();
      }
      // Invalidate size in case modal just opened
      mapInstanceRef.current.invalidateSize();
    }, 200);
  };

  // ── Open status update modal ──
  const openStatusModal = (point) => {
    setSelectedPoint(point);
    setStatusForm({ status: normalizeStatus(point.status), note: point.note || "" });
    setStatusModalOpen(true);
  };

  // ── Update point status via API ──
  const updatePointStatus = async () => {
    if (!selectedPoint) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ndvi-changes/status`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          table_name: selectedPoint.table_name,
          pixel_id: selectedPoint.pixel_id,
          status: statusForm.status,
          note: statusForm.note,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || json.error || "Failed to update status");
      message.success("Status updated successfully");
      // Update the changes table locally
      setChangesData(prev => prev.map(item =>
        item.table_name === selectedPoint.table_name && item.pixel_id === selectedPoint.pixel_id
          ? { ...item, status: statusForm.status, note: statusForm.note }
          : item
      ));
      setStatusModalOpen(false);
    } catch (err) {
      console.error(err);
      message.error(err.message || "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  // ── Cleanup map on modal close ──
  const closeChangesModal = () => {
    setChangesModalOpen(false);
    setSelectedPoint(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      wmsLayerRef.current = null;
    }
  };

  // ── View point details (note + image) for False Positive status ──
  const showPointDetails = async (record) => {
    setPointDetailRecord(record);
    setPointDetailImage(null);
    setPointDetailLoading(true);
    setPointDetailOpen(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ndvi-changes/point/${record.table_name}/${record.pixel_id}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const data = json.data;
        setPointDetailRecord((prev) => ({
          ...prev,
          note: data.note || prev.note,
          status: data.status || prev.status,
          latitude: data.latitude || prev.latitude,
          longitude: data.longitude || prev.longitude,
          change_category: data.change_category || prev.change_category,
        }));
        if (data.image_data) {
          setPointDetailImage(`data:image/jpeg;base64,${data.image_data}`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch point details:", err);
    } finally {
      setPointDetailLoading(false);
    }
  };

  // Generic sorter for string/number values
  const genericSorter = (dataIndex) => (a, b) => {
    const av = a[dataIndex];
    const bv = b[dataIndex];
    if (av == null && bv == null) return 0;
    if (av == null) return -1;
    if (bv == null) return 1;
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  };

  const columns = [
    { title: t.userId,            dataIndex: "user_id",      key: "user_id",      sorter: genericSorter("user_id") },
    { title: t.userName,          dataIndex: "username",     key: "username",     sorter: genericSorter("username"),     render: (v) => v || "-" },
    { title: t.division,          dataIndex: "division",     key: "division",     sorter: genericSorter("division"),     render: (v) => v || "-" },
    { title: t.range,             dataIndex: "range",        key: "range",        sorter: genericSorter("range"),        render: (v) => v || "-" },
    { title: t.round,             dataIndex: "round",        key: "round",        sorter: genericSorter("round"),        render: (v) => v || "-" },
    { title: t.beat,              dataIndex: "beat",         key: "beat",         sorter: genericSorter("beat"),         render: (v) => v || "-" },
    { title: t.village,           dataIndex: "village",      key: "village",      sorter: genericSorter("village"),      render: (v) => v || "-" },
    { title: t.notificationDate,  dataIndex: "notification_date", key: "notification_date", sorter: genericSorter("notification_date"), render: (v) => v || "-" },
    { title: t.slot,              dataIndex: "slot_label",   key: "slot_label",   sorter: genericSorter("slot_label"),   render: (v) => v || "-" },
    {
      title: t.changeCount,
      dataIndex: "change_count",
      key: "change_count",
      sorter: genericSorter("change_count"),
      render: (v) => <Tag color="blue">{v || 0}</Tag>,
    },
    {
      title: t.sentAt,
      dataIndex: "sent_at",
      key: "sent_at",
      sorter: genericSorter("sent_at"),
      render: (v) => formatSentAt(v),
    },
    {
      title: t.action,
      key: "action",
      fixed: "right",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => showDetails(record)}>
            {t.viewDetails}
          </Button>
          {record.user_id && (
            <Button type="link" icon={<TableOutlined />} onClick={() => fetchUserChanges(record.user_id, record.username)}>
              {t.viewChanges}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const monthlyColumns = [
    { title: t.month,          dataIndex: "month",            key: "month",            sorter: genericSorter("month") },
    { title: t.division,       dataIndex: "division",         key: "division",         sorter: genericSorter("division") },
    { title: t.range,          dataIndex: "range",            key: "range",            sorter: genericSorter("range"),            render: (v) => v || "-" },
    { title: t.round,          dataIndex: "round",            key: "round",            sorter: genericSorter("round"),            render: (v) => v || "-" },
    { title: t.beat,           dataIndex: "beat",             key: "beat",             sorter: genericSorter("beat"),             render: (v) => v || "-" },
    { title: t.village,        dataIndex: "village",          key: "village",          sorter: genericSorter("village"),          render: (v) => v || "-" },
    { title: t.alertsGenerated, dataIndex: "alerts_generated", key: "alerts_generated", sorter: genericSorter("alerts_generated") },
    { title: t.notificationsSent, dataIndex: "notifications_sent", key: "notifications_sent", sorter: genericSorter("notifications_sent"), render: (v) => <Tag color="blue">{v}</Tag> },
  ];

  return (
    <div className="container ndvi-notifications-page" style={{ padding: 24 }}>
      <h3 className="main-heading">{t.pageTitle}</h3>

      {/* ── Stat cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}><Card><Statistic title={t.usersReceived}      value={summary.users_received     || 0} /></Card></Col>
        <Col xs={24} md={12} lg={8}><Card><Statistic title={t.totalNotifications} value={summary.total_notifications || 0} /></Card></Col>
        <Col xs={24} md={12} lg={8}><Card><Statistic title={t.totalChanges}       value={summary.total_changes       || 0} valueStyle={{ color: "#3f8600" }} /></Card></Col>
      </Row>

      {/* ── Filters (NDVI Table filter removed) ── */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          {renderSelect("username", t.userName, options.usernames, 6)}
          {renderSelect("division", t.division, options.divisions, 6, !!lockedDivision)}
          {renderSelect("month",    t.month,    options.months,    6)}
          <Col xs={24} md={8} lg={6}>
            <RangePicker
              style={{ width: "100%" }}
              value={filters.dates}
              onChange={(dates) => setFilters((p) => ({ ...p, dates }))}
            />
          </Col>
        </Row>
        <Row gutter={[12, 12]} style={{ marginTop: 12 }} justify="end">
          <Col xs={24} md={8} lg={4} style={{ textAlign: "right" }}>
            <Space>
              <Button icon={<SearchOutlined />} type="primary" onClick={() => fetchReport()}>{t.filter}</Button>
              <Button icon={<ReloadOutlined />} onClick={clearFilters}>{t.clear}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Monthly summary table ── */}
      <Card title={t.monthlySummary} style={{ marginBottom: 16 }}>
        <Table
          columns={monthlyColumns}
          dataSource={monthlySummary}
          loading={loading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: "max-content" }}
        />
      </Card>

      {/* ── Notification data table (server-side pagination) ── */}
      <Card
        title={t.notificationData}
        extra={<Button icon={<DownloadOutlined />} onClick={exportToExcel}>{t.export}</Button>}
      >
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total || summary.total_notifications,
            showSizeChanger: true,
            pageSizeOptions: [100, 250, 500, 1000],
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* ── Detail modal ── */}
      <Modal
        title={t.notificationDetails}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {detailRecord && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label={t.userId}>{detailRecord.user_id || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.userName}>{detailRecord.username || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.division}>{detailRecord.division || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.range}>{detailRecord.range || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.round}>{detailRecord.round || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.beat}>{detailRecord.beat || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.village}>{detailRecord.village || detailRecord.village_name || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.coupeName}>{detailRecord.coupe_name || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.notificationDate}>{detailRecord.notification_date || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.slot}>{detailRecord.slot_label || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.changeCount}>
                <Tag color="blue">{detailRecord.change_count || 0}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t.month}>{detailRecord.month || "-"}</Descriptions.Item>
              <Descriptions.Item label={t.sentAt} span={2}>
                {formatSentAt(detailRecord.sent_at)}
              </Descriptions.Item>
            </Descriptions>

            {detailRecord.user_id && (
              <div style={{ marginTop: 16, textAlign: "center" }}>
                <Button
                  type="primary"
                  icon={<TableOutlined />}
                  onClick={() => {
                    setDetailModalOpen(false);
                    fetchUserChanges(detailRecord.user_id, detailRecord.username);
                  }}
                >
                  {t.viewChanges}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── NDVI Changes modal (table + map + status update) ── */}
      <Modal
        title={`NDVI Changes — ${changesUserName || changesUser || '-'}`}
        open={changesModalOpen}
        onCancel={closeChangesModal}
        footer={null}
        width={1100}
      >
        <Row gutter={[16, 16]}>
          {/* Changes table */}
          <Col span={14}>
            <Table
              size="small"
              columns={[
                { title: "Pixel ID", dataIndex: "pixel_id", key: "pixel_id", width: 80 },
                { title: "Village", dataIndex: "village", key: "village", width: 100, render: v => v || "-" },
                { title: "NDVI Change", dataIndex: "NDVI_change", key: "NDVI_change", width: 90, render: v => v != null ? Number(v).toFixed(4) : "-" },
                { title: "Category", dataIndex: "change_category", key: "change_category", width: 90, render: v => v || "-" },
                { title: "Status", dataIndex: "status", key: "status", width: 90, render: (v) => { const s = normalizeStatus(v); return <Tag color={s === "Resolved" ? "success" : s === "Under Review" ? "processing" : s === "False Positive" ? "error" : "warning"}>{s}</Tag>; } },
                {
                  title: "Action",
                  key: "action",
                  width: 160,
                  render: (_, record) => (
                    <Space size="small">
                      <Button size="small" type="link" icon={<EnvironmentOutlined />} onClick={() => handleSelectPoint(record)}>Zoom</Button>
                      <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openStatusModal(record)}>Update</Button>
                      {normalizeStatus(record.status) === "False Positive" && (
                        <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => showPointDetails(record)}>Details</Button>
                      )}
                    </Space>
                  ),
                },
              ]}
              dataSource={changesData}
              loading={changesLoading}
              pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50] }}
              scroll={{ x: "max-content" }}
              rowSelection={{
                type: "radio",
                selectedRowKeys: selectedPoint ? [selectedPoint.key] : [],
                onChange: (_, rows) => rows[0] && handleSelectPoint(rows[0]),
              }}
              onRow={(record) => ({
                onClick: () => handleSelectPoint(record),
              })}
            />
          </Col>

          {/* Mini map */}
          <Col span={10}>
            {selectedPoint && (
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              {`Selected: Pixel ${selectedPoint.pixel_id}`}
            </div>
            )}
            <div ref={mapRef} style={{ width: "100%", height: 350, borderRadius: 8, border: "1px solid #d9d9d9" }} />
            {selectedPoint && (
              <Descriptions bordered size="small" column={1} style={{ marginTop: 12 }}>
                <Descriptions.Item label="Pixel ID">{selectedPoint.pixel_id}</Descriptions.Item>
                <Descriptions.Item label="Latitude">{selectedPoint.latitude || "-"}</Descriptions.Item>
                <Descriptions.Item label="Longitude">{selectedPoint.longitude || "-"}</Descriptions.Item>
                <Descriptions.Item label="NDVI Change">{selectedPoint.NDVI_change != null ? Number(selectedPoint.NDVI_change).toFixed(4) : "-"}</Descriptions.Item>
                <Descriptions.Item label="Status"><Tag color={normalizeStatus(selectedPoint.status) === "Resolved" ? "success" : "warning"}>{normalizeStatus(selectedPoint.status)}</Tag></Descriptions.Item>
              </Descriptions>
            )}
          </Col>
        </Row>
      </Modal>

      {/* ── Status update modal ── */}
      <Modal
        title="Update NDVI Point Status"
        open={statusModalOpen}
        onCancel={() => setStatusModalOpen(false)}
        onOk={updatePointStatus}
        confirmLoading={statusUpdating}
        okText="Update"
      >
        {selectedPoint && (
          <div>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Table">{selectedPoint.table_name}</Descriptions.Item>
              <Descriptions.Item label="Pixel ID">{selectedPoint.pixel_id}</Descriptions.Item>
              <Descriptions.Item label="Village">{selectedPoint.village || "-"}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Status</label>
              <Select
                style={{ width: "100%" }}
                value={statusForm.status}
                onChange={(v) => setStatusForm(prev => ({ ...prev, status: v }))}
                options={[
                  { value: "Pending", label: "Pending" },
                  { value: "Under Review", label: "Under Review" },
                  { value: "Resolved", label: "Resolved" },
                  { value: "False Positive", label: "False Positive" },
                ]}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Note / Action Taken</label>
              <Input.TextArea
                rows={4}
                value={statusForm.note}
                onChange={(e) => setStatusForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Enter action taken or notes..."
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Point details modal (note + image for False Positive) ── */}
      <Modal
        title="Point Details — False Positive"
        open={pointDetailOpen}
        onCancel={() => setPointDetailOpen(false)}
        footer={null}
        width={700}
      >
        {pointDetailRecord && (
          <div>
            {pointDetailLoading ? (
              <p style={{ textAlign: "center" }}>Loading...</p>
            ) : (
              <>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="Pixel ID">{pointDetailRecord.pixel_id || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Village">{pointDetailRecord.village || "-"}</Descriptions.Item>
                  <Descriptions.Item label="NDVI Change">{pointDetailRecord.NDVI_change != null ? Number(pointDetailRecord.NDVI_change).toFixed(4) : "-"}</Descriptions.Item>
                  <Descriptions.Item label="Category">{pointDetailRecord.change_category || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color="error">{normalizeStatus(pointDetailRecord.status)}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Latitude">{pointDetailRecord.latitude || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Longitude" span={2}>{pointDetailRecord.longitude || "-"}</Descriptions.Item>
                  <Descriptions.Item label="Note" span={2}>
                    {pointDetailRecord.note || "No note available"}
                  </Descriptions.Item>
                </Descriptions>

                <div style={{ marginTop: 16, textAlign: "center" }}>
                  {pointDetailImage ? (
                    <div>
                      <img
                        src={pointDetailImage}
                        alt="NDVI Point"
                        style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 8 }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          onClick={() => window.open(pointDetailImage, "_blank")}
                        >
                          View Full Image
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p>No image available</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* FOOTER */}
      <footer className="footer" style={{
        color: 'black',
        textAlign: 'center',
        padding: '15px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center'
      }}>
        <div>
          <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            © 2026 Gujarat Forest Department
            <img src={gujaratlogo} alt="logo picture" style={{ width: '40px' }} />
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <p>Powered by</p>
          <a href="https://www.gisfy.co.in/" target="_blank" rel="noopener noreferrer">
            <img
              src={gisfylogo}
              alt="logo picture"
              style={{ width: '100px', height: '40px' }}
            />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default NDVINotifications;
